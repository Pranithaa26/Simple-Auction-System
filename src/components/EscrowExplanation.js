// components/EscrowExplanation.js
import React from 'react';

const EscrowExplanation = () => {
  return (
    <div className="escrow-explanation">
      <h2>Secure Fund Escrow System</h2>
      <div className="features">
        <div className="feature">
          <h3>For Bidders</h3>
          <ul>
            <li>🔒 Funds are held securely in escrow</li>
            <li>🔄 Automatic refunds when outbid</li>
            <li>📜 Transparent bid history on blockchain</li>
          </ul>
        </div>
        <div className="feature">
          <h3>For Sellers</h3>
          <ul>
            <li>💸 Guaranteed payment upon auction completion</li>
            <li>⏱️ Funds automatically released when you end auction</li>
            <li>🛡️ Protection against non-payment</li>
          </ul>
        </div>
        <div className="feature">
          <h3>Security</h3>
          <ul>
            <li>🛡️ Reentrancy protection</li>
            <li>📊 All transactions verifiable on blockchain</li>
            <li>⚡ Gas-efficient operations</li>
          </ul>
        </div>
      </div>
      <div className="process-flow">
        <h3>Escrow Process Flow</h3>
        <ol>
          <li>1. Bidder places bid with ETH</li>
          <li>2. ETH held in escrow by smart contract</li>
          <li>3. If outbid, previous bidder can withdraw refund</li>
          <li>4. When auction ends, winner's ETH goes to seller</li>
          <li>5. All other bidders can withdraw their funds</li>
        </ol>
      </div>
    </div>
  );
};

export default EscrowExplanation;