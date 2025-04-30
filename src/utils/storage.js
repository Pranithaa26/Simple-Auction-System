export const getAuctionsFromLocal = () => {
  const auctions = localStorage.getItem('auctions');
  return auctions ? JSON.parse(auctions) : [];
};

export const saveAuctionsToLocal = (auctions) => {
  localStorage.setItem('auctions', JSON.stringify(auctions));
};

export const clearAuctionsFromLocal = () => {
  localStorage.removeItem('auctions');
};