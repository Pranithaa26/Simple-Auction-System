const Auction = artifacts.require("Auction");
const { expectRevert, time } = require('@openzeppelin/test-helpers');
const { BN } = require('web3').utils;

contract("Auction", accounts => {
  let auction;
  const creator = accounts[0];
  const bidder1 = accounts[1];
  const bidder2 = accounts[2];
  const itemName = "Test Item";
  const startingBid = web3.utils.toWei("0.1", "ether");
  const duration = 3600;

  beforeEach(async () => {
    auction = await Auction.new(creator, itemName, startingBid, duration, { from: creator });
  });

  it("should allow only creator to end auction", async () => {
    await time.increase(duration + 1);
    await expectRevert(
      auction.endAuction({ from: bidder1 }),
      "Only creator can call this"
    );
    await auction.endAuction({ from: creator });
    assert.equal(await auction.ended(), true);
  });

  it("should require bids to exceed highest bid by MIN_INCREMENT", async () => {
    await auction.placeBid({ from: bidder1, value: web3.utils.toWei("0.2", "ether") });
    await expectRevert(
      auction.placeBid({ from: bidder2, value: web3.utils.toWei("0.25", "ether") }),
      "Bid increment too low"
    );
    await auction.placeBid({ from: bidder2, value: web3.utils.toWei("0.3", "ether") });
    assert.equal(await auction.highestBidder(), bidder2);
  });

  it("should automatically refund outbid bidder", async () => {
    await auction.placeBid({ from: bidder1, value: web3.utils.toWei("0.2", "ether") });
    const initialBalance = new BN(await web3.eth.getBalance(bidder1));
    await auction.placeBid({ from: bidder2, value: web3.utils.toWei("0.3", "ether") });
    const finalBalance = new BN(await web3.eth.getBalance(bidder1));
    assert(finalBalance.gt(initialBalance), "Refund not received");
    const totalEscrowed = await auction.totalEscrowed();
    assert.equal(totalEscrowed.toString(), web3.utils.toWei("0.3", "ether"));
  });

  it("should release funds to creator on confirmReceipt", async () => {
    await auction.placeBid({ from: bidder1, value: web3.utils.toWei("0.2", "ether") });
    await time.increase(duration + 1);
    await auction.endAuction({ from: creator });
    const creatorInitialBalance = new BN(await web3.eth.getBalance(creator));
    await auction.confirmReceipt({ from: bidder1 });
    const creatorFinalBalance = new BN(await web3.eth.getBalance(creator));
    assert(creatorFinalBalance.gt(creatorInitialBalance), "Funds not released to creator");
    assert.equal((await auction.totalEscrowed()).toString(), "0");
  });
});