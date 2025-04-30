import React from 'react';
import '../styles/myBids.css';

const MyBids = ({ bids, auctions, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="my-bids">
        <h2>My Bids</h2>
        {bids.length === 0 ? (
          <p>No bids placed.</p>
        ) : (
          <ul>
            {bids.map((bid, index) => {
              const auction = auctions.find((a) => a.id === bid.auctionId);
              return (
                <li key={index}>
                  <h3>{auction ? auction.name : 'Unknown Auction'}</h3>
                  <p>Bid Amount: {bid.amount} ETH</p>
                  <p>Placed at: {new Date(bid.timestamp * 1000).toLocaleString()}</p>
                </li>
              );
            })}
          </ul>
        )}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default MyBids;