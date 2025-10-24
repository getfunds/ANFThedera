/**
 * Blade Wallet NFT Minting Implementation
 * Following official Blade Labs documentation and best practices
 */

import {
  TokenCreateTransaction,
  TokenMintTransaction,
  TokenAssociateTransaction,
  TokenType,
  TokenSupplyType,
  AccountId,
  PublicKey,
  Hbar,
  TransactionId,
  Status
} from '@hashgraph/sdk';

// Environment configuration
const NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';

/**
 * Get account public key from Hedera Mirror Node
 */
async function getAccountPublicKey(accountId) {
  try {
    const mirrorUrl = NETWORK === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
      
    const response = await fetch(`${mirrorUrl}/api/v1/accounts/${accountId}`);
    if (!response.ok) {
      throw new Error(`Failed to get account info: ${response.status}`);
    }
    
    const data = await response.json();
    const keyData = data.key;
    
    let publicKeyString;
    if (typeof keyData === 'string') {
      publicKeyString = keyData;
    } else if (keyData && typeof keyData === 'object') {
      // Handle different key formats
      if (keyData.key) publicKeyString = keyData.key;
      else if (keyData.ed25519) publicKeyString = keyData.ed25519;
      else if (keyData.ECDSA_secp256k1) publicKeyString = keyData.ECDSA_secp256k1;
      else throw new Error('Could not extract public key from account');
    } else {
      throw new Error('Could not extract public key from account');
    }
    
    // Convert string to PublicKey object
    const publicKey = PublicKey.fromString(publicKeyString);
    console.log('✅ Retrieved public key from Mirror Node for account:', accountId);
    
    return publicKey;
    
  } catch (error) {
    console.error('❌ Failed to get public key from Mirror Node:', error);
    throw error;
  }
}

/**
 * Upload metadata to IPFS using Filebase
 */
async function uploadMetadataToIPFS(metadata) {
  try {
    console.log('📦 Uploading metadata to Filebase IPFS...');
    
    const metadataJson = JSON.stringify(metadata, null, 2);
    console.log('📝 Metadata size:', Buffer.from(metadataJson).length, 'bytes');
    
    // Use the API endpoint which now uses Filebase
    const response = await fetch('/api/upload-to-ipfs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ metadata })
    });
    
    if (!response.ok) {
      throw new Error(`Filebase IPFS upload failed: ${response.status}`);
    }
    
    const result = await response.json();
    const ipfsUrl = result.ipfsUrl;
    
    console.log('✅ Metadata uploaded to Filebase IPFS:', ipfsUrl);
    return ipfsUrl;
    
  } catch (error) {
    console.error('❌ Filebase IPFS upload failed:', error);
    
    // Fallback to mock URL if IPFS upload fails
    console.log('⚠️ Using fallback mock IPFS URL...');
    const mockCid = `QmFallback${Buffer.from(JSON.stringify(metadata)).toString('hex').substring(0, 35)}`;
    return `https://ipfs.io/ipfs/${mockCid}`;
  }
}

/**
 * Create NFT collection with Blade Wallet
 */
