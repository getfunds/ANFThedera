/**
 * API endpoint for marketplace offers
 * Handles creating, accepting, and managing offers
 */

import { makeOfferOnListing, acceptMarketplaceOffer } from '../../../utils/marketplace';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Get offers for a listing or user
      const { listingId, userAccountId, type = 'all' } = req.query;
      
      console.log('📋 API: Fetching offers...', { listingId, userAccountId, type });
      
      // In production, this would query the smart contract
      const mockOffers = getMockOffers(listingId, userAccountId, type);
      
      res.status(200).json({
        success: true,
        offers: mockOffers,
        total: mockOffers.length
      });
      
    } else if (req.method === 'POST') {
      const action = req.body.action;
      
      if (action === 'create') {
        // Create a new offer
        const {
          listingId,
          offerAmount,
          duration,
          buyerAccountId,
          signature
        } = req.body;
        
        console.log('💡 API: Creating offer...', {
          listingId,
          offerAmount,
          duration,
          buyerAccountId
        });
        
        // Validate required fields
        if (!listingId || !offerAmount || !duration || !buyerAccountId) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: listingId, offerAmount, duration, buyerAccountId'
          });
        }
        
        // Validate offer amount
        if (parseFloat(offerAmount) <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Offer amount must be greater than 0'
          });
        }
        
        // Validate duration (minimum 1 hour)
        if (parseInt(duration) < 3600) {
          return res.status(400).json({
            success: false,
            error: 'Offer duration must be at least 1 hour'
          });
        }
        
        // In production, this would:
        // 1. Verify the listing exists
        // 2. Check buyer has sufficient balance
        // 3. Validate the signature
        // 4. Call smart contract to create offer (with escrow)
        
        const mockOfferId = Math.floor(Math.random() * 10000) + 1000;
        const expirationTime = new Date(Date.now() + parseInt(duration) * 1000).toISOString();
        
        res.status(201).json({
          success: true,
          offerId: mockOfferId,
          message: 'Offer created successfully',
          offer: {
            offerId: mockOfferId,
            listingId: parseInt(listingId),
            buyer: buyerAccountId,
            amount: offerAmount,
            expirationTime: expirationTime,
            isActive: true,
            createdAt: new Date().toISOString()
          },
          transactionId: `0.0.${Math.floor(Math.random() * 100000)}@${Date.now()}.${Math.floor(Math.random() * 1000000)}`
        });
        
      } else if (action === 'accept') {
        // Accept an offer
        const {
          offerId,
          sellerAccountId,
          signature
        } = req.body;
        
        console.log('✅ API: Accepting offer...', {
          offerId,
          sellerAccountId
        });
        
        // Validate required fields
        if (!offerId || !sellerAccountId) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: offerId, sellerAccountId'
          });
        }
        
        // In production, this would:
        // 1. Verify the offer exists and is active
        // 2. Check the seller owns the NFT
        // 3. Validate the signature
        // 4. Execute the smart contract acceptance
        // 5. Transfer NFT and release escrow funds
        
        const mockOffer = getMockOffer(offerId);
        if (!mockOffer) {
          return res.status(404).json({
            success: false,
            error: 'Offer not found or no longer active'
          });
        }
        
        // Check if offer hasn't expired
        if (new Date() > new Date(mockOffer.expirationTime)) {
          return res.status(400).json({
            success: false,
            error: 'Offer has expired'
          });
        }
        
        const saleResult = {
          transactionId: `0.0.${Math.floor(Math.random() * 100000)}@${Date.now()}.${Math.floor(Math.random() * 1000000)}`,
          offerId: offerId,
          listingId: mockOffer.listingId,
          buyer: mockOffer.buyer,
          seller: sellerAccountId,
          price: mockOffer.amount,
          platformFee: (parseFloat(mockOffer.amount) * 0.025).toFixed(2),
          timestamp: new Date().toISOString()
        };
        
        res.status(200).json({
          success: true,
          message: 'Offer accepted successfully',
          sale: saleResult,
          hashscanUrl: `https://hashscan.io/testnet/transaction/${saleResult.transactionId}`
        });
        
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Use "create" or "accept"'
        });
      }
      
    } else if (req.method === 'DELETE') {
      // Cancel an offer
      const { offerId, userAccountId } = req.body;
      
      console.log('❌ API: Cancelling offer...', { offerId, userAccountId });
      
      if (!offerId || !userAccountId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: offerId, userAccountId'
        });
      }
      
      // In production, this would:
      // 1. Verify the offer exists
      // 2. Check the user is the offer creator
      // 3. Cancel the offer and refund escrow
      
      res.status(200).json({
        success: true,
        message: 'Offer cancelled successfully',
        transactionId: `0.0.${Math.floor(Math.random() * 100000)}@${Date.now()}.${Math.floor(Math.random() * 1000000)}`
      });
      
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      res.status(405).json({
        success: false,
        error: `Method ${req.method} not allowed`
      });
    }
    
  } catch (error) {
    console.error('❌ API Error in /marketplace/offers:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}

function getMockOffers(listingId, userAccountId, type) {
  const allOffers = [
    {
      offerId: 1001,
      listingId: 1,
      buyer: '0.0.111111',
      amount: '20.00',
      expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    {
      offerId: 1002,
      listingId: 1,
      buyer: '0.0.222222',
      amount: '22.50',
      expirationTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    },
    {
      offerId: 1003,
      listingId: 2,
      buyer: '0.0.333333',
      amount: '12.00',
      expirationTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    }
  ];
  
  let filteredOffers = allOffers;
  
  if (listingId) {
    filteredOffers = filteredOffers.filter(offer => offer.listingId === parseInt(listingId));
  }
  
  if (userAccountId) {
    if (type === 'made') {
      filteredOffers = filteredOffers.filter(offer => offer.buyer === userAccountId);
    } else if (type === 'received') {
      // In production, this would check if user is the seller of the listing
      // For now, return all offers
    }
  }
  
  return filteredOffers;
}

function getMockOffer(offerId) {
  const mockOffers = {
    1001: {
      offerId: 1001,
      listingId: 1,
      buyer: '0.0.111111',
      amount: '20.00',
      expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isActive: true
    },
    1002: {
      offerId: 1002,
      listingId: 1,
      buyer: '0.0.222222',
      amount: '22.50',
      expirationTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      isActive: true
    }
  };
  
  return mockOffers[offerId];
}
