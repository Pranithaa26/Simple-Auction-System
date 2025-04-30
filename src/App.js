import React, { useState, useEffect, useCallback, useRef, Component } from 'react';
// Import components for the UI structure
import Header from './components/Header';
import AuctionList from './components/AuctionList';
import Hero from './components/Hero';
import CreateAuctionModal from './components/CreateAuctionModal';
import BidModal from './components/BidModal';
import HowItWorks from './components/HowItWorks';
import Newsletter from './components/Newsletter';
import Footer from './components/Footer';
import EscrowExplanation from './components/EscrowExplanation';
import MyAuctions from './components/MyAuctions';
import MyBids from './components/MyBids';
// Import utility functions for local storage management
import { getAuctionsFromLocal, saveAuctionsToLocal } from './utils/storage';
// Import Web3 library for Ethereum blockchain interaction
import Web3 from 'web3';
// Import contract ABIs for interacting with deployed smart contracts
import auctionFactoryABI from './contracts/AuctionFactory.json';
import auctionABI from './contracts/Auction.json';
// Import CSS for styling
import './styles/app.css';

// ErrorBoundary class to catch and display JavaScript errors in the UI
class ErrorBoundary extends Component {
  state = { hasError: false, error: null }; // State to track errors

  // Static method to update state when an error is caught
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h1>Something went wrong.</h1>
          <p>{this.state.error?.message}</p> {/* Display error message */}
        </div>
      );
    }
    return this.props.children; // Render children if no error
  }
}

