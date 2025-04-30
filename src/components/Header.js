import React from 'react';
import './Header.css';

const Header = ({ onWalletConnect, onDisconnect, walletConnected, walletAddress, myAuctions, myBids, onCreateClick, onMyAuctionsClick, onMyBidsClick, auctions }) => {
  return (
    <header className="header">
      <div className="logo">
        <span>BidHub</span>
      </div>
      <nav className="nav-container">
        {walletConnected ? (
          <>
            <button onClick={onMyAuctionsClick}>My Auctions ({myAuctions.length})</button>
            <button onClick={onMyBidsClick}>My Bids ({myBids.length})</button>
            <button onClick={onCreateClick}>Create Auction</button>
            <div className="wallet-info">
              <span className="wallet-address">{walletAddress}</span>
              <button onClick={onDisconnect}>Disconnect</button>
            </div>
          </>
        ) : (
          <button onClick={onWalletConnect}>Connect Wallet</button>
        )}
      </nav>
    </header>
  );
};

export default Header;