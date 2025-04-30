// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import OpenZeppelin's ReentrancyGuard to prevent reentrancy attacks
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Auction contract for managing individual auctions
contract Auction is ReentrancyGuard {
    // State variables for auction metadata
    address public auctionCreator; // Address of the auction creator (seller)
    string public itemName; // Name of the item being auctioned
    uint256 public startingBid; // Minimum starting bid in wei
    uint256 public endTime; // Unix timestamp when the auction ends
    bool public ended; // Flag indicating if the auction has ended
    bool public itemConfirmed; // Flag indicating if the buyer confirmed item receipt
    bool public disputed; // Flag indicating if a dispute is active
    uint256 public confirmationDeadline; // Deadline for the buyer to confirm receipt

    // State variables for bidding
    address public highestBidder; // Address of the current highest bidder
    uint256 public highestBid; // Current highest bid in wei
    uint256 public constant MIN_INCREMENT = 0.1 ether; // Minimum bid increment
    uint256 public constant CONFIRMATION_PERIOD = 7 days; // Time period for buyer to confirm receipt
    uint256 public totalEscrowed; // Total ETH held in escrow for the auction

    // Enum to track the status of the item
    enum ItemStatus { WithSeller, WithBidder, Disputed }
    ItemStatus public itemStatus; // Current status of the item

    // Struct to store bid details
    struct Bid {
        address bidder; // Address of the bidder
        uint256 amount; // Bid amount in wei
        uint256 timestamp; // Timestamp of the bid
    }
    Bid[] public bidHistory; // Array to store the history of all bids

    // Events for logging important actions
    event NewHighestBid(address indexed bidder, uint256 amount, address indexed previousBidder, uint256 refundAmount); // Emitted when a new highest bid is placed
    event AuctionEnded(address indexed winner, uint256 amount); // Emitted when the auction ends
    event BidPlaced(address indexed bidder, uint256 amount, uint256 timestamp); // Emitted when a bid is placed
    event BidRefunded(address indexed bidder, uint256 amount); // Emitted when a bid is refunded
    event RefundAttempted(address indexed bidder, uint256 amount, bool success); // Emitted during refund attempts
    event ItemConfirmed(address indexed buyer); // Emitted when the buyer confirms receipt
    event DisputeInitiated(address indexed buyer, address indexed seller); // Emitted when a dispute is initiated
    event FundsReleased(address indexed recipient, uint256 amount); // Emitted when funds are released
    event FundsTransferAttempted(address indexed recipient, uint256 amount, bool success); // Emitted during fund transfers
    event ItemStatusUpdated(ItemStatus status); // Emitted when item status changes
    event TransactionLogged(address indexed recipient, uint256 amount, bytes32 txHash); // Emitted to log transactions

    // Constructor to initialize the auction
    constructor(
        address _creator,
        string memory _itemName,
        uint256 _startingBid,
        uint256 _durationInSeconds
    ) {
        require(_creator != address(0), "Invalid creator address"); // Ensure creator address is valid
        require(bytes(_itemName).length > 0, "Item name cannot be empty"); // Ensure item name is not empty
        require(_startingBid > 0, "Starting bid must be greater than 0"); // Ensure starting bid is positive
        require(_durationInSeconds > 0, "Duration must be greater than 0"); // Ensure duration is positive

        auctionCreator = _creator;
        itemName = _itemName;
        startingBid = _startingBid;
        endTime = block.timestamp + _durationInSeconds;
        itemStatus = ItemStatus.WithSeller; // Initial status: item is with the seller
        emit ItemStatusUpdated(itemStatus);
    }

    // Fallback function to accept ETH
    receive() external payable {}

    // Modifier to ensure function is called before the auction ends
    modifier onlyBeforeEnd() {
        require(block.timestamp < endTime, "Auction already ended");
        _;
    }

    // Modifier to ensure function is called after the auction ends
    modifier onlyAfterEnd() {
        require(block.timestamp >= endTime, "Auction not yet ended");
        _;
    }

    // Modifier to restrict function to the auction creator
    modifier onlyCreator() {
        require(msg.sender == auctionCreator, "Only creator can call this");
        _;
    }

    // Modifier to restrict function to the highest bidder
    modifier onlyHighestBidder() {
        require(msg.sender == highestBidder, "Only highest bidder can call this");
        _;
    }

    // Function to place a bid
    function placeBid() external payable onlyBeforeEnd nonReentrant {
        require(msg.value >= startingBid, "Bid below starting bid"); // Ensure bid meets starting bid
        require(msg.value >= highestBid + MIN_INCREMENT, "Bid increment too low"); // Ensure bid exceeds current highest by minimum increment

        address previousBidder = highestBidder; // Store previous bidder for refund
        uint256 previousBid = highestBid; // Store previous bid amount

        // Refund the previous bidder if there was one
        if (previousBidder != address(0)) {
            (bool success, ) = previousBidder.call{value: previousBid, gas: gasleft()}("");
            emit RefundAttempted(previousBidder, previousBid, success);
            require(success, "Refund failed"); // Revert if refund fails
            totalEscrowed -= previousBid;
            emit BidRefunded(previousBidder, previousBid);
            emit TransactionLogged(previousBidder, previousBid, keccak256(abi.encodePacked(block.timestamp, previousBidder, previousBid)));
            emit NewHighestBid(msg.sender, msg.value, previousBidder, previousBid);
        } else {
            emit NewHighestBid(msg.sender, msg.value, address(0), 0);
        }

        // Update highest bid and bidder
        highestBidder = msg.sender;
        highestBid = msg.value;
        totalEscrowed += msg.value;

        // Record the bid in history
        bidHistory.push(Bid(msg.sender, msg.value, block.timestamp));
        emit BidPlaced(msg.sender, msg.value, block.timestamp);
    }

    // Function to end the auction, only callable by the creator after the end time
    function endAuction() external onlyAfterEnd onlyCreator nonReentrant {
        require(!ended, "Auction already ended"); // Ensure auction hasn't already ended

        ended = true;
        confirmationDeadline = block.timestamp + CONFIRMATION_PERIOD; // Set deadline for buyer confirmation
        emit AuctionEnded(highestBidder, highestBid);
    }

    // Function for the highest bidder to confirm receipt of the item
    function confirmReceipt() external onlyHighestBidder nonReentrant {
        require(ended, "Auction not yet ended"); // Ensure auction has ended
        require(!itemConfirmed, "Item already confirmed"); // Ensure item hasn't been confirmed
        require(!disputed, "Dispute already initiated"); // Ensure no dispute is active

        itemConfirmed = true;
        itemStatus = ItemStatus.WithBidder; // Update status to indicate item is with bidder
        emit ItemConfirmed(highestBidder);
        emit ItemStatusUpdated(itemStatus);

        // Transfer funds to the seller
        uint256 amount = highestBid;
        totalEscrowed -= amount;
        (bool success, ) = auctionCreator.call{value: amount, gas: gasleft()}("");
        emit FundsTransferAttempted(auctionCreator, amount, success);
        require(success, "Transfer to creator failed"); // Revert if transfer fails
        emit FundsReleased(auctionCreator, amount);
        emit TransactionLogged(auctionCreator, amount, keccak256(abi.encodePacked(block.timestamp, auctionCreator, amount)));
    }

    // Function for the highest bidder to initiate a dispute
    function initiateDispute() external onlyHighestBidder nonReentrant {
        require(ended, "Auction not yet ended"); // Ensure auction has ended
        require(!itemConfirmed, "Item already confirmed"); // Ensure item hasn't been confirmed
        require(block.timestamp <= confirmationDeadline, "Confirmation period expired"); // Ensure within confirmation period
        require(!disputed, "Dispute already initiated"); // Ensure no dispute is already active

        disputed = true;
        itemStatus = ItemStatus.Disputed; // Update status to disputed
        emit DisputeInitiated(highestBidder, auctionCreator);
        emit ItemStatusUpdated(itemStatus);
    }

    // Function for the creator to resolve a dispute
    function resolveDispute(bool awardToSeller) external onlyCreator nonReentrant {
        require(disputed, "No dispute to resolve"); // Ensure there is an active dispute
        require(highestBidder != address(0), "No winner to resolve for"); // Ensure there is a highest bidder

        uint256 amount = highestBid;
        totalEscrowed -= amount; // Remove amount from escrow

        // Award funds based on resolution
        if (awardToSeller) {
            // Award to seller (creator)
            (bool success, ) = auctionCreator.call{value: amount, gas: gasleft()}("");
            emit FundsTransferAttempted(auctionCreator, amount, success);
            require(success, "Transfer to creator failed"); // Revert if transfer fails
            emit FundsReleased(auctionCreator, amount);
            emit TransactionLogged(auctionCreator, amount, keccak256(abi.encodePacked(block.timestamp, auctionCreator, amount)));
            itemStatus = ItemStatus.WithBidder; // Item stays with bidder
        } else {
            // Refund to bidder
            (bool success, ) = highestBidder.call{value: amount, gas: gasleft()}("");
            emit FundsTransferAttempted(highestBidder, amount, success);
            require(success, "Refund to bidder failed"); // Revert if refund fails
            emit FundsReleased(highestBidder, amount);
            emit TransactionLogged(highestBidder, amount, keccak256(abi.encodePacked(block.timestamp, highestBidder, amount)));
            itemStatus = ItemStatus.WithSeller; // Item returns to seller
        }

        disputed = false; // Mark dispute as resolved
        emit ItemStatusUpdated(itemStatus);
    }

    // Function to get the bid history
    function getBidHistory() public view returns (Bid[] memory) {
        return bidHistory;
    }

    // Function to get all auction details
    function getAuctionDetails() public view returns (
        address creator,
        string memory name,
        uint256 startBid,
        uint256 endTime_,
        bool isEnded,
        bool isItemConfirmed,
        bool isDisputed,
        uint256 confirmDeadline,
        address currentWinner,
        uint256 currentBid,
        ItemStatus itemStatus_
    ) {
        return (
            auctionCreator,
            itemName,
            startingBid,
            endTime,
            ended,
            itemConfirmed,
            disputed,
            confirmationDeadline,
            highestBidder,
            highestBid,
            itemStatus
        );
    }
}

// Factory contract to create and manage multiple auctions
contract AuctionFactory {
    address[] public auctions; // Array to store addresses of all created auctions
    address public owner; // Owner of the factory contract

    // Event emitted when a new auction is created
    event AuctionCreated(
        address indexed auctionAddress,
        string itemName,
        address indexed creator,
        uint256 startingBid,
        uint256 duration
    );

    // Constructor to set the owner
    constructor() {
        owner = msg.sender;
    }

    // Function to create a new auction
    function createAuction(
        string memory _itemName,
        uint256 _startingBid,
        uint256 _durationInSeconds
    ) public {
        require(_durationInSeconds > 0, "Duration must be greater than 0"); // Ensure duration is positive
        Auction newAuction = new Auction(
            msg.sender,
            _itemName,
            _startingBid,
            _durationInSeconds
        );
        auctions.push(address(newAuction));
        emit AuctionCreated(
            address(newAuction),
            _itemName,
            msg.sender,
            _startingBid,
            _durationInSeconds
        );
    }

    // Function to get all auction addresses
    function getAllAuctions() public view returns (address[] memory) {
        return auctions;
    }

    // Function to get the total number of auctions
    function getAuctionCount() public view returns (uint256) {
        return auctions.length;
    }
}