/**
 * API endpoint for marketplace listings
 * Handles fetching, creating, and managing NFT listings
 */

// Server-side marketplace utilities will be imported dynamically to avoid client-side issues

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Fetch marketplace listings with pagination
      const { offset = 0, limit = 20, filter, sort } = req.query;
      
      console.log('📋 API: Fetching marketplace listings...', { offset, limit, filter, sort });
      
      // Fetch real listings from the smart contract
      let listings = [];
      
      try {
        // Dynamic import to avoid client-side issues
        const { getMarketplaceListings } = await import('../../../utils/marketplace');
        listings = await getMarketplaceListings(parseInt(offset), parseInt(limit));
        console.log(`✅ Found ${listings.length} listings from smart contract`);
      } catch (contractError) {
        console.warn('⚠️ Smart contract not available, returning empty listings:', contractError.message);
        listings = [];
      }
      
      // Apply filters if provided
      let filteredListings = listings;
      
      if (filter === 'auction') {
        filteredListings = filteredListings.filter(listing => listing.isAuction);
      } else if (filter === 'fixed') {
        filteredListings = filteredListings.filter(listing => !listing.isAuction);
      }
      
      // Apply sorting
      if (sort === 'price-low') {
        filteredListings.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      } else if (sort === 'price-high') {
        filteredListings.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      } else if (sort === 'oldest') {
        filteredListings.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      } else {
        // Default: newest first
        filteredListings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      
      // Apply pagination
      const startIndex = parseInt(offset);
      const endIndex = startIndex + parseInt(limit);
      const paginatedListings = filteredListings.slice(startIndex, endIndex);
      
      res.status(200).json({
        success: true,
        listings: paginatedListings,
        total: filteredListings.length,
        offset: parseInt(offset),
        limit: parseInt(limit)
      });
      
    } else if (req.method === 'POST') {
      // Create a new marketplace listing
      const {
        tokenAddress,
        tokenId,
        price,
        duration,
        isAuction,
        royaltyPercentage,
        royaltyRecipient,
        accountId,
        signature
      } = req.body;
      
      console.log('🏪 API: Creating marketplace listing...', {
        tokenAddress,
        tokenId,
        price,
        isAuction
      });
      
      // Validate required fields
      if (!tokenAddress || !tokenId || !price || !accountId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: tokenAddress, tokenId, price, accountId'
        });
      }
      
      // Validate price
      if (parseFloat(price) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Price must be greater than 0'
        });
      }
      
      // In production, this would:
      // 1. Verify the user owns the NFT
      // 2. Check if NFT is already listed
      // 3. Validate the signature
      // 4. Call the smart contract to create the listing
      
      // For now, return success with mock listing ID
      const mockListingId = Math.floor(Math.random() * 10000) + 1000;
      
      res.status(201).json({
        success: true,
        listingId: mockListingId,
        message: 'Listing created successfully',
        transactionId: `0.0.${Math.floor(Math.random() * 100000)}@${Date.now()}.${Math.floor(Math.random() * 1000000)}`
      });
      
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({
        success: false,
        error: `Method ${req.method} not allowed`
      });
    }
    
  } catch (error) {
    console.error('❌ API Error in /marketplace/listings:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}

