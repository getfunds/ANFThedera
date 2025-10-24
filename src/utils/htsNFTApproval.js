/**
 * HTS (Hedera Token Service) NFT Approval Implementation
 * Uses the correct Hedera system contract for HTS NFT approvals
 */

/**
 * Approve HTS NFT for marketplace using Hedera system contract
 * @param {string} tokenAddress - HTS token address (0.0.xxxxx)
 * @param {number} tokenId - NFT serial number
 * @param {string} spenderAddress - Address to approve (marketplace)
 * @param {object} bladeSigner - Blade wallet signer
 * @param {string} ownerAccountId - Owner's account ID
 */
export async function approveHTSNFT(tokenAddress, tokenId, spenderAddress, bladeSigner, ownerAccountId) {
  try {
    console.log('🔓 Approving HTS NFT using AccountAllowanceApproveTransaction...');
    console.log('📋 Parameters:', {
      tokenAddress,
      tokenId,
      spenderAddress,
      ownerAccountId
    });

    // Import Hedera SDK
    const { 
      AccountAllowanceApproveTransaction,
      AccountId,
      TokenId,
      Hbar 
    } = await import('@hashgraph/sdk');

    // Convert addresses to proper Hedera account/token IDs
    const tokenIdObj = TokenId.fromString(tokenAddress);
    const spenderAccountId = AccountId.fromString(spenderAddress);
    const ownerAccount = AccountId.fromString(ownerAccountId);
    
    console.log('🔄 Converted to Hedera IDs:', {
      tokenId: tokenIdObj.toString(),
      spenderAccountId: spenderAccountId.toString(),
      ownerAccount: ownerAccount.toString(),
      serialNumber: tokenId
    });

    // Method 1: Try AccountAllowanceApproveTransaction for specific serial
    console.log('🎯 Method 1: AccountAllowanceApproveTransaction for specific serial...');
    
    const allowanceTransaction = new AccountAllowanceApproveTransaction()
      .approveTokenNftAllowance(tokenIdObj, ownerAccount, spenderAccountId, [tokenId])
      .setMaxTransactionFee(new Hbar(15));

    console.log('📝 Executing AccountAllowanceApproveTransaction...');
    await bladeSigner.populateTransaction(allowanceTransaction);
    const result = await bladeSigner.call(allowanceTransaction);
    
    console.log('✅ HTS AccountAllowanceApproveTransaction successful!', result);
    
    return {
      success: true,
      method: 'AccountAllowanceApproveTransaction',
      transactionId: result.transactionId?.toString(),
      result: result
    };

  } catch (error) {
    console.error('❌ AccountAllowanceApproveTransaction failed, trying direct contract method...', error);
    
    // Method 2: Try direct contract call as fallback
    try {
      console.log('🎯 Method 2: Direct contract approve call...');
      
      const { 
        ContractExecuteTransaction, 
        ContractFunctionParameters, 
        Hbar 
      } = await import('@hashgraph/sdk');

      // Convert addresses to EVM format for contract call
      const spenderEvm = convertToEvmAddress(spenderAddress);
      
      console.log('🔄 Using EVM address for contract call:', spenderEvm);

      const directApprovalTx = new ContractExecuteTransaction()
        .setContractId(tokenAddress) // Call the HTS token directly
        .setGas(800000)
        .setFunction(
          'approve',
          new ContractFunctionParameters()
            .addAddress(spenderEvm)
            .addUint256(tokenId)
        )
        .setMaxTransactionFee(new Hbar(10));

      console.log('📝 Executing direct contract approval...');
      await bladeSigner.populateTransaction(directApprovalTx);
      const directResult = await bladeSigner.call(directApprovalTx);
      
      console.log('✅ Direct contract HTS NFT approval successful!', directResult);
      
      return {
        success: true,
        method: 'direct_contract',
        transactionId: directResult.transactionId?.toString(),
        result: directResult
      };

    } catch (directError) {
      console.error('❌ Both HTS approval methods failed:', {
        primaryError: error.message,
        directError: directError.message
      });
      throw new Error(`HTS approval failed. AccountAllowance: ${error.message}, Direct: ${directError.message}`);
    }
  }
}

/**
 * Set approval for all HTS NFTs using system contract
 * @param {string} tokenAddress - HTS token address
 * @param {string} operatorAddress - Operator address (marketplace)
 * @param {boolean} approved - True to approve, false to revoke
 * @param {object} bladeSigner - Blade wallet signer
 * @param {string} ownerAccountId - Owner's account ID
 */
