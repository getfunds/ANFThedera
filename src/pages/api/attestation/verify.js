/**
 * API Endpoint: Verify Attestation from HCS
 * 
 * Retrieves and verifies attestation from Hedera Consensus Service
 * Uses HCS Mirror Node API to query messages
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { topicId, sequenceNumber } = req.query;
    
    // Validate inputs
    if (!topicId || !sequenceNumber) {
      return res.status(400).json({ 
        error: 'Missing required parameters: topicId, sequenceNumber' 
      });
    }
    
    console.log('🔍 Verifying attestation...');
    console.log('📋 Topic ID:', topicId);
    console.log('🔢 Sequence Number:', sequenceNumber);
    
    // Get network
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    
    // Mirror node API URL
    const mirrorNodeUrl = network === 'mainnet'
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
    
    // Query topic messages
    const apiUrl = `${mirrorNodeUrl}/api/v1/topics/${topicId}/messages/${sequenceNumber}`;
    
    console.log('🌐 Querying mirror node:', apiUrl);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ 
          error: 'Attestation not found',
          topicId,
          sequenceNumber
        });
      }
      
      throw new Error(`Mirror node query failed: ${response.statusText}`);
    }
    
    const mirrorData = await response.json();
    
    // Decode message
    const messageBase64 = mirrorData.message;
    const messageJson = Buffer.from(messageBase64, 'base64').toString('utf-8');
    const attestation = JSON.parse(messageJson);
    
    console.log('✅ Attestation retrieved and decoded');
    console.log('👤 Creator DID:', attestation.payload?.creatorDID);
    console.log('🔐 Content Hash:', attestation.payload?.contentHash?.substring(0, 16) + '...');
    
    // Verify hash integrity
    const crypto = await import('crypto');
    const canonical = JSON.stringify(
      attestation.payload, 
      Object.keys(attestation.payload).sort(), 
      0
    );
    const computedHash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
    
    const hashValid = computedHash === attestation.payloadHash;
    
    if (!hashValid) {
      console.warn('⚠️ Hash mismatch detected!');
      console.warn('   Expected:', attestation.payloadHash);
      console.warn('   Computed:', computedHash);
    } else {
      console.log('✅ Hash integrity verified');
    }
    
    // Build response
    const result = {
      success: true,
      verified: hashValid,
      
      // Attestation data
      attestation: attestation,
      
      // HCS metadata
      topicId: topicId,
      sequenceNumber: sequenceNumber,
      consensusTimestamp: mirrorData.consensus_timestamp,
      
      // Verification
      hashValid: hashValid,
      computedHash: computedHash,
      
      // Explorer link
      explorerUrl: `https://hashscan.io/${network}/topic/${topicId}/message/${sequenceNumber}`,
      
      // Network
      network: network
    };
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('❌ Attestation verification error:', error);
    
    return res.status(500).json({
      error: error.message || 'Failed to verify attestation',
      details: error.toString()
    });
  }
}

