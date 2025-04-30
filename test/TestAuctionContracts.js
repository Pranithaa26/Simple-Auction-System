const { expect } = require("chai");
const { BN, expectEvent, expectRevert, time } = require("@openzeppelin/test-helpers");

contract("AuctionContracts", (accounts) => {
  let auctionFactory;
  let auction;
  const owner = accounts[0];
  const bidder1 = accounts[1];
  const bidder2 = accounts[2];
  const itemName = "Test NFT";
  const startingBid = web3.utils.toWei("1", "ether"); // Use web3.js instead of ethers
  const duration = 600;

  beforeEach(async () => {
    const AuctionFactory = await artifacts.require("AuctionFactory").new();
    auctionFactory = AuctionFactory;
  });

  describe("AuctionFactory", () => {
    it("should deploy AuctionFactory correctly", async () => {
      expect(auctionFactory.address).to.not.equal(0);
    });

    it("should create an auction and emit AuctionCreated event", async () => {
      const receipt = await auctionFactory.createAuction(itemName, startingBid, duration, { from: owner });
      expectEvent(receipt, "AuctionCreated", {
        auctionAddress: receipt.logs[0].args.auctionAddress, // Direct comparison instead of expect.any
        itemName: itemName,
        creator: owner,
      });

      const auctions = await auctionFactory.getAllAuctions();
      expect(auctions.length).to.equal(1);
      expect(auctions[0]).to.not.equal(0);
    });

    it("should return all auction addresses", async () => {
      await auctionFactory.createAuction(itemName, startingBid, duration, { from: owner });
      await auctionFactory.createAuction("Another NFT", startingBid, duration, { from: owner });

      const auctions = await auctionFactory.getAllAuctions();
      expect(auctions.length).to.equal(2);
    });

    it("should revert if duration is 0", async () => {
      await expectRevert(
        auctionFactory.createAuction(itemName, startingBid, 0, { from: owner }),
        "Duration must be greater than 0"
      );
    });
  });

  describe("Auction", () => {
    let auctionAddress;

    beforeEach(async () => {
      const receipt = await auctionFactory.createAuction(itemName, startingBid, duration, { from: owner });
      auctionAddress = receipt.logs[0].args.auctionAddress;
      const Auction = await artifacts.require("Auction");
      auction = await Auction.at(auctionAddress);
    });

    it("should initialize auction with correct parameters", async () => {
      expect(await auction.auctionCreator()).to.equal(owner);
      expect(await auction.itemName()).to.equal(itemName);
      expect((await auction.startingBid()).toString()).to.equal(startingBid.toString());
      expect(await auction.ended()).to.equal(false);
      expect(await auction.highestBidder()).to.equal("0x0000000000000000000000000000000000000000");
      expect((await auction.highestBid()).toString()).to.equal("0");
    });

    it("should allow a bid higher than the current highest bid", async () => {
      const bidAmount = web3.utils.toWei("2", "ether");
      const receipt = await auction.placeBid({ from: bidder1, value: bidAmount });

      expectEvent(receipt, "NewHighestBid", {
        bidder: bidder1,
        amount: new BN(bidAmount),
      });

      expect(await auction.highestBidder()).to.equal(bidder1);
      expect((await auction.highestBid()).toString()).to.equal(bidAmount.toString());
    });

    it("should refund previous bidder and emit RefundIssued event", async () => {
      const firstBid = web3.utils.toWei("2", "ether");
      await auction.placeBid({ from: bidder1, value: firstBid });

      const secondBid = web3.utils.toWei("3", "ether");
      const receipt = await auction.placeBid({ from: bidder2, value: secondBid });

      expectEvent(receipt, "RefundIssued", {
        to: bidder1,
        amount: new BN(firstBid),
      });

      expect(await auction.highestBidder()).to.equal(bidder2);
      expect((await auction.highestBid()).toString()).to.equal(secondBid.toString());
    });

    it("should revert if bid is not higher than current highest bid", async () => {
      await auction.placeBid({ from: bidder1, value: web3.utils.toWei("2", "ether") });
      await expectRevert(
        auction.placeBid({ from: bidder2, value: web3.utils.toWei("1", "ether") }),
        "Bid must be higher than the current highest bid"
      );
    });

    it("should revert if bidding after auction ends", async () => {
      await time.increase(duration + 1); // Use @openzeppelin/test-helpers for time manipulation
      await time.advanceBlock();

      await expectRevert(
        auction.placeBid({ from: bidder1, value: web3.utils.toWei("2", "ether") }),
        "Auction already ended"
      );
    });

    it("should allow creator to end auction and transfer funds", async () => {
      const bidAmount = web3.utils.toWei("2", "ether");
      await auction.placeBid({ from: bidder1, value: bidAmount });

      await time.increase(duration + 1);
      await time.advanceBlock();

      const initialBalance = new BN(await web3.eth.getBalance(owner));
      const receipt = await auction.endAuction({ from: owner });

      expectEvent(receipt, "AuctionEnded", {
        winner: bidder1,
        amount: new BN(bidAmount),
      });

      const finalBalance = new BN(await web3.eth.getBalance(owner));
      expect(finalBalance.gt(initialBalance)).to.be.true;
      expect(await auction.ended()).to.equal(true);
    });

    it("should revert if non-creator tries to end auction", async () => {
      await time.increase(duration + 1);
      await time.advanceBlock();

      await expectRevert(
        auction.endAuction({ from: bidder1 }),
        "Only the creator can end the auction"
      );
    });

    it("should revert if ending auction before it ends", async () => {
      await expectRevert(
        auction.endAuction({ from: owner }),
        "Auction not yet ended"
      );
    });

    it("should revert if ending already ended auction", async () => {
      await time.increase(duration + 1);
      await time.advanceBlock();

      await auction.endAuction({ from: owner });
      await expectRevert(
        auction.endAuction({ from: owner }),
        "Auction already ended"
      );
    });
  });
});