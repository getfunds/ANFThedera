/**
 * API Endpoint: Register New DID
 * 
 * Creates a new Hedera DID for a user's account
 * Uses operator account to create resources but associates with user
 */

import { 
  Client,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  FileCreateTransaction,
  FileAppendTransaction
} from '@hashgraph/sdk';

// Simple DID generation
function generateDIDIdentifier(network, topicId) {
  return `did:hedera:${network}:${topicId}`;
}

function createDIDDocument(did, accountId, publicKey) {
  return {
    "@context": "https://www.w3.org/ns/did/v1",
    "id": did,
    "controller": accountId,
    "verificationMethod": [
      {
        "id": `${did}#key-1`,
        "type": "Ed25519VerificationKey2020",
        "controller": did,
        "publicKeyBase58": publicKey
      }
    ],
    "authentication": [`${did}#key-1`],
    "assertionMethod": [`${did}#key-1`]
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountId, profile = {} } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    console.log('🔐 Creating DID for account:', accountId);

    // Initialize Hedera client with operator account
    const operatorId = process.env.HEDERA_ACCOUNT_ID;
    const operatorKey = process.env.HEDERA_PRIVATE_KEY;
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';

    if (!operatorId || !operatorKey) {
      return res.status(500).json({ error: 'Hedera credentials not configured' });
    }

    const client = network === 'mainnet'
      ? Client.forMainnet()
      : Client.forTestnet();

    client.setOperator(operatorId, operatorKey);

    // Generate key pair for DID verification
    const privateKey = PrivateKey.generateED25519();
    const publicKey = privateKey.publicKey;

    console.log('🔑 Generated verification key pair');

    // Create HCS topic for DID (owned by operator but represents user)
    const topicTx = new TopicCreateTransaction()
      .setTopicMemo(`DID for ${accountId}`);

    const topicResponse = await topicTx.execute(client);
    const topicReceipt = await topicResponse.getReceipt(client);
    const topicId = topicReceipt.topicId.toString();

    console.log('✅ DID topic created:', topicId);

    // Generate DID
    const did = generateDIDIdentifier(network, topicId);

    console.log('✅ DID generated:', did);

    // Create DID Document (controller is the user's account)
    const didDocument = createDIDDocument(did, accountId, publicKey.toStringDer());

    // Add profile to DID Document if provided
    if (profile.name || profile.bio) {
      didDocument.service = [{
        id: `${did}#profile`,
        type: 'Profile',
        serviceEndpoint: {
          name: profile.name || '',
          bio: profile.bio || '',
          platform: profile.platform || 'ANFT',
          createdAt: new Date().toISOString()
        }
      }];
    }

    console.log('📝 DID Document created');

    // Store DID Document in HFS
    const documentJson = JSON.stringify(didDocument, null, 2);
    const documentBytes = Buffer.from(documentJson, 'utf-8');

    let fileId;

    if (documentBytes.length <= 4096) {
      // Single transaction for small documents
      const fileTx = new FileCreateTransaction()
        .setContents(documentBytes);

      const fileResponse = await fileTx.execute(client);
      const fileReceipt = await fileResponse.getReceipt(client);
      fileId = fileReceipt.fileId.toString();
    } else {
      // Multiple transactions for larger documents
      const chunk1 = documentBytes.slice(0, 4096);
      const fileTx = new FileCreateTransaction()
        .setContents(chunk1);

      const fileResponse = await fileTx.execute(client);
      const fileReceipt = await fileResponse.getReceipt(client);
      fileId = fileReceipt.fileId.toString();

      // Append remaining chunks
      let offset = 4096;
      while (offset < documentBytes.length) {
        const chunk = documentBytes.slice(offset, offset + 4096);
        const appendTx = new FileAppendTransaction()
          .setFileId(fileId)
          .setContents(chunk);

        await appendTx.execute(client);
        offset += 4096;
      }
    }

    console.log('✅ DID Document stored in HFS:', fileId);

    // Publish DID creation message to topic
    const didMessage = {
      operation: 'create',
      did: did,
      controller: accountId,
      didDocumentFileId: fileId,
      timestamp: new Date().toISOString()
    };

    const messageTx = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(JSON.stringify(didMessage));

    const messageResponse = await messageTx.execute(client);
    await messageResponse.getReceipt(client);

    console.log('✅ DID creation message published');

    // Close client
    client.close();

    // Return DID info
    return res.status(200).json({
      success: true,
      did: did,
      topicId: topicId,
      fileId: fileId,
      document: didDocument,
      network: network,
      controller: accountId,
      privateKey: privateKey.toStringDer() // Return for client storage
    });

  } catch (error) {
    console.error('❌ DID registration error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to register DID',
      details: error.toString()
    });
  }
}
