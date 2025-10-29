/**
 * NFT Marketplace Utilities
 * Handles interaction with the NFT Marketplace smart contract on Hedera
 */

// Note: Hedera SDK imports are handled dynamically to avoid client-side issues

// Environment configuration
const NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
const MARKETPLACE_CONTRACT_ID = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID;

/**
 * Marketplace contract ABI (HTS Working Version)
 * Updated for NFTMarketplace_HTS_Working.sol - uses HTS system contracts
 */
const MARKETPLACE_ABI = [
  // Listing functions
  'function createListing(address,uint256,uint256,uint256,bool) returns (uint256)',
  'function cancelListing(uint256)',
  
  // Purchase functions
  'function purchaseNFT(uint256) payable',
  
  // View functions
  'function getListing(uint256) view returns (address,uint256,address,uint256,uint256,bool,bool,uint256,address)',
  'function getActiveListingsCount() view returns (uint256)',
  'function getActiveListingId(uint256) view returns (uint256)',
  
  // HTS-specific approval checking function
  'function checkNFTApproval(address,uint256,address) returns (bool,string)',
  
  // Admin functions
  'function setPlatformFeePercentage(uint256)',
  'function setPlatformFeeRecipient(address)',
  'function pause()',
  'function unpause()',
  'function emergencyWithdraw()'
];

/**
 * Create a new NFT listing
 * @param {Object} params - Listing parameters
 * @param {string} params.tokenAddress - NFT contract address
 * @param {number} params.tokenId - NFT token ID
 * @param {string} params.price - Price in HBAR
 * @param {number} params.duration - Listing duration in seconds
 * @param {boolean} params.isAuction - Whether this is an auction
 * @param {number} params.royaltyPercentage - Royalty percentage (basis points)
 * @param {string} params.royaltyRecipient - Royalty recipient address
 * @param {Object} signer - Wallet signer
 * @param {string} accountId - User account ID
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
    
    // Check if marketplace contract is deployed
    if (!MARKETPLACE_CONTRACT_ID) {
      throw new Error('Marketplace contract not deployed yet. Please deploy the contract first.');
    }
    
    // Use dynamic import for Hedera SDK
    const { 
      ContractExecuteTransaction, 
      ContractFunctionParameters, 
      Hbar, 
      AccountId, 
      TransactionId 
    } = await import('@hashgraph/sdk');
    
    // Convert price to wei (assuming HBAR to wei conversion)
    const priceInWei = Hbar.fromString(price).toTinybars().toString();
    
    // Set default royalty recipient to seller if not specified
    const finalRoyaltyRecipient = royaltyRecipient || accountId;
    
    // Convert Hedera account IDs to Ethereum-style addresses if needed
    const tokenAddressFormatted = convertToEvmAddress(tokenAddress);
    const royaltyRecipientFormatted = convertToEvmAddress(finalRoyaltyRecipient);
    
    console.log('🔄 Address conversion:', {
      original: { tokenAddress, royaltyRecipient: finalRoyaltyRecipient },
      converted: { tokenAddress: tokenAddressFormatted, royaltyRecipient: royaltyRecipientFormatted }
    });
    
    // Create contract execute transaction
    // Note: Don't set TransactionId for Blade Wallet - populateTransaction() will handle it
    // UPDATED: This matches NFTMarketplace_HTS_Simple.sol (5 parameters with uint256 tokenId)
    const contractExecuteTx = new ContractExecuteTransaction()
      .setContractId(MARKETPLACE_CONTRACT_ID)
      .setGas(300000)
      .setFunction(
        'createListing',
        new ContractFunctionParameters()
          .addAddress(tokenAddressFormatted)
          .addUint256(tokenId) // Back to uint256 for ERC721 compatibility
          .addUint256(priceInWei)
          .addUint256(duration)
          .addBool(isAuction)
      )
      .setMaxTransactionFee(new Hbar(5));
    
    // Only set TransactionId if not using Blade Wallet
    // Blade Wallet's populateTransaction() will set the transaction ID and node accounts
    if (!signer || (typeof signer.call !== 'function' && typeof signer.populateTransaction !== 'function')) {
      contractExecuteTx.setTransactionId(TransactionId.generate(AccountId.fromString(accountId)));
    }
    
    console.log('📋 Transaction created:', {
      contractId: MARKETPLACE_CONTRACT_ID,
      hasTransactionId: !!contractExecuteTx.transactionId,
      isBladeWallet: !!(signer && (typeof signer.call === 'function' || typeof signer.populateTransaction === 'function'))
    });
    
    // Debug transaction parameters for contract revert troubleshooting
    console.log('🔍 Contract call parameters (NFTMarketplace_Optimized.sol):', {
      function: 'createListing',
      tokenAddress: tokenAddressFormatted,
      tokenId: tokenId,
      price: priceInWei + ' tinybars (' + price + ' HBAR)',
      duration: duration + ' seconds',
      isAuction: isAuction,
      // NOTE: Royalty parameters not included in deployed contract
      seller: accountId,
      gas: 300000,
      maxFee: '5 HBAR',
      deployedContract: '0.0.6893361'
    });
    
    // Pre-flight checks that might cause CONTRACT_REVERT_EXECUTED
    console.log('⚠️ Pre-flight checks (common revert causes):');
    console.log('1. Contract deployed?', MARKETPLACE_CONTRACT_ID ? 'YES' : 'NO - THIS WILL CAUSE REVERT');
    console.log('2. Valid token address?', tokenAddressFormatted !== '0x0000000000000000000000000000000000000000' ? 'YES' : 'NO - THIS WILL CAUSE REVERT');
    console.log('3. Price > 0?', parseInt(priceInWei) > 0 ? 'YES' : 'NO - THIS WILL CAUSE REVERT');
    console.log('4. Duration >= minimum?', duration >= 86400 ? 'YES (24h+)' : 'WARNING - Contract may require minimum duration');
    console.log('5. Valid royalty %?', royaltyPercentage <= 10000 ? 'YES' : 'NO - THIS WILL CAUSE REVERT (max 100%)');
    
    if (!MARKETPLACE_CONTRACT_ID) {
      throw new Error('MARKETPLACE_CONTRACT_ID not set in environment variables. This will cause CONTRACT_REVERT_EXECUTED.');
    }
    
    // Set the deployed contract ID as fallback
    const DEPLOYED_CONTRACT_ID = '0.0.6893361';
    const finalContractId = MARKETPLACE_CONTRACT_ID || DEPLOYED_CONTRACT_ID;
    console.log('🏗️ Using marketplace contract:', finalContractId);
    
    console.log('📤 Executing contract transaction...');
    
    try {
      const result = await executeWithWallet(contractExecuteTx, signer, accountId);
      console.log('✅ Listing created successfully:', result);
      return {
        success: true,
        transactionId: result.transactionId,
        listingId: result.listingId,
        result: result
      };
    } catch (contractError) {
      // Check if the error is due to contract not approved
      if (contractError.message && contractError.message.includes('Contract not approved')) {
        console.error('🚨 NFT NOT APPROVED FOR MARKETPLACE!');
        console.log(`
🔓 SOLUTION: Your NFT needs to be approved for the marketplace contract.

STEP 1: Approve your NFT for marketplace contract ${MARKETPLACE_CONTRACT_ID}
        
Option A - Approve specific NFT:
token.approve("${MARKETPLACE_CONTRACT_ID}", ${tokenId})

Option B - Approve all NFTs (recommended):
token.setApprovalForAll("${MARKETPLACE_CONTRACT_ID}", true)

TOKEN ADDRESS: ${tokenAddress}
TOKEN ID: ${tokenId}
MARKETPLACE CONTRACT: ${MARKETPLACE_CONTRACT_ID}

After approving, try creating the listing again.
        `);
        
        throw new Error(`NFT not approved for marketplace. Please approve token ${tokenAddress} (ID: ${tokenId}) for marketplace contract ${MARKETPLACE_CONTRACT_ID} first.`);
      }
      
      // Re-throw other contract errors
      throw contractError;
    }
    
  } catch (error) {
    console.error('❌ Error creating marketplace listing:', error);
    throw error;
  }
}

/**
 * Purchase an NFT from a listing
 * @param {number} listingId - The listing ID to purchase
 * @param {string} price - Price in HBAR
 * @param {Object} signer - Wallet signer
 * @param {string} accountId - Buyer account ID
 */
