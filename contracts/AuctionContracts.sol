// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AuctionFactory {
    address[] public auctions;

    event AuctionCreated(address indexed auctionAddress, string itemName, address indexed creator);

    function createAuction(string memory _itemName, uint256 _startingBid, uint256 _durationInSeconds) public {
        require(_durationInSeconds > 0, "Duration must be greater than 0");
        Auction newAuction = new Auction(msg.sender, _itemName, _startingBid, _durationInSeconds);
        auctions.push(address(newAuction));
        emit AuctionCreated(address(newAuction), _itemName, msg.sender);
    }

    function getAllAuctions() public view returns (address[] memory) {
        return auctions;
    }
}

contract Auction is ReentrancyGuard {
    address public auctionCreator;
    string public itemName;
    uint256 public startingBid;
    uint256 public endTime;
    bool public ended;

    address public highestBidder;
    uint256 public highestBid;

    event NewHighestBid(address indexed bidder, uint256 amount);
    event AuctionEnded(address indexed winner, uint256 amount);
    event RefundIssued(address indexed to, uint256 amount);

    constructor(address _creator, string memory _itemName, uint256 _startingBid, uint256 _durationInSeconds) {
        require(_creator != address(0), "Invalid creator address");
        require(bytes(_itemName).length > 0, "Item name cannot be empty");
        require(_startingBid > 0, "Starting bid must be greater than 0");
        require(_durationInSeconds > 0, "Duration must be greater than 0");

        auctionCreator = _creator;
        itemName = _itemName;
        startingBid = _startingBid;
        endTime = block.timestamp + _durationInSeconds;
        highestBid = 0;
        highestBidder = address(0);
        ended = false;
    }

    modifier onlyBeforeEnd() {
        require(block.timestamp < endTime, "Auction already ended");
        _;
    }

    modifier onlyAfterEnd() {
        require(block.timestamp >= endTime, "Auction not yet ended");
        _;
    }

    function placeBid() external payable onlyBeforeEnd nonReentrant {
        require(msg.value > highestBid, "Bid must be higher than the current highest bid");

        if (highestBidder != address(0)) {
            payable(highestBidder).transfer(highestBid);
            emit RefundIssued(highestBidder, highestBid);
        }

        highestBidder = msg.sender;
        highestBid = msg.value;
        emit NewHighestBid(msg.sender, msg.value);
    }

    function isAuctionEnded() public view returns (bool) {
        return block.timestamp >= endTime;
    }

    function endAuction() external onlyAfterEnd nonReentrant {
        require(!ended, "Auction already ended");
        require(msg.sender == auctionCreator, "Only the creator can end the auction");
        ended = true;

        if (highestBidder != address(0)) {
            payable(auctionCreator).transfer(highestBid);
            emit AuctionEnded(highestBidder, highestBid);
        } else {
            emit AuctionEnded(address(0), 0);
        }
    }
}