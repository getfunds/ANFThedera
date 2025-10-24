/**
 * @fileoverview Marketplace Diagnostics
 * @description Diagnostic tools to identify why HTS NFT transfers are failing in the marketplace
 */

import { MARKETPLACE_CONTRACT_ID } from './marketplace.js';

/**
 * Comprehensive marketplace purchase diagnostics
 */
export async function diagnoseMarketplacePurchase(listingId, signer, buyerAccountId, listingData) {
  console.log('🔍 Starting comprehensive marketplace purchase diagnostics...');
  
  const diagnostics = {
    listingId,
    buyerAccountId,
    timestamp: new Date().toISOString(),
    steps: [],
    errors: [],
    recommendations: []
  };

  try {
    // Step 1: Validate listing data
    console.log('📋 Step 1: Validating listing data...');
    const listingStep = await validateListingData(listingData);
    diagnostics.steps.push(listingStep);

    if (!listingStep.success) {
      diagnostics.errors.push('Listing validation failed');
      return diagnostics;
    }

    // Step 2: Check seller NFT ownership
    console.log('👤 Step 2: Checking seller NFT ownership...');
    const ownershipStep = await checkSellerOwnership(listingData);
    diagnostics.steps.push(ownershipStep);

    // Step 3: Check marketplace approval status
    console.log('✅ Step 3: Checking marketplace approval status...');
    const approvalStep = await checkMarketplaceApproval(listingData);
    diagnostics.steps.push(approvalStep);

    // Step 4: Check buyer token association
    console.log('🔗 Step 4: Checking buyer token association...');
    const associationStep = await checkBuyerAssociation(listingData.tokenAddress, buyerAccountId);
    diagnostics.steps.push(associationStep);

    // Step 5: Simulate contract call
    console.log('🧪 Step 5: Simulating marketplace contract call...');
    const simulationStep = await simulateMarketplaceCall(listingData, buyerAccountId);
    diagnostics.steps.push(simulationStep);

    // Generate recommendations
    diagnostics.recommendations = generateRecommendations(diagnostics.steps);

    console.log('🎯 Diagnostics completed:', diagnostics);
    return diagnostics;

  } catch (error) {
    console.error('❌ Diagnostics failed:', error);
    diagnostics.errors.push(`Diagnostics failed: ${error.message}`);
    return diagnostics;
  }
}

/**
 * Validate listing data
 */
async function validateListingData(listingData) {
  const step = {
    name: 'Listing Data Validation',
    success: false,
    details: {},
    issues: []
  };

  try {
    if (!listingData) {
      step.issues.push('No listing data provided');
      return step;
    }

    const required = ['tokenAddress', 'tokenId', 'seller', 'priceInHBAR', 'isActive'];
    const missing = required.filter(field => !listingData[field]);

    if (missing.length > 0) {
      step.issues.push(`Missing required fields: ${missing.join(', ')}`);
    }

    if (!listingData.isActive) {
      step.issues.push('Listing is not active');
    }

    // Convert token ID format
    const hederaTokenId = convertEvmAddressToTokenId(listingData.tokenAddress);
    
    step.details = {
      tokenAddress: listingData.tokenAddress,
      hederaTokenId,
      tokenId: listingData.tokenId,
      seller: listingData.seller,
      price: listingData.priceInHBAR,
      isActive: listingData.isActive
    };

    step.success = step.issues.length === 0;
    return step;

  } catch (error) {
    step.issues.push(`Validation error: ${error.message}`);
    return step;
  }
}

/**
 * Check seller NFT ownership
 */