export async function purchaseNFTFromMarketplace(listingId, price, signer, accountId) {
  try {
    console.log('💰 Purchasing NFT from marketplace...', { listingId, price });
    
    // Check if marketplace contract is deployed
    if (!MARKETPLACE_CONTRACT_ID) {
      throw new Error('Marketplace contract not deployed yet. Please deploy the contract first.');
    }
    
    console.log('🏪 Using marketplace contract:', MARKETPLACE_CONTRACT_ID);
    console.log('ℹ️ Ensure this is the NFTMarketplace_HTS.sol contract for proper HTS NFT support');
    
    // Use dynamic import for Hedera SDK
    const { 
      ContractExecuteTransaction, 
      ContractFunctionParameters, 
      Hbar, 
      HbarUnit,
      AccountId, 
      TransactionId 
    } = await import('@hashgraph/sdk');
    
    console.log('💰 Converting price for purchase:', { price, type: typeof price });
    
    // Convert price to Hbar object
    let priceInHbar;
    try {
      if (typeof price === 'string' && price.includes('.')) {
        // Price is already in HBAR format (e.g., "10.00")
        priceInHbar = Hbar.fromString(price);
      } else {
        // Price might be in tinybars, convert to HBAR first
        const priceNum = parseFloat(price);
        if (priceNum > 1000000) {
          // Likely tinybars, convert to HBAR
          priceInHbar = Hbar.from(priceNum, HbarUnit.Tinybar);
        } else {
          // Already in HBAR
          priceInHbar = Hbar.from(priceNum, HbarUnit.Hbar);
        }
      }
      
      console.log('💰 Price conversion result:', {
        originalPrice: price,
        priceInHbar: priceInHbar.toString(),
        priceInTinybars: priceInHbar.toTinybars().toString()
      });
      
    } catch (conversionError) {
      console.error('❌ Price conversion failed:', conversionError);
      throw new Error(`Invalid price format: ${price}`);
    }
    
    // Create contract execute transaction with payment
    const contractExecuteTx = new ContractExecuteTransaction()
      .setContractId(MARKETPLACE_CONTRACT_ID)
      .setGas(500000) // Increased gas limit
      .setPayableAmount(priceInHbar) // Use Hbar object directly
      .setFunction(
        'purchaseNFT',
        new ContractFunctionParameters().addUint256(listingId)
      )
      .setMaxTransactionFee(new Hbar(10)); // Increased max fee
    
    // Only set TransactionId if not using Blade Wallet
    if (!signer || (typeof signer.call !== 'function' && typeof signer.populateTransaction !== 'function')) {
      contractExecuteTx.setTransactionId(TransactionId.generate(AccountId.fromString(accountId)));
    }
    
    console.log('📤 Executing purchase transaction...');
    const result = await executeWithWallet(contractExecuteTx, signer, accountId);
    
    console.log('✅ NFT purchased successfully:', result);
    return {
      success: true,
      transactionId: result.transactionId,
      result: result
    };
    
  } catch (error) {
    console.error('❌ Error purchasing NFT:', error);
    
    // Enhanced error handling for HTS NFT issues
    if (error.message.includes('NFT transfer failed')) {
      throw new Error(`NFT transfer failed - This might be an HTS NFT that requires token association. Please ensure:\n1. The buyer is associated with token ${MARKETPLACE_CONTRACT_ID}\n2. The NFT is properly approved for the marketplace\n3. Using the correct NFTMarketplace_HTS.sol contract\n\nOriginal error: ${error.message}`);
    }
    
    if (error.message.includes('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT')) {
      throw new Error(`Token not associated - Please associate the HTS token with your account before purchasing. Original error: ${error.message}`);
    }
    
    if (error.message.includes('CONTRACT_REVERT_EXECUTED')) {
      throw new Error(`Smart contract execution failed - This might be due to:\n1. NFT not approved for marketplace\n2. Insufficient payment\n3. Listing expired or inactive\n4. HTS token association issues\n\nOriginal error: ${error.message}`);
    }
    
    throw error;
  }
}

