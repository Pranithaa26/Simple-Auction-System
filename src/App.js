import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import AuctionList from './components/AuctionList';
import Hero from './components/Hero';
import CreateAuctionModal from './components/CreateAuctionModal';
import HowItWorks from './components/HowItWorks';
import Newsletter from './components/Newsletter';
import Footer from './components/Footer';
import { getAuctionsFromLocal, saveAuctionsToLocal } from './utils/storage';
import Web3 from 'web3';
import auctionFactoryABI from './contracts/AuctionFactory.json';
import auctionABI from './contracts/Auction.json';
import './styles/app.css';

function App() {
  const [auctions, setAuctions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [web3, setWeb3] = useState(null);
  const [factoryContract, setFactoryContract] = useState(null);
  const factoryAddress = 'NEW_ADDRESS'; // Replace with new address from migration

  const isListenerSetup = useRef(false);

  const addAuctionFromEvent = useCallback(async (address, web3Instance = web3) => {
    try {
      const auction = new web3Instance.eth.Contract(auctionABI.abi, address);
      const [name, startingBid, endTime, seller, highestBid, highestBidder] = await Promise.all([
        auction.methods.itemName().call(),
        auction.methods.startingBid().call(),
        auction.methods.endTime().call(),
        auction.methods.auctionCreator().call(), // Updated to match contract
        auction.methods.highestBid().call(),
        auction.methods.highestBidder().call()
      ]);
      const now = Math.floor(Date.now() / 1000);
      const timeLeft = Math.max(0, endTime - now);
      const newAuction = {
        id: address,
        name,
        startingBid: web3Instance.utils.fromWei(startingBid, 'ether'),
        endTime: parseInt(endTime),
        timeLeft,
        seller,
        highestBid: web3Instance.utils.fromWei(highestBid, 'ether'),
        highestBidder,
        category: 'art',
        image: '' // Placeholder; update with IPFS URL in production
      };

      setAuctions(prev => {
        if (prev.some(a => a.id === address)) return prev;
        const updated = [...prev, newAuction];
        saveAuctionsToLocal(updated);
        console.log("Updated auctions state:", updated);
        return updated;
      });
    } catch (err) {
      console.error("Error loading auction:", address, {
        message: err.message,
        code: err.code,
        data: err.data,
        stack: err.stack
      });
    }
  }, [web3]);

  useEffect(() => {
    const stored = getAuctionsFromLocal();
    if (stored.length) {
      console.log("Loaded stored auctions:", stored);
      setAuctions(stored);
    }
  }, []);

  useEffect(() => {
    if (!isListenerSetup.current && walletConnected && web3 && factoryContract) {
      console.log("Setting up event listener for AuctionCreated...");
      factoryContract.events.AuctionCreated({ fromBlock: 'latest' })
        .on('data', async event => {
          console.log("New auction created event:", event);
          const auctionAddress = event.returnValues.auctionAddress; // Updated to match event
          await addAuctionFromEvent(auctionAddress, web3);
        })
        .on('error', err => {
          console.error("Event listener error:", {
            message: err.message,
            code: err.code,
            data: err.data,
            stack: err.stack
          });
        });
      isListenerSetup.current = true;
    }
  }, [walletConnected, web3, factoryContract, addAuctionFromEvent]);

  const fetchAuctionData = async (web3Instance = web3, factory = factoryContract, caller = walletAddress) => {
    if (!web3Instance || !factory || !caller) {
      console.warn("Web3, factory contract, or caller not initialized.");
      return;
    }
    try {
      console.log("Fetching auction data from factory at:", factory._address);
      console.log("Caller address:", caller);
      const chainId = await web3Instance.eth.getChainId();
      console.log("Current chain ID:", chainId);
      const addresses = await factory.methods.getAllAuctions().call({ from: caller });
      console.log("Fetched auction addresses:", addresses);
      setAuctions([]);
      if (Array.isArray(addresses) && addresses.length > 0) {
        for (const addr of addresses) {
          await addAuctionFromEvent(addr, web3Instance);
        }
      } else {
        console.log("No auctions found or getAllAuctions returned invalid data.");
      }
    } catch (err) {
      console.error("Error fetching auctions:", {
        message: err.message,
        code: err.code,
        data: err.data,
        stack: err.stack
      });
    }
  };

  const parseTime = input => {
    if (!input) return 0;
    const regex = /(?:(\d+(?:[.,]\d+)?)h)?\s*(?:(\d+(?:[.,]\d+)?)m)?\s*(?:(\d+(?:[.,]\d+)?)s)?/i;
    const match = input.match(regex);
    if (!match) return 0;
    const [ , h, m, s ] = match.map(x => parseFloat(x) || 0);
    return Math.floor(h * 3600 + m * 60 + s);
  };

  const addAuction = async ({ name, startingBid, image, timeInput }) => {
    if (!walletConnected || !factoryContract) {
      alert("Connect wallet first.");
      return;
    }
    try {
      console.log("Creating auction with:", { name, startingBid, image, timeInput });
      const chainId = await web3.eth.getChainId();
      console.log("Current chain ID:", chainId);
      if (chainId !== 1337) {
        alert("Please switch MetaMask to the Ganache network (Chain ID: 1337).");
        return;
      }
      const duration = parseTime(timeInput);
      if (!duration) {
        alert("Enter valid duration (e.g., 1h 30m).");
        return;
      }
      const gasPrice = await web3.eth.getGasPrice();
      console.log("Gas Price:", web3.utils.fromWei(gasPrice, 'gwei'), "Gwei");
      const startingBidWei = web3.utils.toWei(startingBid.toString(), 'ether');
      console.log("Starting bid (Wei):", startingBidWei);
      console.log("Image URL (temporary):", image);
      const gasEstimate = await factoryContract.methods.createAuction(name, startingBidWei, duration).estimateGas({ from: walletAddress });
      console.log("Estimated gas:", gasEstimate);
      const tx = await factoryContract.methods.createAuction(name, startingBidWei, duration)
        .send({ from: walletAddress, gas: Math.floor(gasEstimate * 2), gasPrice });
      console.log("Transaction successful:", tx);
      await fetchAuctionData(web3, factoryContract, walletAddress);
    } catch (err) {
      console.error("Auction creation failed:", {
        message: err.message,
        code: err.code,
        data: err.data,
        stack: err.stack
      });
      alert(`Failed to create auction: ${err.message}. Check console.`);
    }
  };

  const handleBidUpdate = async (auctionId, bidAmount) => {
    if (!walletConnected) {
      alert("Connect wallet to bid.");
      return;
    }
    try {
      console.log("Placing bid on auction:", auctionId, "with amount:", bidAmount);
      const auction = new web3.eth.Contract(auctionABI.abi, auctionId);
      const current = await auction.methods.highestBid().call();
      const value = web3.utils.toWei(bidAmount.toString(), 'ether');
      console.log("Current highest bid (Wei):", current, "New bid (Wei):", value);
      if (parseFloat(value) <= parseFloat(current)) {
        alert("Bid must be higher than current.");
        return;
      }
      const gasPrice = await web3.eth.getGasPrice();
      const gasEstimate = await auction.methods.placeBid().estimateGas({ from: walletAddress, value });
      const tx = await auction.methods.placeBid().send({ from: walletAddress, value, gas: Math.floor(gasEstimate * 2), gasPrice });
      console.log("Bid transaction successful:", tx);
      await addAuctionFromEvent(auctionId);
    } catch (err) {
      console.error("Bid failed:", {
        message: err.message,
        code: err.code,
        data: err.data,
        stack: err.stack
      });
      alert("Failed to bid. See console.");
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      console.error("MetaMask not detected. Please install MetaMask or check if it's enabled.");
      alert("MetaMask not detected. Please install MetaMask.");
      return;
    }
    try {
      console.log("Attempting to connect wallet...");
      const web3Instance = new Web3(window.ethereum);
      const chainId = await web3Instance.eth.getChainId();
      console.log("Detected chain ID:", chainId);
      if (chainId !== 1337) {
        alert("Please switch MetaMask to the Ganache network (Chain ID: 1337).");
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x539' }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x539',
                chainName: 'Ganache',
                rpcUrls: ['http://127.0.0.1:8545'],
                nativeCurrency: { name: 'Ganache ETH', symbol: 'ETH', decimals: 18 },
              }],
            });
          } else {
            throw switchError;
          }
        }
        return;
      }

      console.log("Requesting accounts from MetaMask...");
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      console.log("Received accounts:", accounts);

      setWeb3(web3Instance);
      setWalletAddress(accounts[0]);
      setWalletConnected(true);

      const factory = new web3Instance.eth.Contract(auctionFactoryABI.abi, factoryAddress);
      console.log("Factory initialized at:", factoryAddress);
      setFactoryContract(factory);

      const stored = getAuctionsFromLocal();
      if (stored.length) {
        console.log("Loaded stored auctions:", stored);
        setAuctions(stored);
      }

      try {
        console.log("Fetching auctions...");
        const addresses = await factory.methods.getAllAuctions().call({ from: accounts[0] });
        console.log("Fetched auction addresses:", addresses);
        setAuctions([]);
        if (Array.isArray(addresses) && addresses.length > 0) {
          for (const addr of addresses) {
            await addAuctionFromEvent(addr, web3Instance);
          }
        } else {
          console.log("No auctions found or getAllAuctions returned invalid data.");
        }
      } catch (err) {
        console.error("Failed to fetch auctions, continuing with connection:", {
          message: err.message,
          code: err.code,
          data: err.data,
          stack: err.stack
        });
      }
    } catch (err) {
      console.error("Wallet connection failed:", {
        message: err.message,
        code: err.code,
        data: err.data,
        stack: err.stack
      });
      alert(`Failed to connect wallet: ${err.message}. Check console for details.`);
    }
  };

  return (
    <>
      <Header
        onWalletConnect={connectWallet}
        onCreateClick={() => setShowModal(true)}
        walletConnected={walletConnected}
        walletAddress={walletAddress}
      />
      <Hero />
      <AuctionList auctions={auctions} onBid={handleBidUpdate} web3={web3} />
      {showModal && (
        <>
          <div className="modal-backdrop" onClick={() => setShowModal(false)} />
          <CreateAuctionModal
            onClose={() => setShowModal(false)}
            onCreate={addAuction}
            web3={web3}
            walletAddress={walletAddress}
          />
        </>
      )}
      <HowItWorks />
      <Newsletter />
      <Footer />
    </>
  );
}

export default App;