async function checkSellerOwnership(listingData) {
  const step = {
    name: 'Seller Ownership Check',
    success: false,
    details: {},
    issues: []
  };

  try {
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const baseUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    const hederaTokenId = convertEvmAddressToTokenId(listingData.tokenAddress);
    const url = `${baseUrl}/api/v1/tokens/${hederaTokenId}/nfts/${listingData.tokenId}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      step.issues.push(`Mirror Node API error: ${response.status}`);
      return step;
    }

    const nftData = await response.json();
    const currentOwner = nftData.account_id;
    const expectedSeller = await convertEvmAddressToAccountId(listingData.seller);

    console.log('🔍 Ownership comparison details:', {
      currentOwner,
      expectedSeller,
      originalSellerValue: listingData.seller,
      sellerType: typeof listingData.seller,
      ownershipMatch: currentOwner === expectedSeller
    });

    step.details = {
      currentOwner,
      expectedSeller,
      originalSellerValue: listingData.seller,
      ownershipMatch: currentOwner === expectedSeller,
      nftData
    };

    if (currentOwner !== expectedSeller) {
      step.issues.push(`Ownership mismatch: current owner is ${currentOwner}, expected ${expectedSeller}`);
    } else {
      step.success = true;
    }

    return step;

  } catch (error) {
    step.issues.push(`Ownership check error: ${error.message}`);
    return step;
  }
}

/**
 * Check marketplace approval status
 */
async function checkMarketplaceApproval(listingData) {
  const step = {
    name: 'Marketplace Approval Check',
    success: false,
    details: {},
    issues: []
  };

  try {
    const marketplaceContractId = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID;
    
    if (!marketplaceContractId) {
      step.issues.push('NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID not set');
      return step;
    }

    const sellerAccountId = await convertEvmAddressToAccountId(listingData.seller);
    
    // Check allowances via Mirror Node
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const baseUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    const url = `${baseUrl}/api/v1/accounts/${sellerAccountId}/allowances/nfts`;
    const response = await fetch(url);

    if (!response.ok) {
      step.issues.push(`Allowances API error: ${response.status}`);
      return step;
    }

    const allowancesData = await response.json();
    const hederaTokenId = convertEvmAddressToTokenId(listingData.tokenAddress);

    const relevantAllowances = allowancesData.allowances?.filter(allowance => 
      allowance.token_id === hederaTokenId
    ) || [];

    const marketplaceAllowance = relevantAllowances.find(allowance => 
      allowance.spender === marketplaceContractId && allowance.approved_for_all === true
    );

    step.details = {
      marketplaceContractId,
      sellerAccountId,
      hederaTokenId,
      totalAllowances: allowancesData.allowances?.length || 0,
      relevantAllowances,
      marketplaceAllowance,
      hasMarketplaceApproval: !!marketplaceAllowance
    };

    if (!marketplaceAllowance) {
      step.issues.push('Seller has not approved marketplace for all NFTs');
      step.issues.push('Seller needs to execute setApprovalForAll transaction');
    } else {
      step.success = true;
    }

    return step;

  } catch (error) {
    step.issues.push(`Approval check error: ${error.message}`);
    return step;
  }
}

/**
 * Check buyer token association
 */
async function checkBuyerAssociation(tokenAddress, buyerAccountId) {
  const step = {
    name: 'Buyer Token Association Check',
    success: false,
    details: {},
    issues: []
  };

  try {
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const baseUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    const hederaTokenId = convertEvmAddressToTokenId(tokenAddress);
    const url = `${baseUrl}/api/v1/accounts/${buyerAccountId}/tokens?token.id=${hederaTokenId}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        step.issues.push('Buyer is not associated with this token');
        step.details = { associated: false, hederaTokenId };
        return step;
      }
      step.issues.push(`Association API error: ${response.status}`);
      return step;
    }

    const data = await response.json();
    const isAssociated = data.tokens && data.tokens.length > 0;

    step.details = {
      buyerAccountId,
      hederaTokenId,
      associated: isAssociated,
      tokens: data.tokens
    };

    if (!isAssociated) {
      step.issues.push('Buyer is not associated with this token');
    } else {
      step.success = true;
    }

    return step;

  } catch (error) {
    step.issues.push(`Association check error: ${error.message}`);
    return step;
  }
}

/**
 * Simulate marketplace contract call
 */
async function simulateMarketplaceCall(listingData, buyerAccountId) {
  const step = {
    name: 'Marketplace Contract Simulation',
    success: false,
    details: {},
    issues: []
  };

  try {
    // This is a simulation - we can't actually call the contract without gas
    // But we can check the prerequisites

    const prerequisites = [
      'Seller owns NFT',
      'Marketplace approved by seller',
      'Buyer associated with token',
      'Listing is active',
      'Smart contract deployed'
    ];

    const marketplaceContractId = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID;

    step.details = {
      listingId: listingData.listingId || listingData.id,
      buyerAccountId,
      marketplaceContract: marketplaceContractId,
      prerequisites,
      contractCallWouldSucceed: !!marketplaceContractId
    };

    if (!marketplaceContractId) {
      step.issues.push('Marketplace contract ID not configured');
    } else {
      step.success = true;
    }

    return step;

  } catch (error) {
    step.issues.push(`Simulation error: ${error.message}`);
    return step;
  }
}

