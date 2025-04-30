// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Auction is ReentrancyGuard {
    address public auctionCreator;
    string public itemName;
    uint256 public startingBid;
    uint256 public endTime;
    bool public ended;
    bool public itemConfirmed;
    bool public disputed;
    uint256 public confirmationDeadline;

    address public highestBidder;
    uint256 public highestBid;
    uint256 public constant MIN_INCREMENT = 0.1 ether;
    uint256 public constant CONFIRMATION_PERIOD = 7 days;

    uint256 public totalEscrowed;

    enum ItemStatus { WithSeller, WithBidder, Disputed }
    ItemStatus public itemStatus;

    struct Bid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
    }
    Bid[] public bidHistory;

    event NewHighestBid(address indexed bidder, uint256 amount, address indexed previousBidder, uint256 refundAmount);
    event AuctionEnded(address indexed winner, uint256 amount);
    event BidPlaced(address indexed bidder, uint256 amount, uint256 timestamp);
    event BidRefunded(address indexed bidder, uint256 amount);
    event RefundAttempted(address indexed bidder, uint256 amount, bool success);
    event ItemConfirmed(address indexed buyer);
    event DisputeInitiated(address indexed buyer, address indexed seller);
    event FundsReleased(address indexed recipient, uint256 amount);
    event FundsTransferAttempted(address indexed recipient, uint256 amount, bool success);
    event ItemStatusUpdated(ItemStatus status);
    event TransactionLogged(address indexed recipient, uint256 amount, bytes32 txHash);

    constructor(
        address _creator,
        string memory _itemName,
        uint256 _startingBid,
        uint256 _durationInSeconds
    ) {
        require(_creator != address(0), "Invalid creator address");
        require(bytes(_itemName).length > 0, "Item name cannot be empty");
        require(_startingBid > 0, "Starting bid must be greater than 0");
        require(_durationInSeconds > 0, "Duration must be greater than 0");

        auctionCreator = _creator;
        itemName = _itemName;
        startingBid = _startingBid;
        endTime = block.timestamp + _durationInSeconds;
        itemStatus = ItemStatus.WithSeller;
        emit ItemStatusUpdated(itemStatus);
    }

    receive() external payable {}

    modifier onlyBeforeEnd() {
        require(block.timestamp < endTime, "Auction already ended");
        _;
    }

    modifier onlyAfterEnd() {
        require(block.timestamp >= endTime, "Auction not yet ended");
        _;
    }

    modifier onlyCreator() {
        require(msg.sender == auctionCreator, "Only creator can call this");
        _;
    }

    modifier onlyHighestBidder() {
        require(msg.sender == highestBidder, "Only highest bidder can call this");
        _;
    }

    function placeBid() external payable onlyBeforeEnd nonReentrant {
        require(msg.value >= startingBid, "Bid below starting bid");
        require(msg.value >= highestBid + MIN_INCREMENT, "Bid increment too low");

        address previousBidder = highestBidder;
        uint256 previousBid = highestBid;

        if (previousBidder != address(0)) {
            (bool success, ) = previousBidder.call{value: previousBid, gas: gasleft()}("");
            emit RefundAttempted(previousBidder, previousBid, success);
            require(success, "Refund failed");
            totalEscrowed -= previousBid;
            emit BidRefunded(previousBidder, previousBid);
            emit TransactionLogged(previousBidder, previousBid, keccak256(abi.encodePacked(block.timestamp, previousBidder, previousBid)));
            emit NewHighestBid(msg.sender, msg.value, previousBidder, previousBid);
        } else {
            emit NewHighestBid(msg.sender, msg.value, address(0), 0);
        }

        highestBidder = msg.sender;
        highestBid = msg.value;
        totalEscrowed += msg.value;

        bidHistory.push(Bid(msg.sender, msg.value, block.timestamp));
        emit BidPlaced(msg.sender, msg.value, block.timestamp);
    }

    function endAuction() external onlyAfterEnd onlyCreator nonReentrant {
        require(!ended, "Auction already ended");

        ended = true;
        confirmationDeadline = block.timestamp + CONFIRMATION_PERIOD;
        emit AuctionEnded(highestBidder, highestBid);
    }

    function confirmReceipt() external onlyHighestBidder nonReentrant {
        require(ended, "Auction not yet ended");
        require(!itemConfirmed, "Item already confirmed");
        require(!disputed, "Dispute already initiated");

        itemConfirmed = true;
        itemStatus = ItemStatus.WithBidder;
        emit ItemConfirmed(highestBidder);
        emit ItemStatusUpdated(itemStatus);

        uint256 amount = highestBid;
        totalEscrowed -= amount;
        (bool success, ) = auctionCreator.call{value: amount, gas: gasleft()}("");
        emit FundsTransferAttempted(auctionCreator, amount, success);
        require(success, "Transfer to creator failed");
        emit FundsReleased(auctionCreator, amount);
        emit TransactionLogged(auctionCreator, amount, keccak256(abi.encodePacked(block.timestamp, auctionCreator, amount)));
    }

    function initiateDispute() external onlyHighestBidder nonReentrant {
        require(ended, "Auction not yet ended");
        require(!itemConfirmed, "Item already confirmed");
        require(block.timestamp <= confirmationDeadline, "Confirmation period expired");
        require(!disputed, "Dispute already initiated");

        disputed = true;
        itemStatus = ItemStatus.Disputed;
        emit DisputeInitiated(highestBidder, auctionCreator);
        emit ItemStatusUpdated(itemStatus);
    }

    function resolveDispute(bool awardToSeller) external onlyCreator nonReentrant {
        require(disputed, "No dispute to resolve");
        require(highestBidder != address(0), "No winner to resolve for");

        uint256 amount = highestBid;
        totalEscrowed -= amount;

        if (awardToSeller) {
            (bool success, ) = auctionCreator.call{value: amount, gas: gasleft()}("");
            emit FundsTransferAttempted(auctionCreator, amount, success);
            require(success, "Transfer to creator failed");
            emit FundsReleased(auctionCreator, amount);
            emit TransactionLogged(auctionCreator, amount, keccak256(abi.encodePacked(block.timestamp, auctionCreator, amount)));
            itemStatus = ItemStatus.WithBidder;
        } else {
            (bool success, ) = highestBidder.call{value: amount, gas: gasleft()}("");
            emit FundsTransferAttempted(highestBidder, amount, success);
            require(success, "Refund to bidder failed");
            emit FundsReleased(highestBidder, amount);
            emit TransactionLogged(highestBidder, amount, keccak256(abi.encodePacked(block.timestamp, highestBidder, amount)));
            itemStatus = ItemStatus.WithSeller;
        }

        disputed = false;
        emit ItemStatusUpdated(itemStatus);
    }

    function getBidHistory() public view returns (Bid[] memory) {
        return bidHistory;
    }

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

contract AuctionFactory {
    address[] public auctions;
    address public owner;

    event AuctionCreated(
        address indexed auctionAddress,
        string itemName,
        address indexed creator,
        uint256 startingBid,
        uint256 duration
    );

    constructor() {
        owner = msg.sender;
    }

    function createAuction(
        string memory _itemName,
        uint256 _startingBid,
        uint256 _durationInSeconds
    ) public {
        require(_durationInSeconds > 0, "Duration must be greater than 0");
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

    function getAllAuctions() public view returns (address[] memory) {
        return auctions;
    }

    function getAuctionCount() public view returns (uint256) {
        return auctions.length;
    }
}