/**
 * Place a bid on an auction
 * @param {number} listingId - The auction listing ID
 * @param {string} bidAmount - Bid amount in HBAR
 * @param {Object} signer - Wallet signer
 * @param {string} accountId - Bidder account ID
 */
export async function placeBidOnAuction(listingId, bidAmount, signer, accountId) {
  try {
    console.log('🎯 Placing bid on auction...', { listingId, bidAmount });
    
    // Check if marketplace contract is deployed
    if (!MARKETPLACE_CONTRACT_ID) {
      throw new Error('Marketplace contract not deployed yet. Please deploy the contract first.');
    }
    
    // Use dynamic import for Hedera SDK
    const { 
      ContractExecuteTransaction, 
      ContractFunctionParameters, 
      Hbar, 
      AccountId, 
      TransactionId 
    } = await import('@hashgraph/sdk');
    
    // Convert bid amount to tinybars
    const bidInTinybars = Hbar.fromString(bidAmount).toTinybars();
    
    // Create contract execute transaction with bid payment
    const contractExecuteTx = new ContractExecuteTransaction()
      .setContractId(MARKETPLACE_CONTRACT_ID)
      .setGas(300000)
      .setPayableAmount(bidInTinybars)
      .setFunction(
        'placeBid',
        new ContractFunctionParameters().addUint256(listingId)
      )
      .setMaxTransactionFee(new Hbar(5));
    
    // Only set TransactionId if not using Blade Wallet
    if (!signer || (typeof signer.call !== 'function' && typeof signer.populateTransaction !== 'function')) {
      contractExecuteTx.setTransactionId(TransactionId.generate(AccountId.fromString(accountId)));
    }
    
    console.log('📤 Executing bid transaction...');
    const result = await executeWithWallet(contractExecuteTx, signer, accountId);
    
    console.log('✅ Bid placed successfully:', result);
    return {
      success: true,
      transactionId: result.transactionId,
      result: result
    };
    
  } catch (error) {
    console.error('❌ Error placing bid:', error);
    throw error;
  }
}

/**
 * Make an offer on a listing
 * @param {number} listingId - The listing ID
 * @param {string} offerAmount - Offer amount in HBAR
 * @param {number} duration - Offer duration in seconds
 * @param {Object} signer - Wallet signer
 * @param {string} accountId - Offer maker account ID
 */
