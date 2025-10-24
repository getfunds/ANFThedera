/**
 * @fileoverview HTS NFT Transfer Utilities
 * @description Proper HTS NFT transfers using Hedera SDK (not smart contracts)
 * 
 * Key insight: HTS NFTs cannot be transferred using standard ERC721 methods.
 * They must be transferred using Hedera's native SDK transactions.
 */

/**
 * Transfer HTS NFT using Hedera SDK TransferTransaction
 * This is the CORRECT way to transfer HTS NFTs
 */
export async function transferHTSNFT({
  tokenId,
  serialNumber,
  fromAccountId,
  toAccountId,
  signer
}) {
  try {
    console.log('🔄 Starting HTS NFT transfer using Hedera SDK...', {
      tokenId,
      serialNumber,
      fromAccountId,
      toAccountId
    });

    // Validate inputs
    if (!tokenId || !serialNumber || !fromAccountId || !toAccountId || !signer) {
      throw new Error('Missing required parameters for HTS NFT transfer');
    }

    // Import Hedera SDK
    const {
      TransferTransaction,
      TokenId,
      AccountId,
      NftId,
      Hbar
    } = await import('@hashgraph/sdk');

    // Step 1: Ensure recipient is associated with the token
    console.log('🔗 Ensuring token association...');
    const associationResult = await ensureTokenAssociation(tokenId, toAccountId, signer);
    console.log('📋 Association result:', associationResult);

    // Step 2: Create the transfer transaction
    console.log('📦 Creating HTS NFT transfer transaction...');
    
    const transferTx = new TransferTransaction()
      .addNftTransfer(
        TokenId.fromString(tokenId),
        parseInt(serialNumber),
        AccountId.fromString(fromAccountId),
        AccountId.fromString(toAccountId)
      )
      .setMaxTransactionFee(new Hbar(10));

    console.log('🔐 Executing transfer with wallet...');
    console.log('📋 Transfer transaction details:', {
      tokenId,
      serialNumber: parseInt(serialNumber),
      from: fromAccountId,
      to: toAccountId,
      maxFee: '10 HBAR'
    });

    // Step 3: Execute with wallet (don't freeze - let Blade handle it)
    try {
      await signer.populateTransaction(transferTx);
      const result = await signer.call(transferTx);
      console.log('✅ HTS NFT transfer result:', result);
      
      if (!result.transactionId) {
        throw new Error('Transfer transaction completed but no transaction ID returned');
      }
      
      return {
        success: true,
        transactionId: result.transactionId.toString(),
        method: 'Hedera SDK TransferTransaction',
        associationAttempted: true,
        associationSuccess: associationResult.success,
        transferSuccess: true,
        errorMessage: 'HTS NFT transfer completed using Hedera SDK'
      };
      
    } catch (transferError) {
      console.error('❌ Transfer execution failed:', transferError);
      throw new Error(`Transfer execution failed: ${transferError.message}`);
    }

  } catch (error) {
    console.error('❌ HTS NFT transfer failed:', error);

    return {
      success: false,
      transactionId: null,
      method: 'Hedera SDK TransferTransaction',
      associationAttempted: true,
      associationSuccess: false,
      transferSuccess: false,
      errorMessage: `HTS NFT transfer failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Ensure token is associated with account
 */
export async function ensureTokenAssociation(tokenId, accountId, signer) {
  try {
    console.log('🔗 Checking/ensuring token association...', { tokenId, accountId });

    const {
      TokenAssociateTransaction,
      TokenId,
      AccountId,
      Hbar
    } = await import('@hashgraph/sdk');

    const associateTx = new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(accountId))
      .setTokenIds([TokenId.fromString(tokenId)])
      .setMaxTransactionFee(new Hbar(5));

    console.log('🔐 Executing association with wallet...');

    try {
      await signer.populateTransaction(associateTx);
      const result = await signer.call(associateTx);

      console.log('✅ Token association successful:', result);

      return {
        success: true,
        transactionId: result.transactionId?.toString(),
        message: 'Token associated successfully'
      };

    } catch (associationError) {
      if (associationError.message.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
        console.log('ℹ️ Token already associated with account');
        return {
          success: true,
          transactionId: null,
          message: 'Token already associated'
        };
      } else {
        console.warn('⚠️ Token association failed:', associationError.message);
        return {
          success: false,
          transactionId: null,
          message: `Association failed: ${associationError.message}`
        };
      }
    }

  } catch (error) {
    console.error('❌ Token association error:', error);
    return {
      success: false,
      transactionId: null,
      message: `Association error: ${error.message}`
    };
  }
}

/**
 * Transfer HTS NFT using CryptoTransfer (alternative method)
 */
export async function cryptoTransferHTSNFT({
  tokenId,
  serialNumber,
  fromAccountId,
  toAccountId,
  signer
}) {
  try {
    console.log('🔄 Starting HTS NFT transfer using CryptoTransfer...', {
      tokenId,
      serialNumber,
      fromAccountId,
      toAccountId
    });

    // Import Hedera SDK
    const {
      TransferTransaction,
      TokenId,
      AccountId,
      Hbar
    } = await import('@hashgraph/sdk');

    // Step 1: Ensure token association
    const associationResult = await ensureTokenAssociation(tokenId, toAccountId, signer);

    // Step 2: Create crypto transfer
    const cryptoTransferTx = new TransferTransaction()
      .addNftTransfer(
        TokenId.fromString(tokenId),
        parseInt(serialNumber),
        AccountId.fromString(fromAccountId),
        AccountId.fromString(toAccountId)
      )
      .setMaxTransactionFee(new Hbar(15));

    console.log('🔐 Executing crypto transfer with wallet...');

    await signer.populateTransaction(cryptoTransferTx);
    const result = await signer.call(cryptoTransferTx);

    console.log('✅ CryptoTransfer result:', result);

    return {
      success: true,
      transactionId: result.transactionId?.toString(),
      method: 'Hedera SDK CryptoTransfer',
      associationAttempted: true,
      associationSuccess: associationResult.success,
      transferSuccess: !!result.transactionId,
      errorMessage: 'HTS NFT crypto transfer completed'
    };

  } catch (error) {
    console.error('❌ CryptoTransfer failed:', error);

    return {
      success: false,
      transactionId: null,
      method: 'Hedera SDK CryptoTransfer',
      associationAttempted: true,
      associationSuccess: false,
      transferSuccess: false,
      errorMessage: `CryptoTransfer failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Check if account is associated with token using Mirror Node
 */
export async function checkTokenAssociation(tokenId, accountId) {
  try {
    console.log('🔍 Checking token association via Mirror Node...', { tokenId, accountId });

    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const baseUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    const response = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`);

    if (!response.ok) {
      throw new Error(`Mirror Node API error: ${response.status}`);
    }

    const data = await response.json();
    const isAssociated = data.tokens && data.tokens.length > 0;

    console.log('📊 Token association check:', { tokenId, accountId, isAssociated });

    return {
      isAssociated,
      details: data
    };

  } catch (error) {
    console.error('❌ Error checking token association:', error);
    return {
      isAssociated: false,
      error: error.message
    };
  }
}

/**
 * Verify NFT ownership using Mirror Node
 */
export async function verifyNFTOwnership(tokenId, serialNumber) {
  try {
    console.log('🔍 Verifying NFT ownership...', { tokenId, serialNumber });

    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const baseUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    const response = await fetch(`${baseUrl}/api/v1/tokens/${tokenId}/nfts/${serialNumber}`);

    if (!response.ok) {
      throw new Error(`Mirror Node API error: ${response.status}`);
    }

    const nftData = await response.json();
    const currentOwner = nftData.account_id;

    console.log('📊 NFT ownership:', { tokenId, serialNumber, currentOwner });

    return {
      currentOwner,
      nftData
    };

  } catch (error) {
    console.error('❌ Error verifying NFT ownership:', error);
    throw error;
  }
}
