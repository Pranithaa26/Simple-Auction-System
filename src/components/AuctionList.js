import React from 'react';
import AuctionCard from './AuctionCard';
import Categories from './Categories';

const AuctionList = ({ auctions, onBid, web3 }) => {
  const [currentCategory, setCurrentCategory] = React.useState('all');

  console.log("Rendering auctions:", auctions);

  const filteredAuctions = currentCategory === 'all'
    ? auctions
    : auctions.filter(auction => auction.category === currentCategory);

  return (
    <section className="section">
      <h2 className="section-title">Featured Auctions</h2>
      <Categories currentCategory={currentCategory} onCategoryChange={setCurrentCategory} />
      <div className="auction-grid">
        {filteredAuctions.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem' }}>
            <i className="fas fa-box-open" style={{ fontSize: '3rem', color: '#6c757d', marginBottom: '1rem' }}></i>
            <h3>No items found in this category</h3>
            <p>Check back later or explore other categories</p>
          </div>
        ) : (
          filteredAuctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} onBid={onBid} web3={web3} />
          ))
        )}
      </div>
    </section>
  );
};

export default AuctionList;