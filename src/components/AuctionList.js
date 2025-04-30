import React from 'react';
import { formatTime } from '../utils/time';
import './AuctionList.css';

const AuctionList = ({ auctions, onBid, onEndAuction, onConfirmReceipt, onInitiateDispute, onResolveDispute, walletAddress }) => {
  console.log('AuctionList rendering with auctions:', auctions);

  if (!auctions || !auctions.length) {
    return <div className="no-auctions">No auctions available</div>;
  }

  const getStatus = (auction) => {
    console.log(`getStatus for auction ${auction.id}:`, {
      ended: auction.ended,
      timeLeft: auction.timeLeft,
      itemConfirmed: auction.itemConfirmed,
      disputed: auction.disputed,
      bidHistory: auction.bidHistory,
      highestBidder: auction.highestBidder,
    });
    if (auction.ended && !auction.itemConfirmed && !auction.disputed) {
      return {
        text: `Auction Ended - Winner: ${auction.highestBidder ? auction.highestBidder.slice(0, 6) + '...' + auction.highestBidder.slice(-4) : 'None'}`,
        className: 'status-ended',
      };
    }
    if (auction.ended && auction.itemConfirmed) {
      return { text: 'Confirmed', className: 'status-confirmed' };
    }
    if (auction.ended && auction.disputed) {
      return { text: 'Disputed', className: 'status-disputed' };
    }
    if (!auction.ended && auction.timeLeft > 0) {
      return auction.bidHistory && auction.bidHistory.length > 0
        ? { text: 'Bidding', className: 'status-bidding' }
        : { text: 'Placing Start Bid', className: 'status-placing' };
    }
    return { text: 'Unknown', className: 'status-unknown' };
  };

  const getItemStatus = (auction) => {
    return `Item: ${auction.itemStatus}`;
  };

  return (
    <div className="auction-list">
      {auctions.map((auction) => {
        const isHighestBidder =
          walletAddress &&
          auction.highestBidder &&
          walletAddress.toLowerCase() === auction.highestBidder.toLowerCase();
        const canConfirmReceipt =
          isHighestBidder && auction.ended && !auction.itemConfirmed && !auction.disputed;
        const status = getStatus(auction);
        console.log(`Auction ${auction.id} (${auction.name}):`, {
          isHighestBidder,
          canConfirmReceipt,
          ended: auction.ended,
          itemConfirmed: auction.itemConfirmed,
          disputed: auction.disputed,
          itemStatus: auction.itemStatus,
          highestBid: auction.highestBid,
          bidHistory: auction.bidHistory,
          timeLeft: auction.timeLeft,
        });

        return (
          <div key={auction.id} className="auction-item">
            <h3>{auction.name}</h3>
            <p>Starting Bid: {auction.startingBid} ETH</p>
            <p>Highest Bid: {auction.highestBid} ETH</p>
            <p>Seller: {auction.seller}</p>
            {!auction.ended && auction.timeLeft > 0 && (
              <p className="time-left">Time Left: {formatTime(auction.timeLeft)}</p>
            )}
            <p className={`status ${status.className}`}>
              Status: {status.text}
            </p>
            <p className="item-status">{getItemStatus(auction)}</p>
            {auction.itemConfirmed && <p className="funds-released">Funds released to seller.</p>}
            <h4>Bid History:</h4>
            {auction.bidHistory && auction.bidHistory.length > 0 ? (
              <ul className="bid-history">
                {auction.bidHistory.map((bid, index) => (
                  <li key={index}>
                    {bid.bidder.slice(0, 6)}...{bid.bidder.slice(-4)} bid {bid.amount} ETH at{' '}
                    {new Date(bid.timestamp * 1000).toLocaleString()}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No bids yet</p>
            )}
            {!auction.ended && auction.timeLeft > 0 && (
              <button onClick={() => onBid(auction)}>Place Bid</button>
            )}
            {walletAddress &&
              walletAddress.toLowerCase() === auction.seller.toLowerCase() &&
              !auction.ended &&
              auction.timeLeft <= 0 && (
                <button onClick={() => onEndAuction(auction.id)}>End Auction</button>
              )}
            {canConfirmReceipt && (
              <button onClick={() => onConfirmReceipt(auction.id)}>Confirm Receipt</button>
            )}
            {isHighestBidder &&
              auction.ended &&
              !auction.itemConfirmed &&
              !auction.disputed &&
              auction.confirmTimeLeft > 0 && (
                <button onClick={() => onInitiateDispute(auction.id)}>Initiate Dispute</button>
              )}
            {walletAddress &&
              walletAddress.toLowerCase() === auction.seller.toLowerCase() &&
              auction.disputed && (
                <>
                  <button onClick={() => onResolveDispute(auction.id, true)}>Resolve for Seller</button>
                  <button onClick={() => onResolveDispute(auction.id, false)}>Resolve for Bidder</button>
                </>
              )}
          </div>
        );
      })}
    </div>
  );
};

export default AuctionList;