export async function setApprovalForAllHTS(tokenAddress, operatorAddress, approved, bladeSigner, ownerAccountId) {
  try {
    console.log('🔓 Setting approval for all HTS NFTs using AccountAllowanceApproveTransaction...');
    console.log('📋 Parameters:', {
      tokenAddress,
      operatorAddress,
      approved,
      ownerAccountId
    });

    // Import Hedera SDK
    const { 
      AccountAllowanceApproveTransaction,
      AccountAllowanceDeleteTransaction,
      AccountId,
      TokenId,
      Hbar 
    } = await import('@hashgraph/sdk');

    // Convert addresses to proper Hedera account/token IDs
    const tokenId = TokenId.fromString(tokenAddress);
    const operatorAccountId = AccountId.fromString(operatorAddress);
    const ownerAccount = AccountId.fromString(ownerAccountId);
    
    console.log('🔄 Converted to Hedera IDs:', {
      tokenId: tokenId.toString(),
      operatorAccountId: operatorAccountId.toString(),
      ownerAccount: ownerAccount.toString()
    });

    let transaction;
    let operationName;

    if (approved) {
      // Approve all NFTs for the operator
      operationName = 'AccountAllowanceApproveTransaction';
      transaction = new AccountAllowanceApproveTransaction()
        .approveTokenNftAllowanceAllSerials(tokenId, ownerAccount, operatorAccountId)
        .setMaxTransactionFee(new Hbar(15));
    } else {
      // Revoke approval for all NFTs
      operationName = 'AccountAllowanceDeleteTransaction';
      transaction = new AccountAllowanceDeleteTransaction()
        .deleteAllTokenNftAllowances(tokenId, ownerAccount)
        .setMaxTransactionFee(new Hbar(15));
    }

    console.log(`📝 Executing ${operationName}...`);
    await bladeSigner.populateTransaction(transaction);
    const result = await bladeSigner.call(transaction);
    
    console.log(`✅ HTS ${operationName} successful!`, result);
    
    return {
      success: true,
      method: operationName,
      transactionId: result.transactionId?.toString(),
      result: result
    };

  } catch (error) {
    console.error('❌ HTS AccountAllowance transaction failed:', error);
    
    // Fallback to contract-based setApprovalForAll
    try {
      console.log('🎯 Fallback: Trying contract-based setApprovalForAll...');
      
      const { 
        ContractExecuteTransaction, 
        ContractFunctionParameters, 
        Hbar 
      } = await import('@hashgraph/sdk');

      // For contract calls, we need EVM addresses
      const operatorEvm = convertToEvmAddress(operatorAddress);
      
      console.log('🔄 Using EVM address for contract call:', operatorEvm);

      const approvalForAllTx = new ContractExecuteTransaction()
        .setContractId(tokenAddress) // Call the HTS token directly
        .setGas(800000)
        .setFunction(
          'setApprovalForAll',
          new ContractFunctionParameters()
            .addAddress(operatorEvm)
            .addBool(approved)
        )
        .setMaxTransactionFee(new Hbar(10));

      console.log('📝 Executing fallback setApprovalForAll transaction...');
      await bladeSigner.populateTransaction(approvalForAllTx);
      const fallbackResult = await bladeSigner.call(approvalForAllTx);
      
      console.log('✅ Fallback HTS setApprovalForAll successful!', fallbackResult);
      
      return {
        success: true,
        method: 'setApprovalForAll_fallback',
        transactionId: fallbackResult.transactionId?.toString(),
        result: fallbackResult
      };

    } catch (fallbackError) {
      console.error('❌ Both HTS allowance methods failed:', {
        primaryError: error.message,
        fallbackError: fallbackError.message
      });
      throw new Error(`HTS approval failed. Primary: ${error.message}, Fallback: ${fallbackError.message}`);
    }
  }
}

/**
 * Check HTS NFT approval status
 * @param {string} tokenAddress - HTS token address
 * @param {number} tokenId - NFT serial number
 * @param {string} spenderAddress - Spender address to check
 */
export async function checkHTSNFTApproval(tokenAddress, tokenId, spenderAddress) {
  try {
    console.log('🔍 Checking HTS NFT approval status...');
    
    const response = await fetch('/api/check-hts-nft-approval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenAddress,
        tokenId,
        spenderAddress
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('📊 HTS approval check result:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error checking HTS approval:', error);
    throw error;
  }
}

// Helper function to convert account ID to EVM address
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

export default {
  approveHTSNFT,
  setApprovalForAllHTS,
  checkHTSNFTApproval
};
