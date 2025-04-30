import React, { useState } from 'react';
import './CreateAuctionModal.css';

const CreateAuctionModal = ({ onClose, onCreate, web3, walletAddress }) => {
  const [name, setName] = useState('');
  const [startingBid, setStartingBid] = useState('');
  const [timeInput, setTimeInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name && startingBid && timeInput) {
      onCreate({ name, startingBid, timeInput });
      onClose();
    } else {
      alert('Please fill in all fields.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Create Auction</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Item Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter item name"
              required
            />
          </div>
          <div className="form-group">
            <label>Starting Bid (ETH)</label>
            <input
              type="number"
              step="0.01"
              value={startingBid}
              onChange={(e) => setStartingBid(e.target.value)}
              placeholder="Enter starting bid"
              required
            />
          </div>
          <div className="form-group">
            <label>Duration (e.g., 1h 30m)</label>
            <input
              type="text"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              placeholder="e.g., 1h 30m"
              required
            />
          </div>
          <div className="button-group">
            <button type="submit">Create</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAuctionModal;