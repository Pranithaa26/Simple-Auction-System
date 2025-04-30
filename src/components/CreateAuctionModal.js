import React, { useState } from 'react';

const CreateAuctionModal = ({ onClose, onCreate, web3, walletAddress }) => {
  const [name, setName] = useState('');
  const [image, setImage] = useState(null);
  const [startingBid, setStartingBid] = useState('');
  const [timeInput, setTimeInput] = useState(''); // Single input for time (e.g., "1h 30m 45s")
  const [preview, setPreview] = useState(null); // Image preview state

  // Function to parse time input (e.g., "1h 30m 45s" or "2h")
  const parseTime = (input) => {
    if (!input) return 0;
    const regex = /(?:(\d+(?:[.,]\d+)?)h)?\s*(?:(\d+(?:[.,]\d+)?)m)?\s*(?:(\d+(?:[.,]\d+)?)s)?/i;
    const match = input.match(regex);
    if (!match) return 0;

    const [ , h, m, s ] = match.map(x => parseFloat(x) || 0);
    return Math.floor(h * 3600 + m * 60 + s);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!web3 || !walletAddress) {
      alert("Please connect your wallet.");
      return;
    }
    if (!name || !image || !startingBid || !timeInput) {
      alert("All fields are required, including time.");
      return;
    }
    const timeLeft = parseTime(timeInput);
    if (timeLeft <= 0) {
      alert("Please enter a valid duration (e.g., '1h 30m' or '120s').");
      return;
    }
    const imageUrl = URL.createObjectURL(image); // Temporary; replace with IPFS in production
    const auctionData = { name, startingBid, image: imageUrl, timeInput };
    await onCreate(auctionData);
    
    // Reset form after submission
    setName('');
    setImage(null);
    setStartingBid('');
    setTimeInput('');
    setPreview(null);

    onClose();
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <span className="close-modal" onClick={onClose}>×</span>
        <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--primary)' }}>
          Create New Auction
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <input
            type="text"
            placeholder="Item Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
            aria-label="Auction Item Name"
          />
          <div>
            <label htmlFor="image-upload" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--gray)' }}>Upload Item Image</label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                setImage(file);
                setPreview(URL.createObjectURL(file)); // Set image preview
              }}
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', width: '100%' }}
              aria-label="Upload Auction Item Image"
            />
            {preview && <img src={preview} alt="Preview" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '1rem' }} />}
          </div>
          <input
            type="number"
            placeholder="Starting Bid (ETH)"
            value={startingBid}
            onChange={(e) => setStartingBid(e.target.value)}
            step="0.01"
            min="0"
            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
            aria-label="Starting Bid in ETH"
          />
          <div>
            <label htmlFor="time-input" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--gray)' }}>Duration (e.g., 1h 30m 45s)</label>
            <input
              id="time-input"
              type="text"
              placeholder="e.g., 1h 30m or 120s"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', width: '100%' }}
              aria-label="Auction Duration (e.g., 1h 30m)"
            />
          </div>
          <button
            type="submit"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '50px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(78, 68, 206, 0.3)',
              width: '100%',
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 20px rgba(78, 68, 206, 0.4)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'none';
              e.target.style.boxShadow = '0 4px 15px rgba(78, 68, 206, 0.3)';
            }}
          >
            Create Auction <i className="fas fa-check" style={{ marginLeft: '0.5rem' }}></i>
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateAuctionModal;
