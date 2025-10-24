/**
 * API Endpoint: Check for Existing DID
 * 
 * Checks if a Hedera account has a registered DID by querying the Mirror Node
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

    console.log('🔍 Checking DID for account:', accountId);

    // Query Hedera Mirror Node for topics created by this account
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const mirrorUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    console.log('🌐 Querying Mirror Node:', mirrorUrl);

    // Query for topics where this account is the submit key holder
    // DID topics have a specific memo pattern: "DID for {accountId}"
    const topicsResponse = await fetch(
      `${mirrorUrl}/api/v1/topics?limit=100&order=desc`
    );

    if (!topicsResponse.ok) {
      console.warn('⚠️ Mirror Node query failed:', topicsResponse.status);
      return res.status(200).json({
        exists: false,
        did: null,
        message: 'Unable to query Mirror Node'
      });
    }

    const topicsData = await topicsResponse.json();
    console.log('📋 Found topics, checking for DID...');

    // Filter topics by memo pattern
    const didTopic = topicsData.topics?.find(topic => {
      return topic.memo && topic.memo.includes(`DID for ${accountId}`);
    });

    if (didTopic) {
      const topicId = didTopic.topic_id;
      const did = `did:hedera:${network}:${topicId}`;
      
      console.log('✅ Found existing DID:', did);

      // Try to get the latest DID message to retrieve more info
      try {
        const messagesResponse = await fetch(
          `${mirrorUrl}/api/v1/topics/${topicId}/messages?limit=1&order=asc`
        );

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          
          if (messagesData.messages && messagesData.messages.length > 0) {
            const message = messagesData.messages[0];
            
            // Decode the message (base64)
            const messageContent = Buffer.from(message.message, 'base64').toString('utf-8');
            
            try {
              const didMessage = JSON.parse(messageContent);
              
              // Return full DID info
              return res.status(200).json({
                exists: true,
                did: {
                  did: did,
                  topicId: topicId,
                  fileId: didMessage.didDocumentFileId || null,
                  controller: didMessage.controller || accountId,
                  network: network,
                  createdAt: message.consensus_timestamp
                }
              });
            } catch (parseError) {
              console.warn('⚠️ Could not parse DID message:', parseError);
            }
          }
        }
      } catch (messageError) {
        console.warn('⚠️ Could not fetch DID messages:', messageError);
      }

      // Return basic DID info even if message retrieval failed
      return res.status(200).json({
        exists: true,
        did: {
          did: did,
          topicId: topicId,
          controller: accountId,
          network: network
        }
      });
    }

    console.log('ℹ️ No DID found for this account');
    
    return res.status(200).json({
      exists: false,
      did: null,
      message: 'No DID found for this account'
    });

  } catch (error) {
    console.error('❌ DID check error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to check DID'
    });
  }
}