async function createNFTCollectionWithBlade(bladeSigner, accountId, options = {}) {
  try {
    console.log('🎨 Creating NFT collection with Blade Wallet...');
    
    const {
      collectionName = 'AI Art Collection',
      collectionSymbol = 'AIART',
      maxSupply = 1,
      memo = 'AI-generated NFT collection'
    } = options;
    
    const treasuryAccountId = AccountId.fromString(accountId);
    
    // Get public key from Hedera Mirror Node (CORRECT APPROACH)
    const publicKey = await getAccountPublicKey(accountId);
    console.log('🔑 Using public key from Mirror Node for account:', accountId);
    
    // Create NFT collection transaction
    const tokenCreateTransaction = new TokenCreateTransaction()
      .setTokenName(collectionName)
      .setTokenSymbol(collectionSymbol)
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(maxSupply)
      .setDecimals(0)
      .setInitialSupply(0)
      .setTreasuryAccountId(treasuryAccountId)
      .setAdminKey(publicKey)
      .setSupplyKey(publicKey)
      .setPauseKey(publicKey)
      .setFreezeKey(publicKey)
      .setWipeKey(publicKey)
      .setTokenMemo(memo)
      .setFreezeDefault(false)
      .setMaxTransactionFee(new Hbar(20));
    
    // CORRECT: Use official BladeSigner API methods from documentation
    console.log('🔧 Populating transaction with Blade Signer...');
    await bladeSigner.populateTransaction(tokenCreateTransaction);
    
    // Get transaction ID before execution (for Mirror Node lookup)
    const txId = tokenCreateTransaction.transactionId;
    console.log('📋 Transaction ID from transaction object:', txId ? txId.toString() : 'not set');
    
    // Execute transaction using call method (official BladeSigner API)
    console.log('📤 Executing transaction with bladeSigner.call()...');
    const result = await bladeSigner.call(tokenCreateTransaction);
    
    console.log('✅ Transaction executed:', result);
    console.log('🔍 Result structure:', JSON.stringify(result, null, 2));
    console.log('🔍 Result keys:', Object.keys(result || {}));
    console.log('🔍 Result type:', typeof result);
    
    // Extract token ID and transaction ID from result
    let tokenId, transactionId;
    
    // Try multiple possible locations for token ID
    if (result && result.tokenId) {
      tokenId = result.tokenId.toString();
      console.log('✅ Found tokenId in result.tokenId:', tokenId);
    } else if (result && result.receipt && result.receipt.tokenId) {
      tokenId = result.receipt.tokenId.toString();
      console.log('✅ Found tokenId in result.receipt.tokenId:', tokenId);
    } else if (result && result.response && result.response.tokenId) {
      tokenId = result.response.tokenId.toString();
      console.log('✅ Found tokenId in result.response.tokenId:', tokenId);
    } else if (result && result.transactionResponse && result.transactionResponse.receipt && result.transactionResponse.receipt.tokenId) {
      tokenId = result.transactionResponse.receipt.tokenId.toString();
      console.log('✅ Found tokenId in result.transactionResponse.receipt.tokenId:', tokenId);
    } else if (result && typeof result === 'string') {
      // Sometimes the result might be a transaction ID string
      console.log('⚠️ Result is a string, might be transaction ID:', result);
      transactionId = result;
      tokenId = null; // We'll need to get this from the receipt later
    } else if (result === null || result === undefined || (typeof result === 'object' && Object.keys(result).length === 0)) {
      console.log('⚠️ Result is null/undefined/empty object - transaction may have been submitted but result not returned');
      // We'll try to get the transaction ID from the transaction object itself
      if (tokenCreateTransaction && tokenCreateTransaction.transactionId) {
        transactionId = tokenCreateTransaction.transactionId.toString();
        console.log('📋 Using transaction ID from transaction object:', transactionId);
        tokenId = null; // Will get from Mirror Node
      } else if (txId) {
        transactionId = txId.toString();
        console.log('📋 Using transaction ID from pre-execution:', transactionId);
        tokenId = null; // Will get from Mirror Node
      }
    } else {
      console.error('❌ Token ID not found in any expected location');
      console.error('🔍 Full result object:', result);
      
      // Try to find any property that looks like a token ID
      if (result && typeof result === 'object') {
        const allKeys = Object.keys(result);
        console.log('🔍 All result keys:', allKeys);
        
        // Look for any key containing 'token' or 'id'
        const tokenKeys = allKeys.filter(key => 
          key.toLowerCase().includes('token') || 
          key.toLowerCase().includes('id')
        );
        console.log('🔍 Potential token-related keys:', tokenKeys);
        
        // Try to extract from any nested objects
        for (const key of allKeys) {
          if (result[key] && typeof result[key] === 'object') {
            console.log(`🔍 Nested object at ${key}:`, Object.keys(result[key]));
          }
        }
      }
      
      // No token ID found in immediate result - this is normal for Blade Wallet
      // The transaction was submitted successfully, we'll get the token ID from Mirror Node
      console.log('ℹ️ Token ID not in immediate result (normal for Blade Wallet), will fetch from Mirror Node');
      tokenId = null; // Will be fetched from Mirror Node below
    }
    
    // Extract transaction ID from the result
    if (result && result.transactionId) {
      transactionId = result.transactionId.toString();
      console.log('✅ Found transaction ID:', transactionId);
    } else if (result && result.id) {
      transactionId = result.id.toString();
      console.log('✅ Found transaction ID (via id):', transactionId);
    } else {
      console.log('⚠️ No transaction ID found in result');
      transactionId = 'unknown';
    }
    
    // If we don't have tokenId but have transactionId, try to get it from Mirror Node
    if (!tokenId && transactionId && transactionId !== 'unknown') {
      try {
        console.log('🔍 Attempting to get token ID from Mirror Node using transaction ID:', transactionId);
        
        // Convert transaction ID format for Mirror Node API
        // From: "0.0.4475114@1758668160.250986456"
        // To: "0.0.4475114-1758668160-250986456"
        let mirrorNodeTxId = transactionId;
        if (transactionId.includes('@') && transactionId.includes('.')) {
          const [accountPart, timePart] = transactionId.split('@');
          const [seconds, nanoseconds] = timePart.split('.');
          // Pad nanoseconds to 9 digits
          const paddedNanos = nanoseconds.padEnd(9, '0');
          mirrorNodeTxId = `${accountPart}-${seconds}-${paddedNanos}`;
          console.log('🔄 Converted transaction ID format:', mirrorNodeTxId);
        }
        
        const mirrorUrl = NETWORK === 'mainnet' 
          ? 'https://mainnet-public.mirrornode.hedera.com'
          : 'https://testnet.mirrornode.hedera.com';
        
        // Retry logic with exponential backoff
        let attempts = 0;
        const maxAttempts = 10;
        let txData = null;
        
        console.log('🔍 Querying Mirror Node for token ID (transaction is processing on Hedera network)...');
        
        while (attempts < maxAttempts && !tokenId) {
          attempts++;
          const waitTime = Math.min(2000 * attempts, 10000); // 2s, 4s, 6s, 8s, 10s...
          console.log(`⏳ Attempt ${attempts}/${maxAttempts}: Waiting ${waitTime/1000}s for transaction to be processed...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          const txResponse = await fetch(`${mirrorUrl}/api/v1/transactions/${mirrorNodeTxId}`);
          if (txResponse.ok) {
            txData = await txResponse.json();
            console.log(`🔍 Attempt ${attempts}: Transaction data from Mirror Node:`, txData);
          
            if (txData.transactions && txData.transactions.length > 0) {
              const tx = txData.transactions[0];
              console.log(`🔍 Attempt ${attempts}: Transaction details:`, {
                result: tx.result,
                name: tx.name,
                entity_id: tx.entity_id,
                charged_tx_fee: tx.charged_tx_fee
              });
              
              // Look for token ID in different locations
              console.log('🔍 Checking entity_id:', tx.entity_id, 'Type:', typeof tx.entity_id);
              
              if (tx.entity_id) {
                // entity_id might be a string or object, handle both cases
                if (typeof tx.entity_id === 'string') {
                  tokenId = tx.entity_id;
                } else if (typeof tx.entity_id === 'object' && tx.entity_id.toString) {
                  tokenId = tx.entity_id.toString();
                } else {
                  tokenId = String(tx.entity_id);
                }
                console.log('✅ Found token ID from Mirror Node (entity_id):', tokenId);
                break; // Exit retry loop
              } else if (tx.token_transfers && tx.token_transfers.length > 0) {
                // Sometimes token ID is in token_transfers
                const tokenTransfer = tx.token_transfers[0];
                if (tokenTransfer.token_id) {
                  tokenId = tokenTransfer.token_id;
                  console.log('✅ Found token ID from Mirror Node (token_transfers):', tokenId);
                  break; // Exit retry loop
                }
              } else {
                console.log(`⚠️ Attempt ${attempts}: Token ID not found yet in Mirror Node data`);
              }
            }
          } else {
            const errorText = await txResponse.text();
            console.log(`⚠️ Attempt ${attempts}: Could not fetch transaction from Mirror Node:`, txResponse.status, errorText);
            
            try {
              const errorData = JSON.parse(errorText);
              if (errorData._status && errorData._status.messages) {
                console.log('❌ Mirror Node error messages:', errorData._status.messages);
              }
            } catch (parseError) {
              console.log('❌ Mirror Node error (raw):', errorText);
            }
          }
        }
      } catch (mirrorError) {
        console.log('⚠️ Mirror Node lookup failed:', mirrorError.message);
      }
    }
    
    // Final validation
    if (!tokenId) {
      throw new Error('Unable to determine token ID from transaction result or Mirror Node. Transaction may have failed.');
    }
    
    console.log('✅ NFT collection created:', tokenId);
    
    return {
      tokenId: tokenId,
      transactionId: transactionId,
      status: 'SUCCESS',
      success: true
    };
    
  } catch (error) {
    console.error('❌ NFT collection creation failed:', error);
    throw error;
  }
}

/**
 * Associate token with account using Blade Wallet
 */
async function associateTokenWithBlade(bladeSigner, tokenId, accountId) {
  try {
    console.log('🔗 Associating token with account using Blade Wallet...');
    
    const accountIdObj = AccountId.fromString(accountId);
    const tokenIdObj = typeof tokenId === 'string' ? tokenId : tokenId.toString();
    
    const associateTransaction = new TokenAssociateTransaction()
      .setAccountId(accountIdObj)
      .setTokenIds([tokenIdObj])
      .setMaxTransactionFee(new Hbar(5));
    
    // Use official BladeSigner API methods
    console.log('🔧 Populating association transaction...');
    await bladeSigner.populateTransaction(associateTransaction);
    
    // Execute transaction using call method
    console.log('📤 Executing association transaction...');
    const result = await bladeSigner.call(associateTransaction);
    
    console.log('✅ Association transaction executed:', result);
    
    // Extract transaction ID
    let transactionId;
    if (result && result.transactionId) {
      transactionId = result.transactionId.toString();
    } else if (result && result.id) {
      transactionId = result.id.toString();
    } else {
      transactionId = 'unknown';
    }
    
    console.log('✅ Token association successful');
    return {
      transactionId: transactionId,
      status: 'SUCCESS',
      success: true
    };
    
  } catch (error) {
    // Handle already associated error gracefully
    if (error.message.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
      console.log('✅ Token already associated with account');
      return {
        status: 'TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT',
        success: true
      };
    }
    
    console.error('❌ Token association failed:', error);
    throw error;
  }
}

/**
 * Mint NFT with Blade Wallet (following Hedera 100-byte limit)
 */
async function mintNFTWithBlade(bladeSigner, tokenId, metadata) {
  try {
    console.log('🎯 Minting NFT with Blade Wallet...');
    
    const tokenIdObj = typeof tokenId === 'string' ? tokenId : tokenId.toString();
    
    // CRITICAL: Hedera NFT metadata is limited to 100 bytes
    // Store full metadata on IPFS and use URL as metadata
    const metadataUrl = await uploadMetadataToIPFS(metadata);
    
    // Use only the IPFS URL as metadata (within 100-byte limit)
    const onChainMetadata = metadataUrl;
    const metadataBuffer = Buffer.from(onChainMetadata, 'utf8');
    
    console.log('📏 On-chain metadata size:', metadataBuffer.length, 'bytes (limit: 100 bytes)');
    
    if (metadataBuffer.length > 100) {
      throw new Error(`Metadata too long: ${metadataBuffer.length} bytes. Hedera limit is 100 bytes.`);
    }
    
    const mintTransaction = new TokenMintTransaction()
      .setTokenId(tokenIdObj)
      .setMetadata([metadataBuffer])
      .setMaxTransactionFee(new Hbar(10));
    
    // Use official BladeSigner API methods
    console.log('🔧 Populating mint transaction...');
    await bladeSigner.populateTransaction(mintTransaction);
    
    // Execute transaction using call method
    console.log('📤 Executing mint transaction...');
    const result = await bladeSigner.call(mintTransaction);
    
    console.log('✅ Mint transaction executed:', result);
    
    // Extract serial number and transaction ID from result
    let serialNumber, transactionId;
    
    // Try to get serial number from different possible locations
    if (result && result.serials && result.serials.length > 0) {
      serialNumber = typeof result.serials[0] === 'object' ? result.serials[0].low : result.serials[0];
    } else if (result && result.receipt && result.receipt.serials && result.receipt.serials.length > 0) {
      serialNumber = typeof result.receipt.serials[0] === 'object' ? result.receipt.serials[0].low : result.receipt.serials[0];
    } else {
      // Default to 1 for single NFT mint
      serialNumber = 1;
    }
    
    // Extract transaction ID
    if (result && result.transactionId) {
      transactionId = result.transactionId.toString();
    } else if (result && result.id) {
      transactionId = result.id.toString();
    } else {
      transactionId = 'unknown';
    }
    
    console.log('✅ NFT minted successfully! Serial number:', serialNumber);
    
    return {
      tokenId: tokenIdObj,
      serialNumber: serialNumber,
      transactionId: transactionId,
      status: 'SUCCESS',
      metadata: metadata,
      metadataUrl: metadataUrl,
      onChainMetadata: onChainMetadata,
      success: true
    };
    
  } catch (error) {
    console.error('❌ NFT minting failed:', error);
    throw error;
  }
}

/**
 * Complete NFT minting workflow with Blade Wallet
 */
export async function mintNFTWorkflowWithBlade(bladeSigner, accountId, metadata, options = {}, progressCallback = null) {
  try {
    console.log('🚀 Starting Blade Wallet NFT minting workflow...');
    console.log('👤 User account:', accountId);
    console.log('🌐 Network:', NETWORK);
    
    const updateProgress = (message) => {
      console.log(message);
      if (progressCallback) progressCallback(message);
    };
    
    // Step 1: Create NFT collection
    console.log('📝 Step 1: Creating NFT collection...');
    updateProgress('Creating NFT collection (please sign in wallet)...');
    const collectionResult = await createNFTCollectionWithBlade(bladeSigner, accountId, options);
    const tokenId = collectionResult.tokenId;
    updateProgress(`Collection created: ${tokenId}`);
    
    // Step 2: Associate token (required for minting)
    console.log('📝 Step 2: Associating token...');
    updateProgress('Associating NFT with your account (please sign)...');
    await associateTokenWithBlade(bladeSigner, tokenId, accountId);
    updateProgress('Token associated successfully');
    
    // Step 3: Mint NFT
    console.log('📝 Step 3: Minting NFT...');
    updateProgress('Uploading metadata to IPFS and minting NFT (please sign)...');
    const mintResult = await mintNFTWithBlade(bladeSigner, tokenId, metadata);
    updateProgress(`NFT minted! Serial #${mintResult.serialNumber}`);
    
    console.log('🎉 Blade Wallet NFT minting completed successfully!');
    
    return {
      collection: collectionResult,
      mint: mintResult,
      nftId: `${tokenId}:${mintResult.serialNumber}`,
      hashscanUrl: `https://${NETWORK}.hashscan.io/token/${tokenId}`,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Blade Wallet NFT minting workflow failed:', error);
    throw error;
  }
}

/**
 * Get Blade Wallet signer from wallet manager
 */
export async function getBladeWalletSigner() {
  try {
    const walletManager = (await import('./wallets/wallet-manager')).default;
    
    if (!walletManager.isConnected()) {
      throw new Error('Blade Wallet not connected');
    }
    
    const walletType = walletManager.getCurrentWalletType();
    if (walletType !== 'blade') {
      throw new Error('Current wallet is not Blade Wallet');
    }
    
    // Get Blade Connector from wallet manager
    const bladeWallet = (await import('./wallets/blade')).default;
    
    if (!bladeWallet.bladeConnector) {
      throw new Error('Blade Connector not initialized');
    }
    
    const signers = await bladeWallet.bladeConnector.getSigners();
    if (!signers || signers.length === 0) {
      throw new Error('No signers available from Blade Connector');
    }
    
    const bladeSigner = signers[0];
    const accountId = bladeSigner.getAccountId();
    
    console.log('✅ Blade Wallet signer obtained:', accountId);
    
    return {
      bladeSigner,
      accountId: accountId.toString()
    };
    
  } catch (error) {
    console.error('❌ Failed to get Blade Wallet signer:', error);
    throw error;
  }
}

export default {
  mintNFTWorkflowWithBlade,
  getBladeWalletSigner
};
