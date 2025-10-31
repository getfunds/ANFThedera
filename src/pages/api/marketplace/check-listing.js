/**
 * API Endpoint: Check if NFT has active listing
 * Returns active listing info for a specific NFT
 * Optimized with caching for faster detection
 */

import { ethers } from 'ethers';

const MARKETPLACE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID;
const NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';

// Cache for listing data (5 second TTL)
const listingCache = new Map();
const CACHE_TTL = 5000; // 5 seconds

// Marketplace ABI for querying listings
const MARKETPLACE_ABI = [
  "function getActiveListingsCount() external view returns (uint256)",
  "function getActiveListingId(uint256 index) external view returns (uint256)",
  "function getListing(uint256 listingId) external view returns (address tokenAddress, uint256 tokenId, address seller, uint256 price, uint256 expirationTime, bool isActive, bool isAuction, uint256 highestBid, address highestBidder)"
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tokenAddress, tokenId } = req.query;

    if (!tokenAddress || !tokenId) {
      return res.status(400).json({ error: 'tokenAddress and tokenId are required' });
    }

    if (!MARKETPLACE_CONTRACT_ADDRESS) {
      return res.status(500).json({ error: 'Marketplace contract not configured' });
    }

    // Create cache key for this NFT
    const cacheKey = `${tokenAddress}-${tokenId}`;
    const now = Date.now();
    
    // Check cache first
    if (listingCache.has(cacheKey)) {
      const cached = listingCache.get(cacheKey);
      if (now - cached.timestamp < CACHE_TTL) {
        return res.status(200).json(cached.data);
      } else {
        listingCache.delete(cacheKey);
      }
    }

    console.log(`🔍 Checking listing for token ${tokenAddress}, serial ${tokenId}`);

    // Convert token address to EVM format for comparison
    const tokenEvmAddress = contractIdToEvmAddress(tokenAddress);
    console.log(`🔄 Token EVM address: ${tokenEvmAddress}`);

    // Connect to Hedera via JSON-RPC
    const rpcUrl = NETWORK === 'mainnet'
      ? 'https://mainnet.hashio.io/api'
      : 'https://testnet.hashio.io/api';

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Convert contract ID to EVM address (0.0.xxxxx -> 0x...)
    const contractAddress = contractIdToEvmAddress(MARKETPLACE_CONTRACT_ADDRESS);
    const contract = new ethers.Contract(contractAddress, MARKETPLACE_ABI, provider);

    // Get all active listings and find matching NFT
    let activeListingsCount;
    try {
      activeListingsCount = await contract.getActiveListingsCount();
      console.log(`📋 Total active listings: ${activeListingsCount}`);
    } catch (countError) {
      console.error('❌ Failed to get active listings count:', countError.message);
      return res.status(200).json({ isListed: false, listing: null });
    }

    // Check each listing
    for (let i = 0; i < activeListingsCount; i++) {
      try {
        const listingId = await contract.getActiveListingId(i);
        const listing = await contract.getListing(listingId);

        const [
          listingTokenAddress,
          listingTokenId,
          listingSeller,
          listingPrice,
          listingExpirationTime,
          listingIsActive,
          listingIsAuction,
          listingHighestBid,
          listingHighestBidder
        ] = listing;

        // Normalize addresses for comparison
        const normalizedListingAddress = listingTokenAddress.toLowerCase();
        const normalizedSearchAddress = tokenEvmAddress.toLowerCase();

        // Check if this listing matches our NFT
        const tokenIdMatch = listingTokenId.toString() === tokenId.toString();
        const tokenAddressMatch = normalizedListingAddress === normalizedSearchAddress;

        if (tokenIdMatch && tokenAddressMatch && listingIsActive) {
          // Check if listing is not expired
          const now = Math.floor(Date.now() / 1000);
          const isExpired = now > Number(listingExpirationTime);

          if (!isExpired) {
            console.log(`✅ Found active listing ${listingId} for NFT`);
            
            // Convert from tinybars to HBAR (1 HBAR = 100,000,000 tinybars)
            const priceInHbar = Number(listingPrice) / 100_000_000;
            const highestBidInHbar = Number(listingHighestBid) / 100_000_000;
            
            const response = {
              isListed: true,
              listing: {
                listingId: listingId.toString(),
                tokenAddress: listingTokenAddress,
                tokenId: listingTokenId.toString(),
                seller: listingSeller,
                price: priceInHbar.toString(),
                expirationTime: Number(listingExpirationTime),
                isActive: listingIsActive,
                isAuction: listingIsAuction,
                highestBid: highestBidInHbar.toString(),
                highestBidder: listingHighestBidder
              }
            };
            
            // Cache the result
            listingCache.set(cacheKey, {
              data: response,
              timestamp: Date.now()
            });
            
            return res.status(200).json(response);
          }
        }
      } catch (listingError) {
        // Silently skip invalid listings (they might be cancelled or expired)
        continue;
      }
    }

    console.log(`ℹ️ No active listing found for NFT`);
    
    const notListedResponse = { isListed: false, listing: null };
    
    // Cache negative result too (shorter TTL)
    listingCache.set(cacheKey, {
      data: notListedResponse,
      timestamp: Date.now()
    });
    
    return res.status(200).json(notListedResponse);

  } catch (error) {
    console.error('❌ Error checking listing:', error);
    // Return false instead of error to prevent UI issues
    return res.status(200).json({ isListed: false, listing: null });
  }
}

/**
 * Convert Hedera contract ID (0.0.xxxxx) to EVM address
 */
function contractIdToEvmAddress(contractId) {
  if (contractId.startsWith('0x')) {
    return contractId;
  }
  
  // Parse contract ID format: 0.0.xxxxx
  const parts = contractId.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid contract ID format');
  }
  
  const num = parseInt(parts[2]);
  // Convert to EVM address format (20 bytes)
  return '0x' + num.toString(16).padStart(40, '0');
}

