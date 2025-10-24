'use client';

/**
 * NFT Marketplace Page
 * Browse, buy, and sell NFTs with smart contract integration
 */

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../../context/WalletContext';
import { 
  getMarketplaceListings
} from '../../utils/marketplaceClient';
import { getNFTMetadata } from '../../utils/nftUtils';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

const MarketplacePage = () => {
  const { isConnected, accountId } = useWallet();
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters and sorting
  const [priceFilter, setPriceFilter] = useState('all'); // all, low, medium, high
  const [typeFilter, setTypeFilter] = useState('all'); // all, fixed, auction
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, price-low, price-high
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [selectedListing, setSelectedListing] = useState(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  
  // Transaction states
  const [isTransacting, setIsTransacting] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerDuration, setOfferDuration] = useState('86400'); // 24 hours default
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  // Define applyFiltersAndSort before useEffect to avoid hoisting issues
  const applyFiltersAndSort = useCallback(() => {
    let filtered = [...listings];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(listing => 
        listing.metadata.name.toLowerCase().includes(query) ||
        listing.metadata.description.toLowerCase().includes(query) ||
        listing.seller.toLowerCase().includes(query)
      );
    }
    
    // Apply price filter
    if (priceFilter !== 'all') {
      filtered = filtered.filter(listing => {
        const price = parseFloat(listing.priceInHBAR || listing.price);
        switch (priceFilter) {
          case 'low': return price <= 10;
          case 'medium': return price > 10 && price <= 100;
          case 'high': return price > 100;
          default: return true;
        }
      });
    }
    
    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(listing => {
        // For now, we'll use a simple check based on metadata
        // You can enhance this based on your NFT categorization
        return listing.metadata.name.toLowerCase().includes(typeFilter.toLowerCase()) ||
               listing.metadata.description.toLowerCase().includes(typeFilter.toLowerCase());
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return parseFloat(a.priceInHBAR || a.price) - parseFloat(b.priceInHBAR || b.price);
        case 'price-high':
          return parseFloat(b.priceInHBAR || b.price) - parseFloat(a.priceInHBAR || a.price);
        case 'name':
          return a.metadata.name.localeCompare(b.metadata.name);
        case 'newest':
        default:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });
    
    setFilteredListings(filtered);
    
    // Reset pagination to first page when filters change
    setCurrentPage(1);
  }, [listings, priceFilter, typeFilter, sortBy, searchQuery]);

  useEffect(() => {
    loadMarketplaceListings();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  const loadMarketplaceListings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🏪 Loading marketplace listings...');
      
      // Fetch real listings using client-side utility
      const listings = await getMarketplaceListings(0, 100);
      
      // Process listings to include metadata from NFT contracts
      const processedListings = await Promise.all(
        listings.map(async (listing) => {
          try {
            console.log(`🔍 Fetching metadata for NFT ${listing.tokenAddress}:${listing.tokenId}`);
            
            let metadata = listing.metadata;
            
            // Try to fetch metadata from Mirror Node first (better for HTS NFTs)
            if (!metadata) {
              try {
                console.log(`🌐 Fetching NFT data from Mirror Node for ${listing.tokenAddress}:${listing.tokenId}`);
                
                // Fetch NFT data from Mirror Node
                const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
                const baseUrl = network === 'mainnet'
                  ? 'https://mainnet.mirrornode.hedera.com'
                  : network === 'previewnet'
                    ? 'https://previewnet.mirrornode.hedera.com'
                    : 'https://testnet.mirrornode.hedera.com';

                const nftUrl = `${baseUrl}/api/v1/tokens/${listing.tokenAddress}/nfts/${listing.tokenId}`;
                console.log(`🌐 Fetching from Mirror Node: ${nftUrl}`);
                
                const nftResponse = await fetch(nftUrl);
                if (nftResponse.ok) {
                  const nftData = await nftResponse.json();
                  console.log(`📊 Mirror Node NFT data:`, nftData);
                  
                  // Process metadata from Mirror Node (same logic as nftUtils.js)
                  let metadataUrl = null;
                  
                  if (nftData.metadata) {
                    try {
                      // Try to decode base64 metadata
                      const decodedMetadata = atob(nftData.metadata);
                      console.log(`📋 Decoded metadata: ${decodedMetadata}`);
                      
                      if (decodedMetadata.includes('ipfs') || decodedMetadata.startsWith('http')) {
                        metadataUrl = decodedMetadata;
                        metadata = await getNFTMetadata(metadataUrl);
                      } else {
                        // Try parsing as JSON directly
                        metadata = JSON.parse(decodedMetadata);
                      }
                    } catch (decodeError) {
                      console.warn('Failed to decode metadata:', decodeError);
                      // If base64 decode fails, try as plain text
                      if (nftData.metadata.includes('ipfs') || nftData.metadata.startsWith('http')) {
                        metadataUrl = nftData.metadata;
                        metadata = await getNFTMetadata(metadataUrl);
                      }
                    }
                  }
                  
                  console.log(`✅ Processed metadata from Mirror Node:`, metadata);
                } else {
                  console.warn(`Mirror Node API error: ${nftResponse.status}`);
                }
                
              } catch (mirrorError) {
                console.warn(`Failed to fetch from Mirror Node for ${listing.tokenAddress}:${listing.tokenId}:`, mirrorError);
              }
            }
            
            // If still no metadata, try fetching from IPFS URL if provided
            if (!metadata && listing.metadataUrl) {
              metadata = await getNFTMetadata(listing.metadataUrl);
            }
            
            // Fallback metadata if none found
            if (!metadata) {
              metadata = {
                name: `AI NFT #${listing.tokenId}`,
                description: 'Unique AI-generated artwork minted on Hedera',
                image: '/placeholder-nft.png',
                attributes: [
                  { trait_type: 'Collection', value: 'AI Generated' },
                  { trait_type: 'Token ID', value: listing.tokenId },
                  { trait_type: 'Network', value: 'Hedera' }
                ]
              };
            }
            
            // Ensure image URL is properly formatted
            if (metadata.image && metadata.image.startsWith('ipfs://')) {
              const ipfsHash = metadata.image.replace('ipfs://', '');
              // Use Filebase IPFS gateway (or fallback to ipfs.io)
              metadata.image = `https://ipfs.filebase.io/ipfs/${ipfsHash}`;
            }
            
            console.log(`✅ Processed metadata for listing ${listing.id}:`, metadata);
            
            return {
              ...listing,
              metadata
            };
          } catch (error) {
            console.warn(`Failed to load metadata for listing ${listing.id}:`, error);
            return {
              ...listing,
              metadata: {
                name: `AI NFT #${listing.tokenId}`,
                description: 'Unique AI-generated artwork - metadata temporarily unavailable',
                image: '/placeholder-nft.png',
                attributes: [
                  { trait_type: 'Collection', value: 'AI Generated' },
                  { trait_type: 'Token ID', value: listing.tokenId },
                  { trait_type: 'Status', value: 'Metadata Loading...' }
                ]
              }
            };
          }
        })
      );
      
      setListings(processedListings);
      console.log('✅ Loaded marketplace listings:', processedListings.length);
      
    } catch (error) {
      console.error('❌ Error loading marketplace listings:', error);
      setError('Failed to load marketplace listings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const handlePurchaseNFT = async (listing) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      setIsTransacting(true);
      console.log('💰 Purchasing NFT...', listing);
      
      // Get wallet signer
      const { getBladeWalletSigner } = await import('../../utils/bladeWalletNFTMinting');
      const { bladeSigner } = await getBladeWalletSigner();
      
      // Execute HTS-compatible purchase with automatic NFT transfer
      console.log('🛒 Executing HTS-compatible purchase with automatic NFT transfer...', {
        listingId: listing.listingId,
        price: listing.priceInHBAR,
        tokenAddress: listing.tokenAddress,
        tokenId: listing.tokenId,
        seller: listing.seller
      });
      
      // Import the FINAL, CORRECT HTS-compatible purchase utility
      const { purchaseHTSNFTWithPreApprovedAllowances } = await import('../../utils/marketplaceHTSPurchaseFinal');
      
      // Execute purchase using CORRECT APPROACH:
      // 1. Verify seller has pre-approved marketplace contract
      // 2. Ensure buyer token association BEFORE payment
      // 3. Execute marketplace purchase with automatic NFT transfer
      // 4. Verify NFT transfer completion
      const result = await purchaseHTSNFTWithPreApprovedAllowances(
        listing.listingId,
        bladeSigner,
        accountId,
        listing  // Pass the listing data we already have
      );
      
      console.log('✅ NFT purchased successfully with automatic transfer:', result);
      
      // Update UI with detailed success message for the CORRECT approach
      if (result.success && result.transferSuccess) {
        alert(`🎉 PURCHASE SUCCESSFUL WITH PRE-APPROVED ALLOWANCES!\n\n🎨 ${listing.metadata.name}\n💰 Price: ${listing.priceInHBAR} HBAR\n\n✅ Seller Pre-Approval: Verified\n✅ Token Association: ${result.associationSuccess ? 'Success' : 'Already associated'}\n✅ Payment: ${result.paymentTransactionId}\n✅ NFT Transfer: ${result.transferTransactionId}\n\n🚀 The NFT has been automatically transferred using the seller's pre-approved allowances!\nThis is the correct way Hedera NFT marketplaces work!`);
      } else if (result.success && result.paymentSuccess) {
        alert(`⚠️ Payment successful but NFT transfer failed.\n\n${listing.metadata.name}\nPayment: ${result.paymentTransactionId}\n\nIssue: ${result.errorMessage}\n\n🔧 This means the marketplace smart contract has an issue with HTS NFT transfers.\nYour payment was successful - the smart contract logic needs to be fixed.`);
      } else if (result.associationAttempted && !result.associationSuccess) {
        alert(`❌ Token association failed.\n\n${result.errorMessage}\n\nYou need to associate with the token before purchasing.\nNo payment was made - please try again.`);
      } else if (result.errorMessage && result.errorMessage.includes('pre-approved')) {
        alert(`❌ Seller hasn't pre-approved the marketplace!\n\n${result.errorMessage}\n\n📋 The seller needs to follow the Seller Setup Guide:\n1. Go to "My NFTs"\n2. Click "Approve All NFTs (Alternative)"\n3. Sign the approval transaction\n\nWithout this step, automatic transfers cannot work.`);
      } else {
        alert(`❌ Purchase failed: ${result.errorMessage}`);
      }
      setShowBuyModal(false);
      
      // Refresh listings
      await loadMarketplaceListings();
      
    } catch (error) {
      console.error('❌ Error purchasing NFT:', error);
      alert(`❌ Purchase failed: ${error.message}`);
    } finally {
      setIsTransacting(false);
    }
  };

  const handlePlaceBid = async (listing) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    
    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      alert('Please enter a valid bid amount');
      return;
    }
    
    try {
      setIsTransacting(true);
      console.log('🎯 Placing bid...', { listing, bidAmount });
      
      // Get wallet signer
      const { getBladeWalletSigner } = await import('../../utils/bladeWalletNFTMinting');
      const { bladeSigner } = await getBladeWalletSigner();
      
      // Import marketplace utility for direct call
      const { placeBidOnAuction } = await import('../../utils/marketplace');
      
      // Execute bid
      const result = await placeBidOnAuction(
        listing.listingId,
        bidAmount,
        bladeSigner,
        accountId
      );
      
      console.log('✅ Bid placed successfully:', result);
      
      // Update UI
      alert(`🎯 Successfully placed bid of ${bidAmount} HBAR on ${listing.metadata.name}!`);
      setShowBidModal(false);
      setBidAmount('');
      
      // Refresh listings
      await loadMarketplaceListings();
      
    } catch (error) {
      console.error('❌ Error placing bid:', error);
      alert(`❌ Bid failed: ${error.message}`);
    } finally {
      setIsTransacting(false);
    }
  };

  const handleMakeOffer = async (listing) => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    
    if (!offerAmount || parseFloat(offerAmount) <= 0) {
      alert('Please enter a valid offer amount');
      return;
    }
    
    try {
      setIsTransacting(true);
      console.log('💡 Making offer...', { listing, offerAmount, offerDuration });
      
      // Get wallet signer
      const { getBladeWalletSigner } = await import('../../utils/bladeWalletNFTMinting');
      const { bladeSigner } = await getBladeWalletSigner();
      
      // Import marketplace utility for direct call
      const { makeOfferOnListing } = await import('../../utils/marketplace');
      
      // Execute offer
      const result = await makeOfferOnListing(
        listing.listingId,
        offerAmount,
        parseInt(offerDuration),
        bladeSigner,
        accountId
      );
      
      console.log('✅ Offer made successfully:', result);
      
      // Update UI
      alert(`💡 Successfully made offer of ${offerAmount} HBAR on ${listing.metadata.name}!`);
      setShowOfferModal(false);
      setOfferAmount('');
      
      // Refresh listings
      await loadMarketplaceListings();
      
    } catch (error) {
      console.error('❌ Error making offer:', error);
      alert(`❌ Offer failed: ${error.message}`);
    } finally {
      setIsTransacting(false);
    }
  };

  const openBuyModal = (listing) => {
    setSelectedListing(listing);
    setShowBuyModal(true);
  };

  const openBidModal = (listing) => {
    setSelectedListing(listing);
    setShowBidModal(true);
    setBidAmount('');
  };

  const openOfferModal = (listing) => {
    setSelectedListing(listing);
    setShowOfferModal(true);
    setOfferAmount('');
  };

  const formatTimeRemaining = (expirationTime) => {
    const now = new Date().getTime();
    const expiry = new Date(expirationTime).getTime();
    const timeLeft = expiry - now;
    
    if (timeLeft <= 0) return 'Expired';
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatAccountId = (accountId) => {
    return `${accountId.slice(0, 8)}...${accountId.slice(-6)}`;
  };

  // Pagination
  const totalPages = Math.ceil(filteredListings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedListings = filteredListings.slice(startIndex, startIndex + itemsPerPage);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p className={styles.loadingText}>Loading marketplace...</p>
          <p className={styles.loadingSubtext}>Discovering amazing NFTs</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>
            <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className={styles.errorTitle}>Failed to Load Marketplace</h2>
          <p className={styles.errorMessage}>{error}</p>
          <button 
            onClick={() => loadMarketplaceListings()} 
            className={styles.retryButton}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          NFT <span className={styles.gradientText}>Marketplace</span>
        </h1>
        <p className={styles.subtitle}>
          Discover, buy, and sell unique AI-generated NFTs on Hedera
        </p>
      </div>

      {/* Filters and Search */}
      <div className={styles.filtersCard}>
        <div className={styles.filtersContainer}>
          {/* Search */}
          <div className={styles.searchContainer}>
            <svg className={styles.searchIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search NFTs, creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Filter Buttons */}
          <div className={styles.filterSection}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Price:</label>
              <select 
                value={priceFilter} 
                onChange={(e) => setPriceFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Prices</option>
                <option value="low">Under 10 HBAR</option>
                <option value="medium">10-100 HBAR</option>
                <option value="high">Over 100 HBAR</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Type:</label>
              <select 
                value={typeFilter} 
                onChange={(e) => setTypeFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Types</option>
                <option value="fixed">Fixed Price</option>
                <option value="auction">Auction</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Sort:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className={styles.resultsInfo}>
          <span className={styles.resultsCount}>
            {filteredListings.length} NFT{filteredListings.length !== 1 ? 's' : ''} found
          </span>
          {!isConnected && (
            <div className={styles.connectPrompt}>
              <svg className={styles.walletIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Connect wallet to buy NFTs
            </div>
          )}
        </div>
      </div>

      {/* NFT Grid */}
      {paginatedListings.length === 0 ? (
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className={styles.emptyTitle}>No NFTs Found</h3>
          <p className={styles.emptyDescription}>
            {searchQuery || priceFilter !== 'all' || typeFilter !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'No NFTs are currently listed in the marketplace'
            }
          </p>
          <div className={styles.emptyActions}>
            <Link href="/create" className={styles.createButton}>
              Create Your First NFT
            </Link>
            <Link href="/my-nfts" className={styles.sellButton}>
              Sell Your NFTs
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.nftGrid}>
          {paginatedListings.map((listing) => (
            <div key={listing.listingId} className={styles.nftCard}>
              {/* NFT Image */}
              <div className={styles.nftImageContainer}>
                <Image
                  src={listing.metadata.image}
                  alt={listing.metadata.name}
                  fill
                  className={styles.nftImage}
                  onError={(e) => {
                    e.target.src = '/placeholder-nft.png';
                  }}
                />
                
                {/* Status Badges */}
                <div className={styles.statusBadges}>
                  {listing.isAuction ? (
                    <span className={styles.auctionBadge}>
                      🎯 Auction
                    </span>
                  ) : (
                    <span className={styles.fixedBadge}>
                      💰 Fixed Price
                    </span>
                  )}
                </div>

                {/* Time Remaining */}
                <div className={styles.timeRemaining}>
                  ⏰ {formatTimeRemaining(listing.expirationTime)}
                </div>
              </div>

              {/* NFT Info */}
              <div className={styles.nftContent}>
                <h3 className={styles.nftTitle}>{listing.metadata.name}</h3>
                <p className={styles.nftDescription}>{listing.metadata.description}</p>
                
                <div className={styles.nftDetails}>
                  <div className={styles.detailRow}>
                    <span>Seller:</span>
                    <span className={styles.sellerAddress}>{formatAccountId(listing.seller)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Token ID:</span>
                    <span className={styles.tokenId}>{listing.tokenId}</span>
                  </div>
                </div>

                {/* NFT Attributes */}
                {listing.metadata.attributes && listing.metadata.attributes.length > 0 && (
                  <div className={styles.attributesSection}>
                    <p className={styles.attributesLabel}>Attributes</p>
                    <div className={styles.attributesContainer}>
                      {listing.metadata.attributes.slice(0, 3).map((attr, index) => (
                        <span key={`${listing.id}-attr-${index}`} className={styles.attributeBadge}>
                          {attr.trait_type}: {attr.value}
                        </span>
                      ))}
                      {listing.metadata.attributes.length > 3 && (
                        <span className={styles.attributeBadgeMore}>
                          +{listing.metadata.attributes.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Price and Actions */}
                <div className={styles.priceSection}>
                  <div className={styles.priceInfo}>
                    <span className={styles.priceLabel}>
                      {listing.isAuction ? 'Current Bid:' : 'Price:'}
                    </span>
                    <span className={styles.price}>
                      {listing.isAuction && listing.highestBid > 0 
                        ? `${listing.highestBidInHBAR} HBAR` 
                        : `${listing.priceInHBAR} HBAR`
                      }
                    </span>
                  </div>

                  {isConnected && listing.seller !== accountId && (
                    <div className={styles.nftActions}>
                      {listing.isAuction ? (
                        <button
                          onClick={() => openBidModal(listing)}
                          className={styles.bidButton}
                        >
                          <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          Place Bid
                        </button>
                      ) : (
                        <button
                          onClick={() => openBuyModal(listing)}
                          className={styles.buyButton}
                        >
                          <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0L15 13M7 13h8m-8 0V9a2 2 0 012-2h6a2 2 0 012 2v4" />
                          </svg>
                          Buy Now
                        </button>
                      )}
                      
                      <button
                        onClick={() => openOfferModal(listing)}
                        className={styles.offerButton}
                      >
                        <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        Make Offer
                      </button>
                    </div>
                  )}

                  {!isConnected && (
                    <div className={styles.connectRequired}>
                      Connect wallet to purchase
                    </div>
                  )}

                  {isConnected && listing.seller === accountId && (
                    <div className={styles.ownListing}>
                      Your listing
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className={styles.paginationButton}
          >
            ← Previous
          </button>
          
          <span className={styles.paginationInfo}>
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={styles.paginationButton}
          >
            Next →
          </button>
        </div>
      )}

      {/* Buy Modal */}
      {showBuyModal && selectedListing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Purchase NFT</h2>
              <button
                onClick={() => setShowBuyModal(false)}
                className={styles.closeButton}
              >
                <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.purchasePreview}>
                <Image
                  src={selectedListing.metadata.image}
                  alt={selectedListing.metadata.name}
                  width={200}
                  height={200}
                  className={styles.modalNftImage}
                />
                <div className={styles.purchaseDetails}>
                  <h3 className={styles.modalNftTitle}>{selectedListing.metadata.name}</h3>
                  <p className={styles.modalNftDescription}>{selectedListing.metadata.description}</p>
                  <div className={styles.modalPriceInfo}>
                    <span className={styles.modalPriceLabel}>Price:</span>
                    <span className={styles.modalPrice}>{selectedListing.priceInHBAR} HBAR</span>
                  </div>
                </div>
              </div>
              
              <div className={styles.modalActions}>
                <button
                  onClick={() => setShowBuyModal(false)}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePurchaseNFT(selectedListing)}
                  disabled={isTransacting}
                  className={styles.confirmButton}
                >
                  {isTransacting ? (
                    <>
                      <div className={styles.loadingSpinner}></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0L15 13M7 13h8m-8 0V9a2 2 0 012-2h6a2 2 0 012 2v4" />
                      </svg>
                      Buy for {selectedListing.priceInHBAR} HBAR
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bid Modal */}
      {showBidModal && selectedListing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Place Bid</h2>
              <button
                onClick={() => setShowBidModal(false)}
                className={styles.closeButton}
              >
                <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.bidInfo}>
                <h3 className={styles.modalNftTitle}>{selectedListing.metadata.name}</h3>
                <div className={styles.currentBidInfo}>
                  <span>Current Highest Bid: {selectedListing.highestBidInHBAR || selectedListing.priceInHBAR} HBAR</span>
                </div>
              </div>
              
              <div className={styles.bidInput}>
                <label className={styles.inputLabel}>Your Bid (HBAR):</label>
                <input
                  type="number"
                  step="0.01"
                  min={parseFloat(selectedListing.highestBidInHBAR || selectedListing.priceInHBAR) + 0.01}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="Enter bid amount"
                  className={styles.numberInput}
                />
              </div>
              
              <div className={styles.modalActions}>
                <button
                  onClick={() => setShowBidModal(false)}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePlaceBid(selectedListing)}
                  disabled={isTransacting || !bidAmount}
                  className={styles.confirmButton}
                >
                  {isTransacting ? (
                    <>
                      <div className={styles.loadingSpinner}></div>
                      Placing Bid...
                    </>
                  ) : (
                    <>
                      <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Place Bid
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offer Modal */}
      {showOfferModal && selectedListing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Make Offer</h2>
              <button
                onClick={() => setShowOfferModal(false)}
                className={styles.closeButton}
              >
                <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.offerInfo}>
                <h3 className={styles.modalNftTitle}>{selectedListing.metadata.name}</h3>
                <div className={styles.listingPriceInfo}>
                  <span>Listed Price: {selectedListing.priceInHBAR} HBAR</span>
                </div>
              </div>
              
              <div className={styles.offerInputs}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Offer Amount (HBAR):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    placeholder="Enter offer amount"
                    className={styles.numberInput}
                  />
                </div>
                
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Offer Duration:</label>
                  <select
                    value={offerDuration}
                    onChange={(e) => setOfferDuration(e.target.value)}
                    className={styles.selectInput}
                  >
                    <option value="3600">1 Hour</option>
                    <option value="86400">24 Hours</option>
                    <option value="259200">3 Days</option>
                    <option value="604800">7 Days</option>
                  </select>
                </div>
              </div>
              
              <div className={styles.offerNote}>
                <p>Your offer amount will be held in escrow until the offer expires or is accepted.</p>
              </div>
              
              <div className={styles.modalActions}>
                <button
                  onClick={() => setShowOfferModal(false)}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleMakeOffer(selectedListing)}
                  disabled={isTransacting || !offerAmount}
                  className={styles.confirmButton}
                >
                  {isTransacting ? (
                    <>
                      <div className={styles.loadingSpinner}></div>
                      Making Offer...
                    </>
                  ) : (
                    <>
                      <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      Make Offer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default MarketplacePage;