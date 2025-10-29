/**
 * API Endpoint: Check for Existing DID
 * 
 * Checks if a Hedera account has a registered DID by querying the Mirror Node
 * Uses multiple strategies:
 * 1. Query transactions by account ID
 * 2. Search topic messages for DID operations
 * 3. Query by public key (if provided)
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    const { accountId, publicKey } = req.query;

    if (!accountId && !publicKey) {
      return res.status(400).json({ error: 'Account ID or Public Key is required' });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 DID CHECK STARTED');
    console.log('   Account ID:', accountId || 'not provided');
    console.log('   Public Key:', publicKey || 'not provided');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const mirrorUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    console.log('🌐 Network Configuration:');
    console.log('   Network:', network);
    console.log('   Mirror URL:', mirrorUrl);
    console.log('');

    let effectiveAccountId = accountId;

    // Strategy 1: If public key is provided, find account ID first
    if (publicKey && !accountId) {
      console.log('🔑 STRATEGY 1: Public Key Lookup');
      console.log('   Searching for account associated with public key...');
      
      const pkQueryUrl = `${mirrorUrl}/api/v1/accounts?account.publickey=${publicKey}`;
      console.log('   Query URL:', pkQueryUrl);
      
      try {
        const pkResponse = await fetch(pkQueryUrl);
        console.log('   Response Status:', pkResponse.status, pkResponse.statusText);
        
        if (pkResponse.ok) {
          const pkData = await pkResponse.json();
          console.log('   Response Data:', JSON.stringify(pkData, null, 2));
          
          if (pkData.accounts && pkData.accounts.length > 0) {
            effectiveAccountId = pkData.accounts[0].account;
            console.log('   ✅ Found Account ID:', effectiveAccountId);
          } else {
            console.log('   ❌ No accounts found for this public key');
            return res.status(200).json({
              exists: false,
              did: null,
              message: 'No account found for the provided public key'
            });
          }
        } else {
          const errorText = await pkResponse.text();
          console.log('   ❌ Mirror Node Error:', errorText);
        }
      } catch (pkError) {
        console.error('   ❌ Public Key Query Failed:', pkError);
      }
      console.log('');
    }

    if (!effectiveAccountId) {
      console.log('❌ No account ID available for DID search');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return res.status(200).json({
        exists: false,
        did: null,
        message: 'Unable to determine account ID'
      });
    }

    // Strategy 2: Query transactions for topic creation
    console.log('📊 STRATEGY 2: Transaction Query');
    console.log('   Searching for CONSENSUSCREATETOPIC transactions...');
    
    const txQueryUrl = `${mirrorUrl}/api/v1/transactions?account.id=${effectiveAccountId}&transactiontype=CONSENSUSCREATETOPIC&limit=100&order=desc`;
    console.log('   Query URL:', txQueryUrl);
    
    const transactionsResponse = await fetch(txQueryUrl);
    console.log('   Response Status:', transactionsResponse.status, transactionsResponse.statusText);

    if (!transactionsResponse.ok) {
      const errorText = await transactionsResponse.text();
      console.error('   ❌ Transaction Query Failed:', errorText);
    } else {
      const transactionsData = await transactionsResponse.json();
      const txCount = transactionsData.transactions?.length || 0;
      console.log(`   ✅ Found ${txCount} topic creation transactions`);
      
      if (txCount > 0) {
        console.log('   📋 Examining transactions...');
        
        for (let i = 0; i < transactionsData.transactions.length; i++) {
          const tx = transactionsData.transactions[i];
          console.log(`   [${i + 1}/${txCount}] Transaction ID: ${tx.transaction_id}`);
          console.log(`        Entity ID: ${tx.entity_id || 'none'}`);
          console.log(`        Memo (raw): ${tx.memo || 'none'}`);
          console.log(`        Memo Base64: ${tx.memo_base64 || 'none'}`);
          
          if (tx.entity_id) {
            let memo = '';
            
            // Decode memo
            if (tx.memo_base64) {
              try {
                memo = Buffer.from(tx.memo_base64, 'base64').toString('utf-8');
                console.log(`        Memo (decoded): "${memo}"`);
              } catch (decodeError) {
                console.warn('        ⚠️ Failed to decode memo:', decodeError.message);
              }
            } else if (tx.memo) {
              memo = tx.memo;
            }
            
            // Check if this is a DID topic
            const didMarker = `DID for ${effectiveAccountId}`;
            console.log(`        Looking for: "${didMarker}"`);
            console.log(`        Match: ${memo.includes(didMarker) ? 'YES ✅' : 'NO ❌'}`);
            
            if (memo && memo.includes(didMarker)) {
              console.log('        🎯 DID TOPIC FOUND!');
              
              // Fetch topic details
              const topicQueryUrl = `${mirrorUrl}/api/v1/topics/${tx.entity_id}`;
              console.log('        Fetching topic details:', topicQueryUrl);
              
              const topicResponse = await fetch(topicQueryUrl);
              console.log('        Topic Response Status:', topicResponse.status);
              
              if (topicResponse.ok) {
                const topicData = await topicResponse.json();
                console.log('        Topic Data:', JSON.stringify(topicData, null, 2));
                
                // Fetch first message from topic
                const msgQueryUrl = `${mirrorUrl}/api/v1/topics/${tx.entity_id}/messages?limit=1&order=asc`;
                console.log('        Fetching topic messages:', msgQueryUrl);
                
                const messagesResponse = await fetch(msgQueryUrl);
                console.log('        Messages Response Status:', messagesResponse.status);
                
                if (messagesResponse.ok) {
                  const messagesData = await messagesResponse.json();
                  
                  if (messagesData.messages && messagesData.messages.length > 0) {
                    const message = messagesData.messages[0];
                    const messageContent = Buffer.from(message.message, 'base64').toString('utf-8');
                    console.log('        First Message Content:', messageContent);
                    
                    try {
                      const didMessage = JSON.parse(messageContent);
                      console.log('        Parsed DID Message:', JSON.stringify(didMessage, null, 2));
                      
                      const did = `did:hedera:${network}:${tx.entity_id}`;
                      const duration = Date.now() - startTime;
                      
                      console.log('');
                      console.log('✅ SUCCESS! DID FOUND');
                      console.log('   DID:', did);
                      console.log('   Topic ID:', tx.entity_id);
                      console.log('   Controller:', didMessage.controller);
                      console.log('   Duration:', duration, 'ms');
                      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                      
                      return res.status(200).json({
                        exists: true,
                        did: {
                          did: did,
                          topicId: tx.entity_id,
                          accountId: effectiveAccountId,
                          controller: didMessage.controller || effectiveAccountId,
                          network: network,
                          createdAt: message.consensus_timestamp,
                          document: didMessage.didDocument || {}
                        }
                      });
                    } catch (parseError) {
                      console.warn('        ⚠️ Could not parse message:', parseError.message);
                    }
                  }
                }
                
                // Return basic info even without message
                const did = `did:hedera:${network}:${tx.entity_id}`;
                const duration = Date.now() - startTime;
                
                console.log('');
                console.log('✅ SUCCESS! DID FOUND (basic info)');
                console.log('   DID:', did);
                console.log('   Topic ID:', tx.entity_id);
                console.log('   Duration:', duration, 'ms');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                return res.status(200).json({
                  exists: true,
                  did: {
                    did: did,
                    topicId: tx.entity_id,
                    accountId: effectiveAccountId,
                    network: network
                  }
                });
              }
            }
          }
        }
        
        console.log('   ℹ️ No DID topics found in transactions');
      }
    }
    console.log('');

    // Strategy 3: Direct topic message search (last resort)
    console.log('🔎 STRATEGY 3: Direct Topic Search');
    console.log('   Searching recent topics for DID messages...');
    
    // This is expensive, only do for recent topics
    const recentTopicsUrl = `${mirrorUrl}/api/v1/topics?limit=20&order=desc`;
    console.log('   Query URL:', recentTopicsUrl);
    
    try {
      const topicsResponse = await fetch(recentTopicsUrl);
      console.log('   Response Status:', topicsResponse.status);
      
      if (topicsResponse.ok) {
        const topicsData = await topicsResponse.json();
        const topicsCount = topicsData.topics?.length || 0;
        console.log(`   Found ${topicsCount} recent topics to check`);
        
        for (let i = 0; i < Math.min(topicsCount, 10); i++) {
          const topic = topicsData.topics[i];
          console.log(`   [${i + 1}/${topicsCount}] Checking topic: ${topic.topic_id}`);
          
          try {
            const msgUrl = `${mirrorUrl}/api/v1/topics/${topic.topic_id}/messages?limit=1&order=asc`;
            const msgResponse = await fetch(msgUrl);
            
            if (msgResponse.ok) {
              const msgData = await msgResponse.json();
              
              if (msgData.messages && msgData.messages.length > 0) {
                const messageContent = Buffer.from(msgData.messages[0].message, 'base64').toString('utf-8');
                
                try {
                  const didMessage = JSON.parse(messageContent);
                  
                  if (didMessage.operation === 'create' && 
                      didMessage.controller === effectiveAccountId) {
                    console.log('        🎯 MATCHING DID FOUND!');
                    
                    const did = `did:hedera:${network}:${topic.topic_id}`;
                    const duration = Date.now() - startTime;
                    
                    console.log('');
                    console.log('✅ SUCCESS! DID FOUND (via topic search)');
                    console.log('   DID:', did);
                    console.log('   Topic ID:', topic.topic_id);
                    console.log('   Duration:', duration, 'ms');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    
                    return res.status(200).json({
                      exists: true,
                      did: {
                        did: did,
                        topicId: topic.topic_id,
                        accountId: effectiveAccountId,
                        controller: didMessage.controller,
                        network: network,
                        document: didMessage.didDocument || {}
                      }
                    });
                  }
                } catch (e) {
                  // Not a DID message, skip
                }
              }
            }
          } catch (topicError) {
            // Skip this topic
            continue;
          }
        }
      }
    } catch (searchError) {
      console.error('   ❌ Topic Search Failed:', searchError);
    }
    console.log('');

    const duration = Date.now() - startTime;
    console.log('❌ NO DID FOUND');
    console.log('   Account ID searched:', effectiveAccountId);
    console.log('   Strategies attempted: 3');
    console.log('   Duration:', duration, 'ms');
    console.log('   Recommendation: Create a new DID for this account');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return res.status(200).json({
      exists: false,
      did: null,
      message: 'No DID found for this account',
      accountId: effectiveAccountId
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ CRITICAL ERROR');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    console.error('   Duration:', duration, 'ms');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return res.status(500).json({
      error: error.message || 'Failed to check DID',
      exists: false
    });
  }
}
