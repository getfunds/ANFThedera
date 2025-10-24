/**
 * API endpoint to check HTS NFT approval status
 * Uses both direct contract calls and Mirror Node verification
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tokenAddress, tokenId, spenderAddress } = req.body;

    if (!tokenAddress || !tokenId || !spenderAddress) {
      return res.status(400).json({ 
        error: 'Missing required parameters: tokenAddress, tokenId, spenderAddress' 
      });
    }

    console.log('🔍 Checking HTS NFT approval status:', {
      tokenAddress,
      tokenId,
      spenderAddress
    });

    // Dynamic import for server-side only
    const { Client, ContractCallQuery, ContractFunctionParameters } = await import('@hashgraph/sdk');

    // Create Hedera client
    let client = Client.forTestnet();
    
    if (process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY) {
      client.setOperator(
        process.env.HEDERA_ACCOUNT_ID,
        process.env.HEDERA_PRIVATE_KEY
      );
    }

    // Convert addresses to EVM format
    const spenderEvm = convertToEvmAddress(spenderAddress);
    console.log('🔄 Spender EVM address:', spenderEvm);

    // Method 1: Check getApproved(tokenId) on the HTS token
    console.log('📋 Method 1: Checking getApproved...');
    
    let getApprovedResult = null;
    try {
      const approvalQuery = new ContractCallQuery()
        .setContractId(tokenAddress)
        .setGas(200000)
        .setFunction(
          'getApproved',
          new ContractFunctionParameters().addUint256(parseInt(tokenId))
        );

      const result = await approvalQuery.execute(client);
      const approvedAddress = result.getAddress(0);
      getApprovedResult = {
        approvedAddress,
        isApproved: approvedAddress?.toLowerCase() === spenderEvm?.toLowerCase()
      };
      
      console.log('📊 getApproved result:', getApprovedResult);
    } catch (error) {
      console.warn('⚠️ getApproved query failed:', error.message);
      getApprovedResult = { error: error.message };
    }

    // Method 2: Check via Mirror Node allowances
    console.log('📋 Method 2: Checking Mirror Node allowances...');
    
    let mirrorNodeResult = null;
    try {
      // First, get the owner of the NFT
      // Get the real NFT owner directly from Mirror Node (more reliable than EVM conversion)
      const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
      const baseUrl = network === 'mainnet'
        ? 'https://mainnet.mirrornode.hedera.com'
        : network === 'previewnet'
          ? 'https://previewnet.mirrornode.hedera.com'
          : 'https://testnet.mirrornode.hedera.com';

      // Get NFT data directly from Mirror Node
      const nftDataUrl = `${baseUrl}/api/v1/tokens/${tokenAddress}/nfts/${tokenId}`;
      console.log('🌐 Fetching NFT owner from Mirror Node:', nftDataUrl);
      
      const nftResponse = await fetch(nftDataUrl);
      if (!nftResponse.ok) {
        throw new Error(`Failed to fetch NFT data: ${nftResponse.status}`);
      }
      
      const nftData = await nftResponse.json();
      const ownerAccountId = nftData.account_id;
      
      console.log('👤 NFT owner from Mirror Node:', { ownerAccountId });

      // Now check Mirror Node for allowances

      const allowancesUrl = `${baseUrl}/api/v1/accounts/${ownerAccountId}/allowances/nfts`;
      console.log('🌐 Fetching allowances from:', allowancesUrl);
      
      const allowancesResponse = await fetch(allowancesUrl);
      
      if (allowancesResponse.ok) {
        const allowancesData = await allowancesResponse.json();
        console.log('📊 Mirror Node allowances:', allowancesData);
        
        // Check if there's an allowance for our token and spender
        const relevantAllowances = allowancesData.allowances?.filter(allowance => 
          allowance.token_id === tokenAddress &&
          (allowance.spender === spenderAddress || allowance.spender === spenderEvm)
        );
        
        console.log('🔍 Relevant allowances found:', relevantAllowances);
        
        // Check for specific token approval or approved_for_all
        const hasSpecificAllowance = relevantAllowances?.some(allowance => 
          allowance.serial_numbers?.includes(parseInt(tokenId))
        );
        
        const hasApprovedForAll = relevantAllowances?.some(allowance => 
          allowance.approved_for_all === true
        );
        
        const hasAllowance = hasSpecificAllowance || hasApprovedForAll;
        
        console.log('🔍 Allowance analysis:', {
          hasSpecificAllowance,
          hasApprovedForAll,
          hasAllowance,
          totalRelevantAllowances: relevantAllowances?.length || 0
        });
        
        mirrorNodeResult = {
          hasAllowance,
          hasSpecificAllowance,
          hasApprovedForAll,
          allowanceDetails: relevantAllowances,
          totalAllowances: allowancesData.allowances?.length || 0,
          realOwner: ownerAccountId
        };
      } else {
        mirrorNodeResult = { 
          error: `Mirror Node API error: ${allowancesResponse.status}`,
          hasAllowance: false,
          realOwner: ownerAccountId
        };
      }
      
      console.log('📊 Mirror Node result:', mirrorNodeResult);
    } catch (error) {
      console.warn('⚠️ Mirror Node check failed:', error.message);
      mirrorNodeResult = { error: error.message, hasAllowance: false };
    }

    // Method 3: Check isApprovedForAll
    console.log('📋 Method 3: Checking isApprovedForAll...');
    
    let approvedForAllResult = null;
    try {
      // Get owner EVM address from the real owner account ID
      let ownerEvm;
      if (mirrorNodeResult && mirrorNodeResult.realOwner) {
        // Use the real owner we found from Mirror Node
        ownerEvm = convertToEvmAddress(mirrorNodeResult.realOwner);
      } else {
        // Fallback to contract call
        const ownerQuery = new ContractCallQuery()
          .setContractId(tokenAddress)
          .setGas(200000)
          .setFunction(
            'ownerOf',
            new ContractFunctionParameters().addUint256(parseInt(tokenId))
          );

        const ownerResult = await ownerQuery.execute(client);
        ownerEvm = ownerResult.getAddress(0);
      }
      
      console.log('👤 Owner for isApprovedForAll check:', {
        ownerEvm,
        spenderEvm
      });

      const approvedForAllQuery = new ContractCallQuery()
        .setContractId(tokenAddress)
        .setGas(200000)
        .setFunction(
          'isApprovedForAll',
          new ContractFunctionParameters()
            .addAddress(ownerEvm)
            .addAddress(spenderEvm)
        );

      const approvedForAllQueryResult = await approvedForAllQuery.execute(client);
      const isApprovedForAll = approvedForAllQueryResult.getBool(0);
      
      approvedForAllResult = {
        isApprovedForAll,
        ownerAddress: ownerEvm,
        spenderAddress: spenderEvm
      };
      
      console.log('📊 isApprovedForAll result:', approvedForAllResult);
      
    } catch (error) {
      console.warn('⚠️ isApprovedForAll query failed:', error.message);
      approvedForAllResult = { error: error.message };
    }

    // Determine overall approval status
    const isApproved = 
      getApprovedResult?.isApproved || 
      mirrorNodeResult?.hasAllowance || 
      approvedForAllResult?.isApprovedForAll ||
      false;

    const response = {
      isApproved,
      methods: {
        getApproved: getApprovedResult,
        mirrorNode: mirrorNodeResult,
        isApprovedForAll: approvedForAllResult
      },
      tokenAddress,
      tokenId: parseInt(tokenId),
      spenderAddress,
      spenderEvm,
      status: isApproved ? 'APPROVED' : 'NOT_APPROVED'
    };

    console.log('✅ HTS approval check completed:', {
      isApproved,
      status: response.status
    });

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error checking HTS NFT approval:', error);
    
    return res.status(500).json({
      error: 'Failed to check HTS NFT approval',
      details: error.message,
      isApproved: false
    });
  }
}

// Helper functions
function convertToEvmAddress(accountId) {
  if (!accountId) return '0x0000000000000000000000000000000000000000';
  
  const accountStr = String(accountId);
  
  if (accountStr.startsWith('0x') && accountStr.length === 42) {
    return accountStr;
  }
  
  if (accountStr.match(/^\d+\.\d+\.\d+$/)) {
    const parts = accountStr.split('.');
    const accountNum = parseInt(parts[2]);
    const evmAddress = '0x' + accountNum.toString(16).padStart(40, '0');
    return evmAddress;
  }
  
  return '0x0000000000000000000000000000000000000000';
}

function convertEvmToAccountId(evmAddress) {
  if (!evmAddress || evmAddress === '0x0000000000000000000000000000000000000000') {
    return null;
  }
  
  try {
    // Remove 0x prefix and convert to number
    const hex = evmAddress.startsWith('0x') ? evmAddress.slice(2) : evmAddress;
    
    // Use BigInt to avoid scientific notation for large numbers
    const accountNum = BigInt('0x' + hex);
    
    // Convert BigInt to string without scientific notation
    return `0.0.${accountNum.toString()}`;
  } catch (error) {
    console.warn('Failed to convert EVM address to account ID:', evmAddress);
    return null;
  }
}
