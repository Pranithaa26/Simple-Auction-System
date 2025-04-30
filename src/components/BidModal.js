import React, { useState } from 'react';
import '../styles/bidModal.css';

const BidModal = ({ auction, onClose, onBid }) => {
  const [bidAmount, setBidAmount] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (bidAmount && parseFloat(bidAmount) > 0) {
      onBid(auction.id, bidAmount);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="bid-modal">
        <h2>Place Bid on {auction.name}</h2>
        <p>Current Highest Bid: {auction.highestBid} ETH</p>
        <p>Minimum Bid: {(parseFloat(auction.highestBid) + 0.1).toFixed(2)} ETH</p>
        <form onSubmit={handleSubmit}>
          <input
            type="number"
            step="0.01"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder="Enter bid amount (ETH)"
            required
          />
          <div className="modal-buttons">
            <button type="submit">Place Bid</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BidModal;