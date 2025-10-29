/**
 * Hedera DID - Client-Side with Blade Wallet Signing
 * 
 * Uses Blade wallet signer to sign all DID-related transactions
 */

import {
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  FileCreateTransaction,
  FileAppendTransaction,
  Hbar,
  TopicId,
  FileId
} from '@hashgraph/sdk';

/**
 * Check if an account has an existing DID
 * @param {string} accountId - Hedera account ID
 * @returns {Promise<Object|null>} DID info or null
 */
export async function checkExistingDID(accountId) {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 CLIENT: DID Check Started');
    console.log('   Account ID:', accountId);
    console.log('   Timestamp:', new Date().toISOString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Try to get public key from wallet for more reliable lookup
    let publicKey = null;
    try {
      console.log('🔑 Attempting to retrieve public key from wallet...');
      const walletManager = (await import('./wallets/wallet-manager')).default;
      
      if (walletManager.isConnected()) {
        const walletType = walletManager.getCurrentWalletType();
        console.log('   Connected Wallet:', walletType);
        
        if (walletType === 'blade') {
          const bladeWallet = (await import('./wallets/blade')).default;
          if (bladeWallet.bladeConnector) {
            const signers = await bladeWallet.bladeConnector.getSigners();
            if (signers && signers.length > 0) {
              const signer = signers[0];
              // Try to get public key from signer
              if (signer.getAccountKey) {
                const key = await signer.getAccountKey();
                publicKey = key.toString();
                console.log('   ✅ Public Key Retrieved:', publicKey.substring(0, 20) + '...');
              } else if (signer.publicKey) {
                publicKey = signer.publicKey.toString();
                console.log('   ✅ Public Key Retrieved:', publicKey.substring(0, 20) + '...');
              }
            }
          }
        }
      }
    } catch (pkError) {
      console.warn('   ⚠️ Could not retrieve public key:', pkError.message);
    }
    console.log('');
    
    // Query the Hedera network (source of truth)
    console.log('📡 Querying Hedera Mirror Node API...');
    
    // Build query URL with public key if available
    let queryUrl = `/api/did/check?accountId=${accountId}`;
    if (publicKey) {
      queryUrl += `&publicKey=${encodeURIComponent(publicKey)}`;
      console.log('   Using public key for enhanced lookup');
    }
    console.log('   API Endpoint:', queryUrl);
    
    const response = await fetch(queryUrl);
    console.log('   Response Status:', response.status, response.statusText);
    
    if (!response.ok) {
      console.error('   ❌ API request failed');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Try localStorage as fallback
      const stored = localStorage.getItem(`did_${accountId}`);
      if (stored) {
        try {
          const cachedDID = JSON.parse(stored);
          console.warn('⚠️ Using cached DID (network unavailable)');
          return cachedDID;
        } catch (e) {
          localStorage.removeItem(`did_${accountId}`);
        }
      }
      
      return null;
    }
    
    const data = await response.json();
    console.log('   Response Data:');
    console.log('   ', JSON.stringify(data, null, 2).split('\n').join('\n    '));
    console.log('');
    
    // Network response is source of truth
    if (data.exists && data.did) {
      console.log('✅ DID EXISTS!');
      console.log('   DID:', data.did.did);
      console.log('   Topic ID:', data.did.topicId);
      console.log('   Controller:', data.did.controller);
      console.log('   Network:', data.did.network);
      
      // Cache for performance (not reliability)
      localStorage.setItem(`did_${accountId}`, JSON.stringify(data.did));
      console.log('   💾 Cached to localStorage');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return data.did;
    }
    
    console.log('❌ NO DID FOUND');
    console.log('   Account has no registered DID');
    console.log('   User will need to create a DID');
    
    // Clear any stale cache
    localStorage.removeItem(`did_${accountId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return null;
    
  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ CLIENT ERROR: DID Check Failed');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    
    // Try localStorage as last resort
    try {
      const stored = localStorage.getItem(`did_${accountId}`);
      if (stored) {
        const didInfo = JSON.parse(stored);
        console.warn('   ⚠️ Using cached DID (error fallback)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return didInfo;
      }
    } catch (fallbackError) {
      console.error('   ❌ Cache fallback failed');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return null;
  }
}

/**
 * Create and register a new DID using Blade wallet signer
 * @param {string} accountId - Hedera account ID
 * @param {Object} profile - User profile data
 * @returns {Promise<Object>} Created DID info
 */
export async function createAndRegisterDID(accountId, profile = {}) {
  try {
    console.log('🔐 Creating new DID for account:', accountId);
    
    // Verify wallet is connected through wallet manager
    const walletManager = (await import('./wallets/wallet-manager')).default;
    
    console.log('🔍 Wallet manager state:', {
      isConnected: walletManager.isConnected(),
      currentWalletType: walletManager.getCurrentWalletType(),
      connectionState: walletManager.getConnectionState()
    });
    
    if (!walletManager.isConnected()) {
      console.error('❌ Wallet manager reports wallet not connected');
      console.error('💡 Please ensure you are connected to a wallet before creating a DID');
      throw new Error('Wallet not connected. Please connect your wallet first.');
    }
    
    const walletType = walletManager.getCurrentWalletType();
    console.log('✅ Wallet connected:', walletType);
    
    if (walletType !== 'blade') {
      throw new Error('Please connect with Blade Wallet to create a DID. Current wallet: ' + walletType);
    }
    
    // Get Blade wallet directly instead of using getBladeWalletSigner
    console.log('🔄 Getting Blade wallet connector...');
    const bladeWallet = (await import('./wallets/blade')).default;
    
    console.log('🔍 Blade wallet state:', {
      isConnected: bladeWallet.isConnected(),
      isInitialized: bladeWallet.isInitialized,
      hasConnector: !!bladeWallet.bladeConnector
    });
    
    if (!bladeWallet.bladeConnector) {
      console.error('❌ Blade connector not initialized');
      throw new Error('Blade connector not initialized. Please reconnect your Blade Wallet.');
    }
    
    // Get signers from Blade connector
    console.log('🔄 Getting signers from Blade connector...');
    const signers = await bladeWallet.bladeConnector.getSigners();
    
    if (!signers || signers.length === 0) {
      console.error('❌ No signers available');
      throw new Error('No signers available from Blade Wallet. Please reconnect your wallet.');
    }
    
    const bladeSigner = signers[0];
    const bladeAccountId = bladeSigner.getAccountId().toString();
    
    console.log('✅ Blade signer obtained for account:', bladeAccountId);
    
    // Step 1: Generate key pair for DID
    console.log('🔑 Generating DID key pair...');
    const keyPair = await generateKeyPair();
    
    // Step 2: Create HCS topic via Blade wallet
    console.log('📋 Creating DID topic...');
    const topicId = await createTopicWithBlade(bladeSigner, bladeAccountId);
    
    // Step 3: Generate DID identifier
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const did = `did:hedera:${network}:${topicId}`;
    console.log('✅ DID generated:', did);
    
    // Step 4: Create DID Document
    const didDocument = {
      "@context": "https://www.w3.org/ns/did/v1",
      "id": did,
      "controller": bladeAccountId,
      "verificationMethod": [
        {
          "id": `${did}#key-1`,
          "type": "Ed25519VerificationKey2020",
          "controller": did,
          "publicKeyBase58": keyPair.publicKey
        }
      ],
      "authentication": [`${did}#key-1`],
      "assertionMethod": [`${did}#key-1`]
    };
    
    // Add profile if provided
    if (profile.name || profile.bio) {
      didDocument.service = [{
        id: `${did}#profile`,
        type: 'Profile',
        serviceEndpoint: {
          name: profile.name || '',
          bio: profile.bio || '',
          platform: 'ANFT',
          createdAt: new Date().toISOString()
        }
      }];
    }
    
    console.log('📝 DID Document created');
    
    // Step 5: Store DID Document in HFS via Blade wallet
    console.log('💾 Storing DID Document in HFS...');
    const fileId = await createFileWithBlade(bladeSigner, didDocument);
    
    // Step 6: Publish DID creation message to topic
    console.log('📤 Publishing DID creation message...');
    await publishDIDMessage(bladeSigner, topicId, {
      operation: 'create',
      did: did,
      controller: bladeAccountId,
      didDocumentFileId: fileId,
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ DID created successfully!');
    
    // Store DID info in localStorage
    const didInfo = {
      did: did,
      topicId: topicId,
      fileId: fileId,
      document: didDocument,
      network: network,
      controller: bladeAccountId,
      privateKey: keyPair.privateKey,
      createdAt: Date.now()
    };
    
    localStorage.setItem(`did_${accountId}`, JSON.stringify(didInfo));
    
    return didInfo;
    
  } catch (error) {
    console.error('❌ Error creating DID:', error);
    throw new Error(`Failed to create DID: ${error.message}`);
  }
}

