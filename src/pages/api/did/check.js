/**
 * API Endpoint: Check for Existing DID
 * 
 * Checks if a Hedera account has a registered DID by querying the Mirror Node
 * Uses standardized memo "ANFT DID" for all DIDs
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountId } = req.query;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const mirrorUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    // Standard memo for all ANFT DIDs: "ANFT DID"
    // Base64: QU5GVCBESUQ=
    const ANFT_DID_MEMO_BASE64 = 'QU5GVCBESUQ=';

    // Query for CONSENSUSSUBMITMESSAGE transactions with ANFT DID memo
    const txQueryUrl = `${mirrorUrl}/api/v1/transactions?account.id=${accountId}&transactiontype=CONSENSUSSUBMITMESSAGE&limit=100&order=desc`;
    
    const transactionsResponse = await fetch(txQueryUrl);

    if (!transactionsResponse.ok) {
      return res.status(200).json({
        exists: false,
        did: null,
        message: 'Unable to query Mirror Node'
      });
    }

    const transactionsData = await transactionsResponse.json();
    const txCount = transactionsData.transactions?.length || 0;
    
    if (txCount > 0) {
      // Search for transaction with ANFT DID memo
      for (const tx of transactionsData.transactions) {
        // Check if memo matches ANFT DID standard
        if (tx.memo_base64 === ANFT_DID_MEMO_BASE64 && tx.entity_id) {
          // Found DID! entity_id is the topic ID
          const topicId = tx.entity_id;
          const did = `did:hedera:${network}:${topicId}`;
          
          // Fetch first message from topic to get DID details
          try {
            const msgQueryUrl = `${mirrorUrl}/api/v1/topics/${topicId}/messages?limit=1&order=asc`;
            const messagesResponse = await fetch(msgQueryUrl);
            
            if (messagesResponse.ok) {
              const messagesData = await messagesResponse.json();
              
              if (messagesData.messages && messagesData.messages.length > 0) {
                const message = messagesData.messages[0];
                const messageContent = Buffer.from(message.message, 'base64').toString('utf-8');
                
                try {
                  const didMessage = JSON.parse(messageContent);
                  
                  return res.status(200).json({
                    exists: true,
                    did: {
                      did: did,
                      topicId: topicId,
                      accountId: accountId,
                      controller: didMessage.controller || accountId,
                      network: network,
                      createdAt: message.consensus_timestamp,
                      document: didMessage.didDocument || {}
                    }
                  });
                } catch (parseError) {
                  // Message exists but couldn't parse, return basic info
                }
              }
            }
          } catch (msgError) {
            // Couldn't fetch message, return basic info
          }
          
          // Return basic DID info even if message fetch failed
          return res.status(200).json({
            exists: true,
            did: {
              did: did,
              topicId: topicId,
              accountId: accountId,
              network: network
            }
          });
        }
      }
    }

    // No DID found
    return res.status(200).json({
      exists: false,
      did: null,
      message: 'No DID found for this account'
    });

  } catch (error) {
    console.error('❌ DID check error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to check DID',
      exists: false
    });
  }
}
