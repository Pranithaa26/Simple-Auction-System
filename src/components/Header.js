import React from 'react';

const Header = ({ onCreateClick, onWalletConnect, walletConnected, walletAddress }) => {
  console.log('Header rendering with walletAddress:', walletAddress); // Debug log
  return (
    <header className="header">
      <div className="nav-container">
        <div className="logo">BidHub <i className="fas fa-gavel logo-icon"></i></div>
        <button className="connect-btn" onClick={onWalletConnect}>
          <i className={`fas ${walletConnected ? 'fa-check' : 'fa-wallet'}`}></i>
          {walletConnected && walletAddress
            ? `Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
            : 'Connect Wallet'}
        </button>
        <button
          className="connect-btn"
          onClick={onCreateClick}
          style={{ marginLeft: '1rem' }}
          disabled={!walletConnected}
        >
          <i className="fas fa-plus"></i> Create Auction
        </button>
      </div>
    </header>
  );
};

export default Header;