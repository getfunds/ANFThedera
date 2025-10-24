/**
 * API endpoint for NFT purchases
 * Handles purchase transactions and validation
 */

import { purchaseNFTFromMarketplace, getMarketplaceListings } from '../../../utils/marketplace';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    });
  }

  try {
    const {
      listingId,
      buyerAccountId,
      paymentAmount,
      signature,
      transactionId
    } = req.body;

    console.log('💰 API: Processing NFT purchase...', {
      listingId,
      buyerAccountId,
      paymentAmount
    });

    // Validate required fields
    if (!listingId || !buyerAccountId || !paymentAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: listingId, buyerAccountId, paymentAmount'
      });
    }

    // Validate payment amount
    if (parseFloat(paymentAmount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount must be greater than 0'
      });
    }

    // Get real listing from smart contract
    console.log('🔍 Fetching listing from smart contract...');
    const listings = await getMarketplaceListings(0, 100);
    const targetListing = listings.find(l => l.listingId === listingId || l.id === listingId);
    
    if (!targetListing) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found or no longer active'
      });
    }

    // Check if buyer is not the seller
    if (targetListing.seller === buyerAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot purchase your own listing'
      });
    }

    // Check if payment amount matches listing price (in tinybars)
    const expectedPrice = parseFloat(targetListing.price); // price in tinybars
    const providedPrice = parseFloat(paymentAmount); // should be in tinybars
    
    console.log('💰 Price validation:', {
      expectedPrice,
      providedPrice,
      expectedPriceHBAR: targetListing.priceInHBAR,
      match: Math.abs(expectedPrice - providedPrice) < 1000 // Allow small rounding differences
    });
    
    if (Math.abs(expectedPrice - providedPrice) >= 1000) { // Allow small rounding differences in tinybars
      return res.status(400).json({
        success: false,
        error: `Price mismatch. Expected: ${targetListing.priceInHBAR} HBAR, provided: ${(providedPrice / 100000000).toFixed(2)} HBAR`
      });
    }

    // Note: For real implementation, this would need to be handled client-side with wallet signing
    // For now, we'll return an error indicating this needs wallet interaction
    console.log('🚀 Purchase requires wallet signing - redirecting to client-side...');
    
    return res.status(400).json({
      success: false,
      error: 'Purchase requires wallet signature. Please use the client-side purchase flow.',
      requiresWalletSigning: true,
      listing: targetListing
    });

  } catch (error) {
    console.error('❌ API Error in /marketplace/purchase:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}