export async function makeOfferOnListing(listingId, offerAmount, duration, signer, accountId) {
  try {
    console.log('💡 Making offer on listing...', { listingId, offerAmount, duration });
    
    // Check if marketplace contract is deployed
    if (!MARKETPLACE_CONTRACT_ID) {
      throw new Error('Marketplace contract not deployed yet. Please deploy the contract first.');
    }
    
    // Use dynamic import for Hedera SDK
    const { 
      ContractExecuteTransaction, 
      ContractFunctionParameters, 
      Hbar, 
      AccountId, 
      TransactionId 
    } = await import('@hashgraph/sdk');
    
    // Convert offer amount to tinybars
    const offerInTinybars = Hbar.fromString(offerAmount).toTinybars();
    
    // Create contract execute transaction with offer payment (escrowed)
    const contractExecuteTx = new ContractExecuteTransaction()
      .setContractId(MARKETPLACE_CONTRACT_ID)
      .setGas(300000)
      .setPayableAmount(offerInTinybars)
      .setFunction(
        'makeOffer',
        new ContractFunctionParameters()
          .addUint256(listingId)
          .addUint256(duration)
      )
      .setMaxTransactionFee(new Hbar(5));
    
    // Only set TransactionId if not using Blade Wallet
    if (!signer || (typeof signer.call !== 'function' && typeof signer.populateTransaction !== 'function')) {
      contractExecuteTx.setTransactionId(TransactionId.generate(AccountId.fromString(accountId)));
    }
    
    console.log('📤 Executing offer transaction...');
    const result = await executeWithWallet(contractExecuteTx, signer, accountId);
    
    console.log('✅ Offer made successfully:', result);
    return {
      success: true,
      transactionId: result.transactionId,
      offerId: result.offerId, // Will be extracted from contract logs
      result: result
    };
    
  } catch (error) {
    console.error('❌ Error making offer:', error);
    throw error;
  }
}

/**
 * Accept an offer
 * @param {number} offerId - The offer ID to accept
 * @param {Object} signer - Wallet signer
 * @param {string} accountId - Seller account ID
 */
export async function acceptMarketplaceOffer(offerId, signer, accountId) {
  try {
    console.log('✅ Accepting marketplace offer...', { offerId });
    
    // Create contract execute transaction
    const contractExecuteTx = new ContractExecuteTransaction()
      .setContractId(MARKETPLACE_CONTRACT_ID)
      .setGas(300000)
      .setFunction(
        'acceptOffer',
        new ContractFunctionParameters().addUint256(offerId)
      )
      .setTransactionId(TransactionId.generate(AccountId.fromString(accountId)))
      .setMaxTransactionFee(new Hbar(5));
    
    console.log('📤 Executing accept offer transaction...');
    const result = await executeWithWallet(contractExecuteTx, signer, accountId);
    
    console.log('✅ Offer accepted successfully:', result);
    return {
      success: true,
      transactionId: result.transactionId,
      result: result
    };
    
  } catch (error) {
    console.error('❌ Error accepting offer:', error);
    throw error;
  }
}

/**
 * Cancel a listing
 * @param {number} listingId - The listing ID to cancel
 * @param {Object} signer - Wallet signer
 * @param {string} accountId - Seller account ID
 */
export async function cancelMarketplaceListing(listingId, signer, accountId) {
  try {
    console.log('❌ Cancelling marketplace listing...', { listingId });
    
    // Check if marketplace contract is deployed
    if (!MARKETPLACE_CONTRACT_ID) {
      throw new Error('Marketplace contract not deployed yet.');
    }
    
    // Use dynamic import for Hedera SDK
    const { 
      ContractExecuteTransaction, 
      ContractFunctionParameters, 
      Hbar, 
      AccountId, 
      TransactionId 
    } = await import('@hashgraph/sdk');
    
    // Create contract execute transaction
    const contractExecuteTx = new ContractExecuteTransaction()
      .setContractId(MARKETPLACE_CONTRACT_ID)
      .setGas(200000)
      .setFunction(
        'cancelListing',
        new ContractFunctionParameters().addUint256(listingId)
      )
      .setMaxTransactionFee(new Hbar(2));
    
    // Only set TransactionId if not using Blade Wallet
    if (!signer || (typeof signer.call !== 'function' && typeof signer.populateTransaction !== 'function')) {
      contractExecuteTx.setTransactionId(TransactionId.generate(AccountId.fromString(accountId)));
    }
    
    console.log('📤 Executing cancel listing transaction...', {
      listingId,
      contractId: MARKETPLACE_CONTRACT_ID,
      isBladeWallet: !!(signer && (typeof signer.call === 'function' || typeof signer.populateTransaction === 'function'))
    });
    
    const result = await executeWithWallet(contractExecuteTx, signer, accountId);
    
    console.log('✅ Listing cancelled successfully:', result);
    return {
      success: true,
      transactionId: result.transactionId,
      result: result
    };
    
  } catch (error) {
    console.error('❌ Error cancelling listing:', error);
    throw error;
  }
}

/**
 * Get active marketplace listings with pagination
 * @param {number} offset - Starting index
 * @param {number} limit - Number of listings to fetch
 */