/**
 * Generate ED25519 key pair for DID
 * Note: This is the DID's cryptographic identity key, NOT for signing Hedera transactions
 * The Blade wallet signs transactions, but the DID needs its own key pair for:
 * - Verification methods in the DID document
 * - Signing attestations and claims
 * - Proving ownership of the DID
 * @returns {Promise<Object>} Key pair with privateKey and publicKey (hex strings)
 */
async function generateKeyPair() {
  // Generate a secure random 32-byte ED25519 private key
  const privateKeyBytes = new Uint8Array(32);
  crypto.getRandomValues(privateKeyBytes);
  
  // Convert to hex string
  const privateKey = Array.from(privateKeyBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // For a proper implementation, we'd derive the public key from the private key
  // For now, we'll generate a separate random public key
  // TODO: Use proper ED25519 key derivation (would require a crypto library)
  const publicKeyBytes = new Uint8Array(32);
  crypto.getRandomValues(publicKeyBytes);
  
  const publicKey = Array.from(publicKeyBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  console.log('🔑 Generated ED25519 key pair for DID');
  console.log('📝 Note: This is the DID identity key, separate from Blade wallet keys');
  
  return { 
    privateKey, 
    publicKey,
    // Store key type for future reference
    type: 'ED25519',
    purpose: 'DID_IDENTITY'
  };
}

/**
 * Query Mirror Node with retry logic
 * @param {string} transactionId - Formatted transaction ID
 * @param {string} network - Network (testnet/mainnet)
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<Object>} Transaction data from Mirror Node
 */
async function queryMirrorNodeWithRetry(transactionId, network, maxRetries = 10) {
  const mirrorUrl = network === 'mainnet' 
    ? 'https://mainnet-public.mirrornode.hedera.com'
    : 'https://testnet.mirrornode.hedera.com';
  
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Exponential backoff: 2s, 4s, 6s, 8s, 10s, 12s...
      const waitTime = attempt * 2000;
      
      if (attempt > 1) {
        console.log(`⏳ Retry ${attempt}/${maxRetries} - waiting ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.log(`⏳ Initial query - waiting 3s for transaction to be processed...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      console.log(`🔍 Querying Mirror Node (attempt ${attempt}/${maxRetries})...`);
      const txResponse = await fetch(`${mirrorUrl}/api/v1/transactions/${transactionId}`);
      
      if (!txResponse.ok) {
        const errorText = await txResponse.text();
        console.warn(`⚠️ Attempt ${attempt} failed:`, errorText);
        lastError = new Error(`Mirror Node query failed: ${txResponse.status}`);
        continue;
      }
      
      const txData = await txResponse.json();
      
      // Check if we got valid transaction data
      if (txData.transactions && txData.transactions.length > 0) {
        console.log(`✅ Transaction found on attempt ${attempt}`);
        return txData;
      }
      
      console.warn(`⚠️ Attempt ${attempt}: Transaction not yet available`);
      lastError = new Error('Transaction not yet available on Mirror Node');
      
    } catch (error) {
      console.warn(`⚠️ Attempt ${attempt} error:`, error.message);
      lastError = error;
    }
  }
  
  // All retries exhausted
  throw new Error(`Failed to query Mirror Node after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Create HCS topic using Blade wallet signer
 * @param {Object} bladeSigner - Blade wallet signer
 * @param {string} accountId - User's account ID
 * @returns {Promise<string>} Topic ID
 */
async function createTopicWithBlade(bladeSigner, accountId) {
  try {
    console.log('📋 Creating HCS topic for DID...');
    
    // Create topic transaction
    const topicTx = new TopicCreateTransaction()
      .setTopicMemo(`DID for ${accountId}`)
      .setMaxTransactionFee(new Hbar(2));
    
    // Populate transaction with Blade signer
    await bladeSigner.populateTransaction(topicTx);
    
    // Execute transaction
    const result = await bladeSigner.call(topicTx);
    
    console.log('✅ Transaction executed:', result);
    console.log('🔍 Transaction ID object:', result.transactionId);
    
    // Blade returns a TransactionId object, we need to format it for Mirror Node
    // Format: shard.realm.num-seconds-nanoseconds
    const txId = result.transactionId;
    const accountIdStr = `${txId.accountId.shard}.${txId.accountId.realm}.${txId.accountId.num}`;
    const seconds = txId.validStart.seconds.toString();
    const nanos = txId.validStart.nanos.toString().padStart(9, '0');
    const transactionId = `${accountIdStr}-${seconds}-${nanos}`;
    
    console.log('🔍 Formatted Transaction ID:', transactionId);
    
    // Query Mirror Node with retry logic
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const txData = await queryMirrorNodeWithRetry(transactionId, network);
    
    console.log('✅ Mirror Node response:', txData);
    
    // Extract topic ID from the transaction data
    if (txData.transactions && txData.transactions.length > 0) {
      const tx = txData.transactions[0];
      
      // Topic ID is in the entity_id field for TopicCreateTransaction
      if (tx.entity_id) {
        const topicId = tx.entity_id;
        console.log('✅ Topic created:', topicId);
        return topicId;
      }
    }
    
    throw new Error('Topic ID not found in Mirror Node response');
    
  } catch (error) {
    console.error('❌ Topic creation failed:', error);
    throw new Error(`Failed to create topic: ${error.message}`);
  }
}

/**
 * Create HFS file using Blade wallet signer
 * @param {Object} bladeSigner - Blade wallet signer
 * @param {Object} didDocument - DID Document to store
 * @returns {Promise<string>} File ID
 */
async function createFileWithBlade(bladeSigner, didDocument) {
  try {
    console.log('💾 Creating HFS file for DID Document...');
    
    const documentJson = JSON.stringify(didDocument, null, 2);
    const documentBytes = Buffer.from(documentJson, 'utf-8');
    
    // Create file transaction
    const fileTx = new FileCreateTransaction()
      .setContents(documentBytes)
      .setMaxTransactionFee(new Hbar(2));
    
    // Populate transaction with Blade signer
    await bladeSigner.populateTransaction(fileTx);
    
    // Execute transaction
    const result = await bladeSigner.call(fileTx);
    
    console.log('✅ Transaction executed:', result);
    console.log('🔍 Transaction ID object:', result.transactionId);
    
    // Format transaction ID for Mirror Node
    // Format: shard.realm.num-seconds-nanoseconds
    const txId = result.transactionId;
    const accountIdStr = `${txId.accountId.shard}.${txId.accountId.realm}.${txId.accountId.num}`;
    const seconds = txId.validStart.seconds.toString();
    const nanos = txId.validStart.nanos.toString().padStart(9, '0');
    const transactionId = `${accountIdStr}-${seconds}-${nanos}`;
    
    console.log('🔍 Formatted Transaction ID:', transactionId);
    
    // Query Mirror Node with retry logic
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const txData = await queryMirrorNodeWithRetry(transactionId, network);
    
    console.log('✅ Mirror Node response:', txData);
    
    // Extract file ID from the transaction data
    if (txData.transactions && txData.transactions.length > 0) {
      const tx = txData.transactions[0];
      
      // File ID is in the entity_id field for FileCreateTransaction
      if (tx.entity_id) {
        const fileId = tx.entity_id;
        console.log('✅ File created:', fileId);
        return fileId;
      }
    }
    
    throw new Error('File ID not found in Mirror Node response');
    
  } catch (error) {
    console.error('❌ File creation failed:', error);
    throw new Error(`Failed to create file: ${error.message}`);
  }
}

/**
 * Publish message to HCS topic using Blade wallet signer
 * @param {Object} bladeSigner - Blade wallet signer
 * @param {string} topicId - Topic ID
 * @param {Object} message - Message to publish
 * @returns {Promise<void>}
 */
async function publishDIDMessage(bladeSigner, topicId, message) {
  try {
    console.log('📤 Publishing message to HCS topic...');
    
    const messageJson = JSON.stringify(message);
    
    // Create message transaction
    const messageTx = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(messageJson)
      .setMaxTransactionFee(new Hbar(2));
    
    // Populate transaction with Blade signer
    await bladeSigner.populateTransaction(messageTx);
    
    // Execute transaction
    await bladeSigner.call(messageTx);
    
    console.log('✅ Message published');
    
  } catch (error) {
    console.error('❌ Message publishing failed:', error);
    throw new Error(`Failed to publish message: ${error.message}`);
  }
}

/**
 * Get or create DID for an account
 * @param {string} accountId - Hedera account ID
 * @param {Object} profile - User profile (if creating new)
 * @param {boolean} skipCheck - Skip checking for existing DID (optimization when we already checked)
 * @returns {Promise<Object>} DID info
 */
export async function getOrCreateDID(accountId, profile = {}, skipCheck = false) {
  try {
    console.log('🔐 Getting or creating DID for:', accountId);
    
    // Only check if not already checked
    if (!skipCheck) {
      const existingDID = await checkExistingDID(accountId);
      
      if (existingDID) {
        console.log('✅ Using existing DID');
        return existingDID;
      }
    } else {
      console.log('⏭️ Skipping redundant DID check (already verified no DID exists)');
    }
    
    console.log('📝 Creating new DID...');
    const newDID = await createAndRegisterDID(accountId, profile);
    
    return newDID;
    
  } catch (error) {
    console.error('❌ Error in getOrCreateDID:', error);
    throw error;
  }
}

/**
 * Resolve a DID to its document
 * @param {string} did - DID identifier
 * @returns {Promise<Object>} DID document
 */
export async function resolveDID(did) {
  try {
    console.log('🔍 Resolving DID:', did);
    
    const response = await fetch(`/api/did/resolve?did=${encodeURIComponent(did)}`);
    
    if (!response.ok) {
      throw new Error('Failed to resolve DID');
    }
    
    const data = await response.json();
    
    console.log('✅ DID resolved successfully');
    
    return data.document;
    
  } catch (error) {
    console.error('❌ Error resolving DID:', error);
    throw error;
  }
}

/**
 * Verify a DID exists and is valid
 * @param {string} did - DID identifier
 * @returns {Promise<boolean>} True if valid
 */
export async function verifyDID(did) {
  try {
    const document = await resolveDID(did);
    return !!document;
  } catch (error) {
    return false;
  }
}

/**
 * Record NFT creation in DID topic
 * @param {Object} didInfo - DID information with topicId
 * @param {Object} nftData - NFT creation data
 * @returns {Promise<string>} Transaction ID of the message
 */
export async function recordNFTCreation(didInfo, nftData) {
  try {
    console.log('📝 Recording NFT creation in DID topic...', {
      did: didInfo.did,
      topicId: didInfo.topicId,
      nftTokenId: nftData.tokenId
    });

    // Verify wallet is connected through wallet manager
    const walletManager = (await import('./wallets/wallet-manager')).default;
    
    if (!walletManager.isConnected()) {
      throw new Error('Wallet not connected. Please connect your wallet first.');
    }
    
    const walletType = walletManager.getCurrentWalletType();
    
    if (walletType !== 'blade') {
      throw new Error('Please connect with Blade Wallet to record NFT creation.');
    }
    
    // Get Blade wallet
    const bladeWallet = (await import('./wallets/blade')).default;
    
    if (!bladeWallet.bladeConnector) {
      throw new Error('Blade connector not initialized. Please reconnect your Blade Wallet.');
    }
    
    // Get signers from Blade connector
    const signers = await bladeWallet.bladeConnector.getSigners();
    
    if (!signers || signers.length === 0) {
      throw new Error('No signers available from Blade Wallet.');
    }
    
    const bladeSigner = signers[0];
    
    // Create NFT creation message
    const nftMessage = {
      operation: 'nft_created',
      did: didInfo.did,
      nftTokenId: nftData.tokenId,
      serialNumber: nftData.serialNumber,
      timestamp: new Date().toISOString(),
      name: nftData.name,
      metadata: {
        ipfsHash: nftData.ipfsHash || nftData.metadataCID,
        imageHash: nftData.imageHash,
        creator: nftData.creator || bladeSigner.getAccountId().toString(),
        creationType: nftData.creationType || 'unknown' // 'ai' or 'digital_painting'
      }
    };
    
    console.log('📤 Publishing NFT creation message:', nftMessage);
    
    // Publish message to DID topic
    await publishDIDMessage(bladeSigner, didInfo.topicId, nftMessage);
    
    console.log('✅ NFT creation recorded in DID topic');
    
    return nftMessage;
    
  } catch (error) {
    console.error('❌ Error recording NFT creation:', error);
    // Don't throw - this is supplementary data, shouldn't block NFT creation
    console.warn('⚠️ NFT was created successfully but recording in DID topic failed');
    return null;
  }
}

/**
 * Get all NFTs created by a DID
 * @param {string} did - DID identifier or topicId
 * @returns {Promise<Array>} Array of NFT creation records
 */
export async function getDIDCreatedNFTs(did) {
  try {
    console.log('🔍 Fetching NFTs created by DID:', did);
    
    // Extract topic ID from DID if needed
    let topicId;
    if (did.startsWith('did:hedera:')) {
      const parts = did.split(':');
      topicId = parts[3];
    } else {
      topicId = did;
    }
    
    // Query Mirror Node for topic messages
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const mirrorUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
    
    const response = await fetch(
      `${mirrorUrl}/api/v1/topics/${topicId}/messages?limit=100&order=asc`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch topic messages: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.messages || data.messages.length === 0) {
      console.log('ℹ️ No messages found in DID topic');
      return [];
    }
    
    // Filter and parse NFT creation messages
    const nftRecords = [];
    
    for (const message of data.messages) {
      try {
        // Decode message content
        const messageContent = Buffer.from(message.message, 'base64').toString('utf-8');
        const messageData = JSON.parse(messageContent);
        
        // Check if this is an NFT creation message
        if (messageData.operation === 'nft_created') {
          nftRecords.push({
            ...messageData,
            consensusTimestamp: message.consensus_timestamp,
            sequenceNumber: message.sequence_number
          });
        }
      } catch (parseError) {
        console.warn('⚠️ Could not parse message:', parseError);
        continue;
      }
    }
    
    console.log(`✅ Found ${nftRecords.length} NFT creation records`);
    return nftRecords;
    
  } catch (error) {
    console.error('❌ Error fetching DID created NFTs:', error);
    return [];
  }
}

/**
 * Format DID for display
 * @param {string} did - Full DID
 * @returns {string} Abbreviated DID
 */
export function formatDID(did) {
  if (!did) return '';
  
  const parts = did.split(':');
  if (parts.length < 4) return did;
  
  const identifier = parts[3];
  if (identifier.length <= 20) return did;
  
  return `${parts[0]}:${parts[1]}:${parts[2]}:${identifier.substring(0, 8)}...${identifier.substring(identifier.length - 8)}`;
}

export default {
  checkExistingDID,
  createAndRegisterDID,
  getOrCreateDID,
  resolveDID,
  verifyDID,
  formatDID,
  recordNFTCreation,
  getDIDCreatedNFTs
};
