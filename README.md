Simple Auction System
Team : Hashers
Team Members:
Komma Pranitha - 230001040
Vanka Abhinaya Sri - 230003082
Alam Chathura - 230004004
Soha Shaik Sultana-230001071
J.Akhila - 2300041012
Reena Meena - 230003057

This repository contains a decentralized auction platform built using Solidity smart contracts and a React frontend. The application allows users to create auctions, place bids, confirm receipt, initiate disputes, and resolve them on the Ethereum blockchain.

Setup Instructions:
Prerequisites
Node.js: Ensure Node.js (v14 or later) is installed. Download from nodejs.org.
Truffle Suite: A development framework for Ethereum. Install globally via npm:npm install -g truffle


Ganache: A personal blockchain for Ethereum development. Install via Ganache GUI or CLI:npm install -g ganache-cli

Start Ganache with a custom configuration:ganache --networkId 1337 --gasLimit 20000000 --defaultBalanceEther 1000 --port 8545 --chain.hardfork london --blockTime 2 --db ./ganache-data


MetaMask: A browser extension for interacting with the Ethereum blockchain. Install from metamask.io.

Installation

Clone the Repository:
git clone https://github.com/yourusername/auction-dapp.git
cd auction-dapp


Install Dependencies:

For the smart contracts (Truffle project):cd contracts
npm install


For the frontend (React app):cd ../frontend
npm install




Configure MetaMask:

Connect MetaMask to the Ganache network (Localhost 8545).
Import Ganache accounts (use the private keys provided by Ganache).


Compile and Migrate Contracts:

In the contracts directory, compile and deploy the contracts:truffle compile
truffle migrate --network development --reset


Copy the generated ABIs to the frontend:cp build/contracts/AuctionFactory.json ../frontend/src/contracts/AuctionFactory.json
cp build/contracts/Auction.json ../frontend/src/contracts/Auction.json




Start the Application:

In the frontend directory, start the React app:npm start


Open http://localhost:3000 in your browser.



Troubleshooting

Ensure Ganache is running before starting the app.
If MetaMask connection fails, verify the network ID (1337) and RPC URL (http://localhost:8545).
Check console logs for contract deployment or transaction errors.

Explanation of Key Functions and Design Choices
Smart Contracts

Auction Contract:

Constructor: Initializes the auction with a creator, item name, starting bid, and duration. Validates inputs to prevent invalid setups.
placeBid: Allows users to bid, refunding the previous bidder if applicable. Uses a minimum increment (0.1 ETH) to ensure competitive bidding. Protected by nonReentrant to prevent reentrancy attacks.
endAuction: Only the creator can end the auction after the deadline, setting a 7-day confirmation period. This ensures the seller has control over the auction's conclusion.
confirmReceipt: The highest bidder confirms item receipt, transferring funds to the seller. Restricted to the bidder and requires the auction to be ended.
initiateDispute: The bidder can initiate a dispute within the confirmation period if the item isn’t received. This provides a safety net for buyers.
resolveDispute: Only the creator can resolve disputes, choosing to award funds to themselves or refund the bidder. The onlyCreator modifier ensures only the seller decides, reflecting a centralized dispute resolution design to simplify logic, though it could be enhanced with arbitration in the future.
Design Choice: The use of ReentrancyGuard and gas-aware .call for transfers prioritizes security. The ItemStatus enum and events (e.g., FundsReleased, DisputeInitiated) enable transparent state tracking.


AuctionFactory Contract:

createAuction: Deploys new Auction instances and stores their addresses. Open to all users, promoting accessibility.
getAllAuctions: Returns all auction addresses for frontend retrieval, supporting a dynamic auction list.
Design Choice: A simple factory pattern was chosen for ease of deployment and management. Future enhancements could include ownership restrictions or auction categorization.



Frontend (App.js)

connectWallet: Integrates with MetaMask to connect user accounts, storing the address locally for session persistence.
fetchAuctionData: Polls the blockchain every 5 seconds to update the auction list, ensuring real-time data with retry logic for reliability.
handleResolveDispute: Calls the resolveDispute function on the contract. Currently lacks creator validation, causing reverts when called by the bidder (e.g., transaction from 0xc18c6e3a01efae45e8e838a22b0503850e731a29 with status: false and gasUsed: 37249). This should be fixed by adding a check against auctionCreator.
Design Choice: The React app uses Web3.js for blockchain interaction and local storage for offline data. Event listeners (e.g., AuctionCreated, NewHighestBid) provide real-time updates, while notifications enhance user experience. The current dispute resolution flow assumes UI restriction, which needs alignment with the contract's onlyCreator modifier.

Key Design Choices

Security: ReentrancyGuard and gas-aware transfers mitigate common vulnerabilities. However, the lack of a withdrawal mechanism for stuck funds is a potential risk.
User Experience: Real-time updates via events and a 1-second timer for auction countdowns improve interactivity, though polling could be optimized with WebSocket subscriptions.
Dispute Resolution: Centralized to the creator for simplicity, but this could be a limitation. A decentralized arbitration system could be explored for fairness.
Scalability: The bidHistory array in the Auction contract may grow large, increasing gas costs. An off-chain solution or history pruning could be considered.

Future Improvements

Add creator validation in handleResolveDispute to match the onlyCreator modifier.
Implement a withdrawal function for stuck funds in the Auction contract.
Enhance the AuctionFactory with filtering or pausing capabilities.
Optimize gas usage by limiting bidHistory or moving it off-chain.