export async function getMarketplaceListings(offset = 0, limit = 20) {
  try {
    console.log('📋 Fetching marketplace listings...', { offset, limit });
    
    // Check if marketplace contract is deployed
    if (!MARKETPLACE_CONTRACT_ID) {
      console.warn('⚠️ Marketplace contract not deployed yet');
      return [];
    }
    
    // Use dynamic import for Hedera SDK
    const { ContractCallQuery, ContractFunctionParameters } = await import('@hashgraph/sdk');
    
    const client = await getHederaClient();
    
    // Step 1: Get total count of active listings
    console.log('📊 Getting active listings count...');
    const countQuery = new ContractCallQuery()
      .setContractId(MARKETPLACE_CONTRACT_ID)
      .setGas(100000)
      .setFunction('getActiveListingsCount');
    
    const countResult = await countQuery.execute(client);
    const totalCount = countResult.getUint256(0);
    
    console.log('📊 Total active listings:', totalCount.toString());
    
    if (totalCount.eq(0)) {
      console.log('✅ No active listings found');
      return [];
    }
    
    // Step 2: Get listing IDs based on offset and limit
    const startIndex = offset;
    const endIndex = Math.min(offset + limit, totalCount.toNumber());
    const listings = [];
    
    console.log('📋 Fetching listings from index', startIndex, 'to', endIndex);
    
    // Get listing IDs and details
    for (let i = startIndex; i < endIndex; i++) {
      try {
        // Get listing ID by index
        const idQuery = new ContractCallQuery()
          .setContractId(MARKETPLACE_CONTRACT_ID)
          .setGas(100000)
          .setFunction(
            'getActiveListingId',
            new ContractFunctionParameters().addUint256(i)
          );
        
        const idResult = await idQuery.execute(client);
        const listingId = idResult.getUint256(0);
        
        console.log(`📋 Listing ${i}: ID = ${listingId.toString()}`);
        
        // Get listing details
        const detailQuery = new ContractCallQuery()
          .setContractId(MARKETPLACE_CONTRACT_ID)
          .setGas(150000)
          .setFunction(
            'getListing',
            new ContractFunctionParameters().addUint256(listingId)
          );
        
        const detailResult = await detailQuery.execute(client);
        const listing = parseListingDetails(detailResult, listingId.toString());
        
        if (listing && listing.isActive) {
          listings.push(listing);
          console.log(`✅ Added listing ${listingId.toString()}:`, listing);
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to fetch listing at index ${i}:`, error.message);
        continue;
      }
    }
    
    console.log(`✅ Found ${listings.length} active listings from smart contract`);
    return listings;
    
  } catch (error) {
    console.error('❌ Error fetching marketplace listings:', error);
    // Return empty array instead of throwing to avoid breaking the UI
    return [];
  }
}


/**
 * Get user's marketplace listings
 * @param {string} userAccountId - User's account ID
 */
export async function getUserMarketplaceListings(userAccountId) {
  try {
    console.log('👤 Fetching user marketplace listings...', { userAccountId });
    
    // Create contract call query
    const contractCallQuery = new ContractCallQuery()
      .setContractId(MARKETPLACE_CONTRACT_ID)
      .setGas(100000)
      .setFunction(
        'getUserListings',
        new ContractFunctionParameters().addAddress(userAccountId)
      );
    
    // Execute query
    const result = await contractCallQuery.execute(getHederaClient());
    
    // Parse the result
    const listingIds = parseUserListingsResult(result);
    
    // Fetch detailed listing information for each ID
    const listings = await Promise.all(
      listingIds.map(id => getListingDetails(id))
    );
    
    console.log('✅ Fetched user marketplace listings:', listings);
    return listings;
    
  } catch (error) {
    console.error('❌ Error fetching user marketplace listings:', error);
    throw error;
  }
}

/**
 * Get detailed information about a specific listing
 * @param {number} listingId - The listing ID
 */
export async function getListingDetails(listingId) {
  try {
    console.log('🔍 Fetching listing details...', { listingId });
    
    // Create contract call query
    const contractCallQuery = new ContractCallQuery()
      .setContractId(MARKETPLACE_CONTRACT_ID)
      .setGas(100000)
      .setFunction(
        'listings',
        new ContractFunctionParameters().addUint256(listingId)
      );
    
    // Execute query
    const result = await contractCallQuery.execute(getHederaClient());
    
    // Parse the result
    const listing = parseListingResult(result);
    
    console.log('✅ Fetched listing details:', listing);
    return listing;
    
  } catch (error) {
    console.error('❌ Error fetching listing details:', error);
    throw error;
  }
}

/**
 * Get user's escrow balance
 * @param {string} userAccountId - User's account ID
 */
export async function getUserEscrowBalance(userAccountId) {
  try {
    console.log('💰 Fetching user escrow balance...', { userAccountId });
    
    // Create contract call query
    const contractCallQuery = new ContractCallQuery()
      .setContractId(MARKETPLACE_CONTRACT_ID)
      .setGas(100000)
      .setFunction(
        'escrowBalances',
        new ContractFunctionParameters().addAddress(userAccountId)
      );
    
    // Execute query
    const result = await contractCallQuery.execute(getHederaClient());
    
    // Parse the result (balance in tinybars)
    const balanceInTinybars = result.getUint256(0);
    const balanceInHbar = Hbar.fromTinybars(balanceInTinybars).toString();
    
    console.log('✅ User escrow balance:', balanceInHbar);
    return balanceInHbar;
    
  } catch (error) {
    console.error('❌ Error fetching escrow balance:', error);
    throw error;
  }
}

/**
 * Withdraw from escrow
 * @param {string} amount - Amount to withdraw in HBAR
 * @param {Object} signer - Wallet signer
 * @param {string} accountId - User account ID
 */
export async function withdrawFromEscrow(amount, signer, accountId) {
  try {
    console.log('💸 Withdrawing from escrow...', { amount });
    
    // Convert amount to tinybars
    const amountInTinybars = Hbar.fromString(amount).toTinybars().toString();
    
    // Create contract execute transaction
    const contractExecuteTx = new ContractExecuteTransaction()
      .setContractId(MARKETPLACE_CONTRACT_ID)
      .setGas(200000)
      .setFunction(
        'withdrawEscrow',
        new ContractFunctionParameters().addUint256(amountInTinybars)
      )
      .setTransactionId(TransactionId.generate(AccountId.fromString(accountId)))
      .setMaxTransactionFee(new Hbar(2));
    
    console.log('📤 Executing withdrawal transaction...');
    const result = await executeWithWallet(contractExecuteTx, signer, accountId);
    
    console.log('✅ Withdrawal successful:', result);
    return {
      success: true,
      transactionId: result.transactionId,
      result: result
    };
    
  } catch (error) {
    console.error('❌ Error withdrawing from escrow:', error);
    throw error;
  }
}

/**
 * Register a new NFT collection in the marketplace
 * @param {Object} params - Collection parameters
 * @param {string} params.tokenAddress - NFT contract address
 * @param {string} params.name - Collection name
 * @param {string} params.symbol - Collection symbol
 * @param {number} params.royaltyPercentage - Default royalty percentage
 * @param {Object} signer - Wallet signer
 * @param {string} accountId - Creator account ID
 */
export async function registerCollection({
  tokenAddress,
  name,
  symbol,
  royaltyPercentage = 500 // 5% default
}, signer, accountId) {
  try {
    console.log('📚 Registering collection...', { tokenAddress, name, symbol });
    
    // Create contract execute transaction
    const contractExecuteTx = new ContractExecuteTransaction()
      .setContractId(MARKETPLACE_CONTRACT_ID)
      .setGas(200000)
      .setFunction(
        'registerCollection',
        new ContractFunctionParameters()
          .addAddress(tokenAddress)
          .addString(name)
          .addString(symbol)
          .addUint256(royaltyPercentage)
      )
      .setTransactionId(TransactionId.generate(AccountId.fromString(accountId)))
      .setMaxTransactionFee(new Hbar(2));
    
    console.log('📤 Executing collection registration...');
    const result = await executeWithWallet(contractExecuteTx, signer, accountId);
    
    console.log('✅ Collection registered successfully:', result);
    return {
      success: true,
      transactionId: result.transactionId,
      result: result
    };
    
  } catch (error) {
    console.error('❌ Error registering collection:', error);
    throw error;
  }
}

// ============ HELPER FUNCTIONS ============

/**
 * Provide troubleshooting guidance for CONTRACT_REVERT_EXECUTED errors
 */
function getContractRevertTroubleshooting() {
  return `
🚨 CONTRACT_REVERT_EXECUTED Troubleshooting Guide:

The transaction was signed and submitted successfully, but the smart contract rejected it.
DEPLOYED CONTRACT: 0.0.6893361 (NFTMarketplace_Optimized.sol)

✅ FIXED: Function signature mismatch - now using correct 5-parameter createListing()

Most likely remaining causes:

1. 🔐 NFT NOT APPROVED FOR MARKETPLACE (MOST COMMON!)
   - Your NFT must be approved for marketplace contract 0.0.6893361
   - Use: token.setApprovalForAll(0.0.6893361, true)
   - Or: token.approve(0.0.6893361, tokenId)

2. 🏷️ NFT OWNERSHIP ISSUES
   - Ensure you own the NFT you're trying to list
   - Token must be associated with your account
   - Check token address conversion is correct

3. 💰 PARAMETER VALIDATION
   - Price must be > 0 
   - Duration must be >= 86400 seconds (24 hours)
   - Token address must be valid (not 0x000...)

4. 🏗️ CONTRACT STATE ISSUES  
   - Contract might be paused
   - Token might already be listed
   - Check contract owner permissions

5. 🌐 NETWORK/ADDRESS ISSUES
   - Ensure wallet and contract on same network
   - Verify Hedera account ID to EVM address conversion

NEXT STEPS:
1. Check if your NFT is approved for marketplace contract 0.0.6893361
2. Verify you own the NFT you're trying to list  
3. Check the transaction on HashScan for specific revert reason
4. Test with a fresh NFT that you know you own and control
`;
}

/**
 * Convert Hedera account ID to EVM address format
 * @param {string} accountId - Hedera account ID (e.g., "0.0.123456") or EVM address
 * @returns {string} - EVM address format (40 hex characters with 0x prefix)
 */
export function convertToEvmAddress(accountId) {
  console.log('🔄 Converting address:', accountId, 'Type:', typeof accountId);
  
  // Handle null/undefined
  if (!accountId) {
    console.warn('Null/undefined account ID, using zero address');
    return '0x0000000000000000000000000000000000000000';
  }
  
  // Convert to string if not already
  const accountStr = String(accountId);
  
  // If it's already an EVM address (starts with 0x and has 42 chars), return as is
  if (accountStr.startsWith('0x') && accountStr.length === 42) {
    console.log('✅ Already EVM address:', accountStr);
    return accountStr;
  }
  
  // If it's a Hedera account ID format (0.0.123456)
  if (accountStr.match(/^\d+\.\d+\.\d+$/)) {
    const parts = accountStr.split('.');
    const shard = parseInt(parts[0]);
    const realm = parseInt(parts[1]);
    const accountNum = parseInt(parts[2]);
    
    // For Hedera, we typically use the account number for EVM conversion
    // This creates a deterministic mapping from Hedera account to EVM address
    const evmAddress = '0x' + accountNum.toString(16).padStart(40, '0');
    console.log('✅ Converted Hedera account to EVM:', accountStr, '->', evmAddress);
    return evmAddress;
  }
  
  // If it's just a number, treat it as account number
  if (/^\d+$/.test(accountStr)) {
    const accountNum = parseInt(accountStr);
    const evmAddress = '0x' + accountNum.toString(16).padStart(40, '0');
    console.log('✅ Converted number to EVM:', accountStr, '->', evmAddress);
    return evmAddress;
  }
  
  // Fallback: return a default address if conversion fails
  console.warn('❌ Unable to convert account ID to EVM address:', accountId);
  return '0x0000000000000000000000000000000000000000';
}

/**
 * Execute a transaction with the connected wallet
 * Following Blade Labs documentation: https://docs.bladelabs.io/docs/blade-wallet-demo-app/getting-started
 */
async function executeWithWallet(transaction, signer, accountId) {
  try {
    console.log('🔧 Executing transaction with wallet...', {
      accountId,
      signerType: typeof signer,
      signerMethods: signer ? Object.getOwnPropertyNames(signer) : []
    });

    // Check if we're using Blade Wallet (BladeSigner)
    if (signer && typeof signer.call === 'function') {
      console.log('🗡️ Using Blade Wallet (BladeSigner) for marketplace transaction...');
      
      try {
        // According to Blade docs, the correct pattern is:
        // 1. populateTransaction() - sets transaction ID and node accounts
        // 2. call() - executes the transaction
        
        console.log('📝 Step 1: Populating transaction with signer...');
        await signer.populateTransaction(transaction);
        
        console.log('📞 Step 2: Calling signer.call() to execute...');
        const result = await signer.call(transaction);
        
        console.log('✅ Blade Wallet transaction successful:', result);
        
        // Check if the transaction was successful or reverted
        if (result && result.receipt && result.receipt.status && result.receipt.status.toString() === 'SUCCESS') {
          console.log('🎉 Contract execution successful');
        } else if (result && result.receipt && result.receipt.status) {
          console.warn('⚠️ Contract execution status:', result.receipt.status.toString());
          if (result.receipt.status.toString().includes('REVERT')) {
            console.error('🚨 CONTRACT_REVERT_EXECUTED detected!');
            console.log(getContractRevertTroubleshooting());
            throw new Error(`Contract execution reverted: ${result.receipt.status.toString()}\n\n${getContractRevertTroubleshooting()}`);
          }
        }
        
        return {
          transactionId: result.transactionId?.toString() || 'unknown',
          result: result
        };
        
      } catch (bladeError) {
        console.error('❌ Blade Wallet execution failed:', bladeError);
        console.error('❌ Blade Error details:', {
          message: bladeError.message,
          name: bladeError.name,
          stack: bladeError.stack,
          cause: bladeError.cause
        });
        
        // Try direct call without populateTransaction as fallback
        try {
          console.log('🔄 Fallback: Trying direct call without populate...');
          const result = await signer.call(transaction);
          
          console.log('✅ Blade Wallet direct call successful:', result);
          return {
            transactionId: result.transactionId?.toString() || 'unknown',
            result: result
          };
          
        } catch (directError) {
          console.error('❌ Blade Wallet direct call also failed:', directError);
          console.error('❌ Direct Error details:', {
            message: directError.message,
            name: directError.name,
            stack: directError.stack,
            cause: directError.cause
          });
          throw new Error(`Blade Wallet execution failed: ${bladeError.message}. Direct call also failed: ${directError.message}`);
        }
      }
      
    } else if (signer && typeof signer.populateTransaction === 'function') {
      // Alternative Blade Wallet detection
      console.log('🔧 Using alternative Blade Wallet pattern...');
      
      try {
        await signer.populateTransaction(transaction);
        const result = await signer.call(transaction);
        
        return {
          transactionId: result.transactionId?.toString() || 'unknown',
          result: result
        };
      } catch (populateError) {
        console.error('❌ Alternative pattern failed:', populateError);
        throw populateError;
      }
      
    } else {
      // Other wallet flow (HashPack, etc.)
      console.log('🔧 Using standard wallet for marketplace transaction...');
      
      // This would need to be implemented based on the specific wallet
      throw new Error('Standard wallet integration not yet implemented for marketplace');
    }
  } catch (error) {
    console.error('❌ Error executing transaction with wallet:', error);
    throw error;
  }
}

/**
 * Get Hedera client for queries (server-side only)
 */
async function getHederaClient() {
  // Only import on server-side
  if (typeof window !== 'undefined') {
    throw new Error('Hedera client can only be used on server-side');
  }
  
  const { Client } = await import('@hashgraph/sdk');
  
  let client;
  
  // Configure client based on network
  if (NETWORK === 'mainnet') {
    client = Client.forMainnet();
  } else {
    client = Client.forTestnet();
  }
  
  // Set operator if available (for server-side queries)
  if (process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY) {
    client.setOperator(
      process.env.HEDERA_ACCOUNT_ID,
      process.env.HEDERA_PRIVATE_KEY
    );
  }
  
  return client;
}

/**
 * Parse contract result for a single listing from getListing function
 * @param {object} result - Contract call result
 * @param {string} listingId - The listing ID
 */
function parseListingDetails(result, listingId) {
  try {
    console.log('🔍 Parsing listing details for ID:', listingId);
    
    // The getListing function returns a Listing struct with these fields (HTS Simple):
    // struct Listing {
    //     address tokenAddress;     // 0
    //     uint256 tokenId;          // 1 (Back to uint256 for ERC721 compatibility)
    //     address seller;           // 2
    //     uint256 price;            // 3
    //     uint256 expirationTime;   // 4
    //     bool isActive;            // 5
    //     bool isAuction;           // 6
    //     uint256 highestBid;       // 7
    //     address highestBidder;    // 8
    // }
    
    const tokenAddress = result.getAddress(0);
    const tokenId = result.getUint256(1); // Back to getUint256 for ERC721 compatibility
    const seller = result.getAddress(2);
    const price = result.getUint256(3);
    const expirationTime = result.getUint256(4);
    const isActive = result.getBool(5);
    const isAuction = result.getBool(6);
    const highestBid = result.getUint256(7);
    const highestBidder = result.getAddress(8);
    
    // Convert to a more usable format
    const listing = {
      id: listingId,
      listingId: listingId, // Add both for compatibility
      tokenAddress,
      tokenId: tokenId.toString(),
      seller,
      price: price.toString(),
      priceInHBAR: (price.toNumber() / 100000000).toFixed(2), // Convert from tinybars to HBAR
      expirationTime: new Date(expirationTime.toNumber() * 1000).toISOString(),
      isActive,
      isAuction,
      highestBid: highestBid.toString(),
      highestBidInHBAR: (highestBid.toNumber() / 100000000).toFixed(2),
      highestBidder,
      // Additional computed fields
      isExpired: Date.now() > (expirationTime.toNumber() * 1000),
      timeRemaining: Math.max(0, (expirationTime.toNumber() * 1000) - Date.now())
    };
    
    console.log('✅ Parsed listing:', listing);
    return listing;
    
  } catch (error) {
    console.error('❌ Error parsing listing details:', error);
    return null;
  }
}

/**
 * Parse contract result for user listings
 */
function parseUserListingsResult(result) {
  // This would parse the contract result into an array of listing IDs
  console.log('🔍 Parsing user listings result:', result);
  
  // Placeholder implementation
  return [];
}

/**
 * Parse contract result for a single listing
 */
function parseListingResult(result) {
  // This would parse the contract result into a listing object
  console.log('🔍 Parsing listing result:', result);
  
  // Placeholder implementation
  return {
    listingId: 0,
    tokenAddress: '',
    tokenId: 0,
    seller: '',
    price: '0',
    expirationTime: 0,
    isActive: false,
    isAuction: false
  };
}

export default {
  createMarketplaceListing,
  purchaseNFTFromMarketplace,
  placeBidOnAuction,
  makeOfferOnListing,
  acceptMarketplaceOffer,
  cancelMarketplaceListing,
  getMarketplaceListings,
  getUserMarketplaceListings,
  getListingDetails,
  getUserEscrowBalance,
  withdrawFromEscrow,
  registerCollection
};
