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

    // Step 1: Query transactions for this account to find TopicCreateTransaction
    // This is more reliable than querying all topics
    console.log('🔍 Searching for TopicCreateTransaction from account...');
    
    const transactionsResponse = await fetch(
      `${mirrorUrl}/api/v1/transactions?account.id=${accountId}&transactiontype=CONSENSUSCREATETOPIC&limit=100&order=desc`
    );

    if (!transactionsResponse.ok) {
      console.warn('⚠️ Mirror Node query failed:', transactionsResponse.status);
      return res.status(200).json({
        exists: false,
        did: null,
        message: 'Unable to query Mirror Node'
      });
    }

    const transactionsData = await transactionsResponse.json();
    console.log(`📋 Found ${transactionsData.transactions?.length || 0} topic creation transactions`);

    // Find the DID topic by checking memo
    let didTopic = null;
    
    if (transactionsData.transactions && transactionsData.transactions.length > 0) {
      for (const tx of transactionsData.transactions) {
        console.log(`🔍 Checking transaction: ${tx.transaction_id}`);
        
        // Get the entity_id (topic ID) from the transaction
        if (tx.entity_id) {
          let memo = '';
          
          // Try to decode memo (some transactions have memo_base64, others have memo)
          if (tx.memo_base64) {
            try {
              memo = Buffer.from(tx.memo_base64, 'base64').toString('utf-8');
            } catch (decodeError) {
              console.warn('⚠️ Failed to decode memo_base64:', decodeError);
            }
          } else if (tx.memo) {
            memo = tx.memo;
          }
          
          console.log(`📝 Transaction memo: "${memo}"`);
          
          // Check if this is a DID topic
          if (memo && memo.includes(`DID for ${accountId}`)) {
            console.log('✅ Found DID topic in transaction:', tx.entity_id);
            
            // Fetch the topic details
            const topicResponse = await fetch(`${mirrorUrl}/api/v1/topics/${tx.entity_id}`);
            
            if (topicResponse.ok) {
              didTopic = await topicResponse.json();
              didTopic.topic_id = tx.entity_id; // Ensure topic_id is set
              didTopic.memo = memo; // Preserve the memo
              break;
            } else {
              console.warn(`⚠️ Failed to fetch topic details for ${tx.entity_id}`);
            }
          }
        }
      }
    }
    
    if (!didTopic) {
      console.log('ℹ️ No DID topic found in transactions for this account');
    }

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