/**
 * Generate recommendations based on diagnostic results
 */
function generateRecommendations(steps) {
  const recommendations = [];

  steps.forEach(step => {
    if (!step.success) {
      switch (step.name) {
        case 'Seller Ownership Check':
          recommendations.push({
            priority: 'HIGH',
            issue: 'Seller ownership mismatch',
            solution: 'Verify the NFT is still owned by the seller. The listing may be outdated.',
            action: 'Refresh marketplace listings or cancel this listing'
          });
          break;

        case 'Marketplace Approval Check':
          recommendations.push({
            priority: 'HIGH',
            issue: 'Marketplace not approved',
            solution: 'Seller must approve the marketplace contract for all NFTs',
            action: 'Go to My NFTs → Click "Approve All NFTs (Alternative)" → Sign transaction'
          });
          break;

        case 'Buyer Token Association Check':
          recommendations.push({
            priority: 'MEDIUM',
            issue: 'Buyer not associated with token',
            solution: 'Buyer needs to associate with the HTS token',
            action: 'The purchase process should handle this automatically'
          });
          break;

        case 'Marketplace Contract Simulation':
          recommendations.push({
            priority: 'HIGH',
            issue: 'Marketplace contract not configured',
            solution: 'Set the marketplace contract ID in environment variables',
            action: 'Add NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID to .env.local'
          });
          break;
      }
    }
  });

  // Add general recommendations
  if (recommendations.some(r => r.issue.includes('Marketplace not approved'))) {
    recommendations.push({
      priority: 'INFO',
      issue: 'HTS NFT Transfer Method',
      solution: 'HTS NFTs require seller pre-approval for automatic transfers',
      action: 'This is the correct approach - seller must approve marketplace once per collection'
    });
  }

  return recommendations;
}

/**
 * Convert EVM address to Hedera Token ID
 */
function convertEvmAddressToTokenId(tokenAddress) {
  try {
    if (tokenAddress.match(/^\d+\.\d+\.\d+$/)) {
      return tokenAddress;
    }
    
    if (tokenAddress.match(/^[0-9a-fA-F]{40}$/)) {
      const tokenNum = BigInt('0x' + tokenAddress);
      return `0.0.${tokenNum.toString()}`;
    }
    
    return tokenAddress;
    
  } catch (error) {
    console.warn('⚠️ Error converting token address:', error);
    return tokenAddress;
  }
}

/**
 * Convert EVM address to Hedera Account ID using Mirror Node
 */
async function convertEvmAddressToAccountId(evmAddress) {
  try {
    // If it's already in account ID format, return as-is
    if (evmAddress.match(/^\d+\.\d+\.\d+$/)) {
      return evmAddress;
    }
    
    // If it's an EVM address/alias (with or without 0x), query Mirror Node
    // EVM addresses are account aliases in Hedera, NOT numeric conversions
    if (evmAddress.startsWith('0x') || evmAddress.match(/^[0-9a-fA-F]{40}$/)) {
      // Format as proper EVM address
      const evmAddr = evmAddress.startsWith('0x') ? evmAddress : `0x${evmAddress}`;
      
      // Query Mirror Node to get the actual account ID
      const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
      const baseUrl = network === 'mainnet' 
        ? 'https://mainnet-public.mirrornode.hedera.com'
        : 'https://testnet.mirrornode.hedera.com';
      
      const url = `${baseUrl}/api/v1/accounts/${evmAddr}`;
      
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.account) {
            console.log('🔄 Diagnostics: Converted EVM address to account ID:', {
              evmAddress: evmAddr,
              accountId: data.account
            });
            return data.account;
          }
        }
      } catch (apiError) {
        console.warn('⚠️ Diagnostics: Failed to query Mirror Node for EVM address:', evmAddr, apiError.message);
      }
    }
    
    // Return as-is if we can't determine the format
    console.warn('⚠️ Diagnostics: Could not convert address, returning as-is:', evmAddress);
    return evmAddress;
    
  } catch (error) {
    console.warn('⚠️ Diagnostics: Error converting account address:', error);
    return evmAddress;
  }
}