// Main App component
function App() {
  const [auctions, setAuctions] = useState([]); // State to store all auction data
  const [showModal, setShowModal] = useState(false); // State to control CreateAuctionModal visibility
  const [showBidModal, setShowBidModal] = useState(false); // State to control BidModal visibility
  const [showMyAuctions, setShowMyAuctions] = useState(false); // State to control MyAuctions visibility
  const [showMyBids, setShowMyBids] = useState(false); // State to control MyBids visibility
  const [selectedAuction, setSelectedAuction] = useState(null); // State to store the currently selected auction
  const [walletConnected, setWalletConnected] = useState(false); // State to track wallet connection status
  const [walletAddress, setWalletAddress] = useState(null); // State to store the connected wallet address
  const [web3, setWeb3] = useState(null); // State to store the Web3 instance
  const [factoryContract, setFactoryContract] = useState(null); // State to store the AuctionFactory contract instance
  const [isLoading, setIsLoading] = useState(false); // State to manage loading indicator
  const [myAuctions, setMyAuctions] = useState([]); // State to store auctions created by the user
  const [myBids, setMyBids] = useState([]); // State to store bids placed by the user
  const [notifications, setNotifications] = useState([]); // State to manage notification messages
  const factoryAddress = '0xb84D388f53aC050744f764a39dbC0FA10b36315F'; // Address of the deployed AuctionFactory contract

  const processedAuctions = useRef(new Set()); // Ref to track processed auction IDs to avoid duplicates
  const tabId = useRef(`${Date.now()}-${Math.random().toString(36).substring(2)}`); // Unique tab ID for local storage
  const eventListeners = useRef({ auctionListeners: [] }); // Ref to manage event listeners

  // Function to add notifications with a 5-second auto-dismiss
  const addNotification = (message, type = 'info') => {
    const newNotification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString(),
    };
    setNotifications((prev) => [newNotification, ...prev.slice(0, 4)]); // Limit to 5 notifications
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== newNotification.id));
    }, 5000);
  };

  // Load stored wallet address and auctions on mount
  useEffect(() => {
    const storedAddress = localStorage.getItem(`walletAddress_${tabId.current}`);
    if (storedAddress) {
      setWalletAddress(storedAddress);
      setWalletConnected(true);
    }
    const storedAuctions = getAuctionsFromLocal();
    if (storedAuctions.length) {
      setAuctions(storedAuctions);
      storedAuctions.forEach((a) => processedAuctions.current.add(a.id));
    }
  }, []);

  // Initialize Web3 and factory contract when wallet is connected
  useEffect(() => {
    if (walletConnected && !web3 && walletAddress) {
      const web3Instance = new Web3(window.ethereum);
      setWeb3(web3Instance);
      const factory = new web3Instance.eth.Contract(auctionFactoryABI.abi, factoryAddress);
      setFactoryContract(factory);
    }
  }, [walletConnected, walletAddress]);

  // Fetch auction data and setup event listeners when dependencies are ready
  useEffect(() => {
    if (walletConnected && web3 && factoryContract && walletAddress) {
      fetchAuctionData();
      setupEventListeners();
    }
    return () => {
      cleanupEventListeners(); // Cleanup listeners on unmount
    };
  }, [walletConnected, web3, factoryContract, walletAddress]);

  // Update auction timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setAuctions((prev) => {
        const updated = prev.map((auction) => {
          const now = Math.floor(Date.now() / 1000);
          const timeLeft = Math.max(0, auction.endTime - now); // Calculate time left
          const confirmTimeLeft = auction.confirmationDeadline > 0 ? Math.max(0, auction.confirmationDeadline - now) : 0; // Calculate confirmation deadline
          return { ...auction, timeLeft, confirmTimeLeft };
        });
        console.log('Timer update:', updated.map(a => ({ id: a.id, name: a.name, timeLeft: a.timeLeft, endTime: a.endTime })));
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll for auction data every 5 seconds when connected
  useEffect(() => {
    if (walletConnected && web3 && factoryContract && walletAddress) {
      const pollInterval = setInterval(() => {
        fetchAuctionData();
      }, 5000);
      return () => clearInterval(pollInterval);
    }
  }, [walletConnected, web3, factoryContract, walletAddress]);

  // Parse time input into seconds (e.g., "2m" -> 120, "1h" -> 3600)
  const parseTime = (input) => {
    if (!input) return 60; // Default to 60 seconds if no input
    const cleanInput = input.toString().replace(/\s+/g, '').toLowerCase();
    let totalSeconds = 0;
    const hoursMatch = cleanInput.match(/(\d+)h/);
    const minutesMatch = cleanInput.match(/(\d+)m/);
    const secondsMatch = cleanInput.match(/(\d+)s/);
    if (hoursMatch) totalSeconds += parseInt(hoursMatch[1]) * 3600;
    if (minutesMatch) totalSeconds += parseInt(minutesMatch[1]) * 60;
    if (secondsMatch) totalSeconds += parseInt(secondsMatch[1]);
    if (totalSeconds === 0 && !isNaN(parseInt(cleanInput))) {
      totalSeconds = parseInt(cleanInput) * 60; // Treat plain number as minutes
    }
    return totalSeconds > 0 ? totalSeconds : 60;
  };

  // Fetch auction details from an event or address
  const addAuctionFromEvent = useCallback(
    async (address, web3Instance = web3) => {
      try {
        console.log(`Loading auction details for address: ${address}`);
        const auction = new web3Instance.eth.Contract(auctionABI.abi, address);
        const details = await auction.methods.getAuctionDetails().call({ from: walletAddress });
        const bidHistory = await auction.methods.getBidHistory().call();
        console.log(`Auction details for ${address}:`, {
          name: details.name,
          creator: details.creator,
          endTime: details.endTime_,
          isEnded: details.isEnded,
          highestBidder: details.currentWinner,
          highestBid: details.currentBid,
          itemConfirmed: details.isItemConfirmed,
          disputed: details.isDisputed,
          itemStatus: details.itemStatus_,
          bidHistory,
        });

        const now = Math.floor(Date.now() / 1000);
        const newAuction = {
          id: address,
          name: details.name || 'Unnamed Auction',
          startingBid: web3Instance.utils.fromWei(details.startBid, 'ether'),
          endTime: parseInt(details.endTime_),
          timeLeft: Math.max(0, details.endTime_ - now),
          seller: details.creator,
          highestBid: web3Instance.utils.fromWei(details.currentBid, 'ether'),
          highestBidder: details.currentWinner,
          bidHistory: bidHistory.map((bid) => ({
            bidder: bid.bidder,
            amount: web3Instance.utils.fromWei(bid.amount, 'ether'),
            timestamp: parseInt(bid.timestamp),
          })),
          ended: details.isEnded,
          itemConfirmed: details.isItemConfirmed,
          disputed: details.isDisputed,
          confirmationDeadline: parseInt(details.confirmDeadline),
          confirmTimeLeft: details.confirmDeadline > 0 ? Math.max(0, details.confirmDeadline - now) : 0,
          itemStatus: ['WithSeller', 'WithBidder', 'Disputed'][details.itemStatus_],
          category: 'art',
          image: '',
        };

        console.log(`New auction object for ${address}:`, newAuction);
        return newAuction;
      } catch (err) {
        console.error(`Error loading auction ${address}:`, err.message, err.stack);
        return null;
      }
    },
    [web3, walletAddress]
  );

  // Fetch all auction data with retry logic
  const fetchAuctionData = useCallback(
    async (retries = 3) => {
      if (!web3 || !factoryContract || !walletAddress) {
        console.log('Skipping fetch: missing web3, factoryContract, or walletAddress');
        return;
      }

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          setIsLoading(true);
          console.log(`Fetching auctions from factory (attempt ${attempt}):`, factoryAddress);
          const addresses = await factoryContract.methods.getAllAuctions().call({ from: walletAddress });
          console.log('Auction addresses:', addresses);

          const newAuctions = [];
          for (const addr of addresses) {
            console.log(`Fetching details for auction: ${addr}`);
            const auction = await addAuctionFromEvent(addr);
            if (auction) {
              console.log(`Added/Updated auction: ${auction.id}`, auction);
              newAuctions.push(auction);
              processedAuctions.current.add(addr);
            } else {
              console.log(`Failed to add auction: ${addr}`);
            }
          }

          console.log('New auctions:', newAuctions);
          setAuctions((prev) => {
            const mergedAuctions = [...prev.filter((a) => !newAuctions.some((n) => n.id === a.id)), ...newAuctions];
            saveAuctionsToLocal(mergedAuctions);
            console.log('Merged auctions state:', mergedAuctions);

            setMyAuctions(
              walletAddress
                ? mergedAuctions.filter((a) => a.seller.toLowerCase() === walletAddress.toLowerCase())
                : []
            );
            setMyBids(
              walletAddress
                ? mergedAuctions
                    .flatMap((a) => a.bidHistory.map((bid) => ({ auctionId: a.id, ...bid })))
                    .filter((bid) => bid.bidder.toLowerCase() === walletAddress.toLowerCase())
                : []
            );

            return mergedAuctions;
          });

          console.log('Updated state - auctions:', auctions, 'myAuctions:', myAuctions, 'myBids:', myBids);
          return;
        } catch (err) {
          console.error(`Error fetching auction data (attempt ${attempt}):`, err.message, err.stack);
          if (attempt < retries) {
            const delay = 1000 * Math.pow(2, attempt);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            addNotification(`Failed to fetch auction data after ${retries} attempts: ${err.message}`, 'error');
          }
        } finally {
          setIsLoading(false);
        }
      }
    },
    [web3, factoryContract, walletAddress, addAuctionFromEvent]
  );

  // Setup event listeners for contract events
  const setupEventListeners = useCallback(() => {
    if (!web3 || !factoryContract || eventListeners.current.setup) return;

    console.log('Setting up event listeners for factory:', factoryAddress);
    const auctionCreatedListener = factoryContract.events.AuctionCreated({}, (error, event) => {
      if (error) {
        console.error('AuctionCreated event error:', error);
      } else {
        console.log('AuctionCreated event:', event.returnValues);
        addNotification(`New auction created: ${event.returnValues.itemName}`, 'info');
        setTimeout(fetchAuctionData, 1000);
      }
    });

    eventListeners.current = {
      setup: true,
      factoryListener: auctionCreatedListener,
      auctionListeners: [],
    };

    const updateAuctionListeners = () => {
      const newAuctionListeners = auctions.map((auction) => {
        if (eventListeners.current.auctionListeners.some((l) => l.contract.options.address === auction.id)) {
          return null; // Skip if listener already exists
        }

        const contract = new web3.eth.Contract(auctionABI.abi, auction.id);
        console.log(`Setting up listeners for auction: ${auction.id}`);

        const newBidListener = contract.events.NewHighestBid({}, (error, event) => {
          if (error) return console.error('NewHighestBid error:', error);
          const isOurBid = event.returnValues.bidder.toLowerCase() === walletAddress?.toLowerCase();
          if (isOurBid) {
            addNotification(`You are now the highest bidder on ${auction.name}!`, 'success');
          }
          fetchAuctionData();
        });

        const bidRefundedListener = contract.events.BidRefunded({}, (error, event) => {
          if (error) return console.error('BidRefunded error:', error);
          if (event.returnValues.bidder.toLowerCase() === walletAddress?.toLowerCase()) {
            console.log('BidRefunded event:', {
              bidder: event.returnValues.bidder,
              amount: web3.utils.fromWei(event.returnValues.amount, 'ether'),
              txHash: event.transactionHash,
            });
            addNotification(
              `You were outbid on ${auction.name}! Refunded ${web3.utils.fromWei(event.returnValues.amount, 'ether')} ETH.`,
              'warning'
            );
          }
          fetchAuctionData();
        });

        const auctionEndedListener = contract.events.AuctionEnded({}, (error, event) => {
          if (error) return console.error('AuctionEnded error:', error);
          if (walletAddress?.toLowerCase() === auction.seller.toLowerCase()) {
            addNotification(`Your auction "${auction.name}" has ended! Waiting for buyer confirmation.`, 'info');
          }
          if (walletAddress?.toLowerCase() === event.returnValues.winner.toLowerCase()) {
            addNotification(`You won "${auction.name}"! Please confirm receipt within 7 days.`, 'success');
          }
          fetchAuctionData();
        });

        const itemConfirmedListener = contract.events.ItemConfirmed({}, (error) => {
          if (error) return console.error('ItemConfirmed error:', error);
          if (walletAddress?.toLowerCase() === auction.seller.toLowerCase()) {
            addNotification(`Buyer confirmed receipt for "${auction.name}". Funds released!`, 'success');
          }
          fetchAuctionData();
        });

        const disputeInitiatedListener = contract.events.DisputeInitiated({}, (error) => {
          if (error) return console.error('DisputeInitiated error:', error);
          if (walletAddress?.toLowerCase() === auction.seller.toLowerCase()) {
            addNotification(`A dispute was initiated for "${auction.name}". Please resolve it.`, 'warning');
          }
          fetchAuctionData();
        });

        const fundsReleasedListener = contract.events.FundsReleased({}, (error, event) => {
          if (error) return console.error('FundsReleased error:', error);
          console.log('FundsReleased event:', {
            recipient: event.returnValues.recipient,
            amount: web3.utils.fromWei(event.returnValues.amount, 'ether'),
            txHash: event.transactionHash,
            auction: auction.name,
          });
          if (walletAddress?.toLowerCase() === event.returnValues.recipient.toLowerCase()) {
            addNotification(`Received ${web3.utils.fromWei(event.returnValues.amount, 'ether')} ETH for "${auction.name}"!`, 'success');
          }
          fetchAuctionData();
        });

        const transactionLoggedListener = contract.events.TransactionLogged({}, (error, event) => {
          if (error) return console.error('TransactionLogged error:', error);
          console.log('TransactionLogged event:', {
            recipient: event.returnValues.recipient,
            amount: web3.utils.fromWei(event.returnValues.amount, 'ether'),
            txHash: event.returnValues.txHash,
          });
          if (event.returnValues.recipient.toLowerCase() === walletAddress?.toLowerCase()) {
            addNotification(`Transaction of ${web3.utils.fromWei(event.returnValues.amount, 'ether')} ETH recorded for "${auction.name}"`, 'info');
          }
        });

        return {
          contract,
          listeners: [
            newBidListener,
            bidRefundedListener,
            auctionEndedListener,
            itemConfirmedListener,
            disputeInitiatedListener,
            fundsReleasedListener,
            transactionLoggedListener,
          ],
        };
      }).filter((listener) => listener !== null);

      eventListeners.current.auctionListeners = [
        ...(eventListeners.current.auctionListeners || []),
        ...newAuctionListeners,
      ];
    };

    updateAuctionListeners();
    const auctionUpdateInterval = setInterval(updateAuctionListeners, 5000);

    return () => clearInterval(auctionUpdateInterval);
  }, [web3, factoryContract, walletAddress, auctions, fetchAuctionData]);

  // Cleanup event listeners
  const cleanupEventListeners = useCallback(() => {
    console.log('Cleaning up event listeners');
    if (eventListeners.current.factoryListener) {
      eventListeners.current.factoryListener.unsubscribe();
    }
    if (Array.isArray(eventListeners.current.auctionListeners)) {
      eventListeners.current.auctionListeners.forEach(({ listeners }) => {
        listeners.forEach((listener) => {
          try {
            listener.unsubscribe();
          } catch (err) {
            console.error('Error removing listener:', err);
          }
        });
      });
    }
    eventListeners.current = { auctionListeners: [] };
  }, []);

  // Wait for transaction confirmation with retries
  const waitForTransaction = async (txHash, retries = 5, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const receipt = await web3.eth.getTransactionReceipt(txHash);
        if (receipt) {
          console.log('Transaction receipt:', receipt);
          return receipt;
        }
      } catch (err) {
        console.error(`Error fetching receipt for ${txHash}:`, err);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw new Error(`Transaction ${txHash} not confirmed after ${retries} attempts`);
  };

  // Handle creation of a new auction
  const addAuction = async ({ name, startingBid, timeInput }) => {
    if (!walletConnected || !factoryContract) return;

    try {
      const duration = parseTime(timeInput);
      const startingBidWei = web3.utils.toWei(startingBid.toString(), 'ether');

      console.log(`Creating auction: ${name}, ${startingBidWei} wei, ${duration} seconds`);
      const tx = await factoryContract.methods
        .createAuction(name, startingBidWei, duration)
        .send({ from: walletAddress, gas: 3000000 });
      console.log('Auction creation transaction:', tx);

      addNotification(`Auction "${name}" created successfully!`, 'success');
      setShowModal(false);
      setTimeout(fetchAuctionData, 500);
    } catch (err) {
      console.error('Auction creation failed:', err);
      addNotification(`Failed to create auction: ${err.message}`, 'error');
    }
  };

  // Handle placing a bid on an auction
  const handleBidUpdate = async (auctionId, bidAmount) => {
    if (!walletConnected || !auctionId || !bidAmount) return;

    try {
      const auction = new web3.eth.Contract(auctionABI.abi, auctionId);
      const currentBid = await auction.methods.highestBid().call();
      const minBid = parseFloat(web3.utils.fromWei(currentBid, 'ether')) + 0.1;

      if (parseFloat(bidAmount) < minBid) {
        addNotification(`Bid must be at least ${minBid.toFixed(2)} ETH`, 'error');
        return;
      }

      const value = web3.utils.toWei(bidAmount.toString(), 'ether');
      console.log(`Placing bid on ${auctionId}: ${bidAmount} ETH`);
      const tx = await auction.methods.placeBid().send({
        from: walletAddress,
        value,
        gas: 5000000,
      });
      console.log('Bid transaction:', tx);

      await waitForTransaction(tx.transactionHash);
      const updatedAuction = await addAuctionFromEvent(auctionId);
      if (updatedAuction) {
        addNotification(`Bid of ${bidAmount} ETH placed on ${updatedAuction.name}!`, 'success');
      }

      setShowBidModal(false);
      setTimeout(fetchAuctionData, 500);
    } catch (err) {
      console.error('Bid failed:', err);
      addNotification(`Bid failed: ${err.message}`, 'error');
    }
  };

  // Handle ending an auction
  const handleEndAuction = async (auctionId) => {
    if (!walletConnected) return;

    try {
      const auction = new web3.eth.Contract(auctionABI.abi, auctionId);
      console.log(`Ending auction: ${auctionId}`);
      const tx = await auction.methods.endAuction().send({ from: walletAddress, gas: 3000000 });
      console.log('End auction transaction:', tx);

      await waitForTransaction(tx.transactionHash);
      addNotification('Auction ended successfully! Waiting for buyer confirmation.', 'success');
      setTimeout(fetchAuctionData, 500);
    } catch (err) {
      console.error('End auction failed:', err);
      addNotification(`Failed to end auction: ${err.message}`, 'error');
    }
  };

  // Handle confirming receipt of an item
  const handleConfirmReceipt = async (auctionId) => {
    if (!walletConnected) return;

    try {
      const auction = new web3.eth.Contract(auctionABI.abi, auctionId);
      console.log(`Confirming receipt for auction: ${auctionId}, seller: ${auction.seller}`);
      const tx = await auction.methods.confirmReceipt().send({ from: walletAddress, gas: 6000000 });
      console.log('Confirm receipt transaction:', tx);

      await waitForTransaction(tx.transactionHash);
      addNotification('Item receipt confirmed! Funds released to seller.', 'success');
      setTimeout(fetchAuctionData, 500);
    } catch (err) {
      console.error('Confirm receipt failed:', err);
      addNotification(`Failed to confirm receipt: ${err.message}`, 'error');
    }
  };

  // Handle initiating a dispute
  const handleInitiateDispute = async (auctionId) => {
    if (!walletConnected) return;

    try {
      const auction = new web3.eth.Contract(auctionABI.abi, auctionId);
      console.log(`Initiating dispute for auction: ${auctionId}`);
      const tx = await auction.methods.initiateDispute().send({ from: walletAddress, gas: 3000000 });
      console.log('Initiate dispute transaction:', tx);

      await waitForTransaction(tx.transactionHash);
      addNotification('Dispute initiated successfully!', 'success');
      setTimeout(fetchAuctionData, 500);
    } catch (err) {
      console.error('Initiate dispute failed:', err);
      addNotification(`Failed to initiate dispute: ${err.message}`, 'error');
    }
  };

  // Handle resolving a dispute (NOTE: This function lacks permission checks, causing the bidder issue)
  const handleResolveDispute = async (auctionId, awardToSeller) => {
    if (!walletConnected) return;

    try {
      const auction = new web3.eth.Contract(auctionABI.abi, auctionId);
      console.log(`Resolving dispute for auction: ${awardToSeller ? 'seller' : 'bidder'}`);
      const tx = await auction.methods.resolveDispute(awardToSeller).send({ from: walletAddress, gas: 3000000 });
      console.log('Resolve dispute transaction:', tx);

      await waitForTransaction(tx.transactionHash);
      addNotification(
        `Dispute resolved successfully! Funds ${awardToSeller ? 'awarded to seller' : 'refunded to bidder'}.`,
        'success'
      );
      setTimeout(fetchAuctionData, 500);
    } catch (err) {
      console.error('Resolve dispute failed:', err);
      addNotification(`Failed to resolve dispute: ${err.message}`, 'error');
    }
  };

  // Connect to MetaMask wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      addNotification('Please install MetaMask.', 'error');
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts.length) return;

      localStorage.setItem(`walletAddress_${tabId.current}`, accounts[0]);
      setWalletAddress(accounts[0]);
      setWalletConnected(true);

      window.ethereum.on('accountsChanged', (newAccounts) => {
        if (!newAccounts.length) {
          disconnectWallet();
        } else {
          localStorage.setItem(`walletAddress_${tabId.current}`, newAccounts[0]);
          setWalletAddress(newAccounts[0]);
        }
      });

      addNotification('Wallet connected!', 'success');
    } catch (err) {
      console.error('Connection failed:', err);
      addNotification(`Wallet connection failed: ${err.message}`, 'error');
    }
  };

  // Disconnect wallet and cleanup
  const disconnectWallet = () => {
    cleanupEventListeners();
    setWalletConnected(false);
    setWalletAddress(null);
    setWeb3(null);
    setFactoryContract(null);
    setMyAuctions([]);
    setMyBids([]);
    localStorage.removeItem(`walletAddress_${tabId.current}`);
    addNotification('Wallet disconnected', 'info');
  };

  // Open bid modal for a selected auction
  const openBidModal = (auction) => {
    setSelectedAuction(auction);
    setShowBidModal(true);
  };

  // Close all modals
  const closeModals = () => {
    setShowModal(false);
    setShowBidModal(false);
    setShowMyAuctions(false);
    setShowMyBids(false);
  };

  return (
    <ErrorBoundary>
      <div className="app-container">
        <Header
          onWalletConnect={connectWallet}
          onDisconnect={disconnectWallet}
          walletConnected={walletConnected}
          walletAddress={walletAddress}
          myAuctions={myAuctions}
          myBids={myBids}
          onCreateClick={() => setShowModal(true)}
          onMyAuctionsClick={() => setShowMyAuctions(true)}
          onMyBidsClick={() => setShowMyBids(true)}
          onRefresh={fetchAuctionData}
        />
        <Hero />
        {isLoading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
          </div>
        )}
        <AuctionList
          auctions={auctions}
          onBid={openBidModal}
          onEndAuction={handleEndAuction}
          onConfirmReceipt={handleConfirmReceipt}
          onInitiateDispute={handleInitiateDispute}
          onResolveDispute={handleResolveDispute}
          walletAddress={walletAddress}
        />
        {showModal && <CreateAuctionModal onClose={closeModals} onCreate={addAuction} />}
        {showBidModal && selectedAuction && (
          <BidModal auction={selectedAuction} onClose={closeModals} onBid={handleBidUpdate} />
        )}
        {showMyAuctions && <MyAuctions auctions={myAuctions} onClose={closeModals} />}
        {showMyBids && <MyBids bids={myBids} auctions={auctions} onClose={closeModals} />}
        <div className="notifications">
          {notifications.map((notification) => (
            <div key={notification.id} className={`notification ${notification.type}`}>
              {notification.message}
            </div>
          ))}
        </div>
        <HowItWorks />
      </div>
    </ErrorBoundary>
  );
}

export default App;