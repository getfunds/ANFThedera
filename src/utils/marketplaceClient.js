/**
 * Client-side marketplace utilities
 * Makes API calls to server-side endpoints instead of direct smart contract calls
 */

/**
 * Get active marketplace listings with pagination
 * @param {number} offset - Starting index
 * @param {number} limit - Number of listings to fetch
 */
export async function getMarketplaceListings(offset = 0, limit = 20) {
  try {
    console.log('📋 Fetching marketplace listings...', { offset, limit });
    
    const response = await fetch(`/api/marketplace/listings?offset=${offset}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch listings: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load listings');
    }
    
    console.log('✅ Fetched marketplace listings:', data.listings.length);
    return data.listings;
    
  } catch (error) {
    console.error('❌ Error fetching marketplace listings:', error);
    return [];
  }
}

/**
 * Create a new NFT listing
 */
export async function createMarketplaceListing({
  tokenAddress,
  tokenId,
  price,
  duration = 604800, // 7 days default
  isAuction = false,
  royaltyPercentage = 0,
  royaltyRecipient = null
}, signer, accountId) {
  try {
    console.log('🏪 Creating marketplace listing...', {
      tokenAddress,
      tokenId,
      price,
      duration,
      isAuction
    });
    
    // For client-side, we'll make an API call to create the listing
    const response = await fetch('/api/marketplace/listings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenAddress,
        tokenId,
        price,
        duration,
        isAuction,
        royaltyPercentage,
        royaltyRecipient,
        accountId,
        // Note: In production, you'd need to sign this request
        signature: 'placeholder'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create listing: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to create listing');
    }
    
    console.log('✅ Listing created successfully:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Error creating marketplace listing:', error);
    throw error;
  }
}

/**
 * Purchase an NFT from a listing
 */
export async function purchaseNFTFromMarketplace(listingId, price, signer, accountId) {
  try {
    console.log('💰 Purchasing NFT from marketplace...', { listingId, price });
    
    const response = await fetch('/api/marketplace/purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listingId,
        buyerAccountId: accountId,
        paymentAmount: price,
        signature: 'placeholder'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to purchase NFT: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to purchase NFT');
    }
    
    console.log('✅ NFT purchased successfully:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Error purchasing NFT:', error);
    throw error;
  }
}

/**
 * Place a bid on an auction
 */
export async function placeBidOnAuction(listingId, bidAmount, signer, accountId) {
  try {
    console.log('🎯 Placing bid on auction...', { listingId, bidAmount });
    
    const response = await fetch('/api/marketplace/bid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listingId,
        bidAmount,
        accountId,
        signature: 'placeholder'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to place bid: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to place bid');
    }
    
    console.log('✅ Bid placed successfully:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Error placing bid:', error);
    throw error;
  }
}

/**
 * Make an offer on a listing
 */
export async function makeOfferOnListing(listingId, offerAmount, duration, signer, accountId) {
  try {
    console.log('💡 Making offer on listing...', { listingId, offerAmount, duration });
    
    const response = await fetch('/api/marketplace/offers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listingId,
        offerAmount,
        duration,
        accountId,
        signature: 'placeholder'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to make offer: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to make offer');
    }
    
    console.log('✅ Offer made successfully:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Error making offer:', error);
    throw error;
  }
}

/**
 * Get detailed information about a specific listing
 */
export async function getListingDetails(listingId) {
  try {
    console.log('🔍 Fetching listing details...', { listingId });
    
    const response = await fetch(`/api/marketplace/listings/${listingId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch listing details: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load listing details');
    }
    
    console.log('✅ Fetched listing details:', data.listing);
    return data.listing;
    
  } catch (error) {
    console.error('❌ Error fetching listing details:', error);
    throw error;
  }
}

export default {
  getMarketplaceListings,
  createMarketplaceListing,
  purchaseNFTFromMarketplace,
  placeBidOnAuction,
  makeOfferOnListing,
  getListingDetails
};
