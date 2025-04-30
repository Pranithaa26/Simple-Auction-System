import React from 'react';
import '../styles/myAuctions.css';

const MyAuctions = ({ auctions, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="my-auctions">
        <h2>My Auctions</h2>
        {auctions.length === 0 ? (
          <p>No auctions created.</p>
        ) : (
          <ul>
            {auctions.map((auction) => (
              <li key={auction.id}>
                <h3>{auction.name}</h3>
                <p>Starting Bid: {auction.startingBid} ETH</p>
                <p>Highest Bid: {auction.highestBid} ETH</p>
                <p>Status: {auction.ended ? 'Ended' : 'Active'}</p>
              </li>
            ))}
          </ul>
        )}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default MyAuctions;