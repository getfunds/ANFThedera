/**
 * Comprehensive system check for NFT minting functionality
 * Validates all components are working correctly
 */

export async function performSystemCheck() {
  console.log('🔍 Starting comprehensive system check...');
  
  const results = {
    timestamp: new Date().toISOString(),
    imports: {},
    walletManager: {},
    bladeWallet: {},
    hederaSDK: {},
    nftMinting: {},
    recommendations: []
  };

  // 1. Check imports
  try {
    console.log('📦 Checking imports...');
    
    // Check Hedera SDK
    const hederaSDK = await import('@hashgraph/sdk');
    results.imports.hederaSDK = {
      available: true,
      hasTokenCreateTransaction: typeof hederaSDK.TokenCreateTransaction !== 'undefined',
      hasTokenMintTransaction: typeof hederaSDK.TokenMintTransaction !== 'undefined',
      hasTokenAssociateTransaction: typeof hederaSDK.TokenAssociateTransaction !== 'undefined'
    };
    
    // Check Blade SDK
    try {
      const bladeSDK = await import('@bladelabs/blade-web3.js');
      results.imports.bladeSDK = {
        available: true,
        hasBladeConnector: typeof bladeSDK.BladeConnector !== 'undefined',
        hasConnectorStrategy: typeof bladeSDK.ConnectorStrategy !== 'undefined'
      };
    } catch (bladeImportError) {
      results.imports.bladeSDK = {
        available: false,
        error: bladeImportError.message
      };
    }
    
    // Check our modules
    const walletManager = await import('./wallets/wallet-manager');
    const bladeMinting = await import('./bladeWalletNFTMinting');
    
    results.imports.ourModules = {
      walletManager: typeof walletManager.default !== 'undefined',
      bladeMinting: typeof bladeMinting.mintNFTWorkflowWithBlade === 'function'
    };
    
  } catch (importError) {
    results.imports.error = importError.message;
  }

  // 2. Check wallet manager
  try {
    console.log('🔗 Checking wallet manager...');
    const walletManager = (await import('./wallets/wallet-manager')).default;
    
    results.walletManager = {
      available: typeof walletManager !== 'undefined',
      hasIsConnected: typeof walletManager.isConnected === 'function',
      hasGetCurrentWalletType: typeof walletManager.getCurrentWalletType === 'function',
      hasSendTransaction: typeof walletManager.sendTransaction === 'function',
      currentConnection: walletManager.isConnected ? walletManager.isConnected() : false,
      currentWalletType: walletManager.getCurrentWalletType ? walletManager.getCurrentWalletType() : 'unknown'
    };
    
  } catch (walletManagerError) {
    results.walletManager.error = walletManagerError.message;
  }

  // 3. Check Blade Wallet specifically
  try {
    console.log('⚔️ Checking Blade Wallet...');
    const bladeWallet = (await import('./wallets/blade')).default;
    
    results.bladeWallet = {
      available: typeof bladeWallet !== 'undefined',
      hasIsAvailable: typeof bladeWallet.isAvailable === 'function',
      hasConnect: typeof bladeWallet.connect === 'function',
      hasSendTransaction: typeof bladeWallet.sendTransaction === 'function',
      isAvailable: bladeWallet.isAvailable ? bladeWallet.isAvailable() : false,
      isConnected: bladeWallet.isConnected ? bladeWallet.isConnected() : false
    };
    
    // Check window.blade
    if (typeof window !== 'undefined') {
      results.bladeWallet.windowBlade = {
        exists: typeof window.blade !== 'undefined',
        methods: window.blade ? Object.keys(window.blade).filter(key => typeof window.blade[key] === 'function') : []
      };
    }
    
  } catch (bladeWalletError) {
    results.bladeWallet.error = bladeWalletError.message;
  }

  // 4. Check Hedera SDK functionality
  try {
    console.log('🌐 Checking Hedera SDK functionality...');
    const { 
      TokenCreateTransaction, 
      TokenType, 
      TokenSupplyType, 
      AccountId, 
      Hbar, 
      TransactionId 
    } = await import('@hashgraph/sdk');
    
    // Test creating a transaction (without executing)
    const testAccountId = AccountId.fromString('0.0.123456');
    const testTransaction = new TokenCreateTransaction()
      .setTokenName('Test NFT Collection')
      .setTokenSymbol('TEST')
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(100)
      .setTreasuryAccountId(testAccountId)
      .setMaxTransactionFee(new Hbar(20));
    
    const transactionId = TransactionId.generate(testAccountId);
    testTransaction.setTransactionId(transactionId);
    
    const nodeAccountIds = [new AccountId(3), new AccountId(4), new AccountId(5)];
    testTransaction.setNodeAccountIds(nodeAccountIds);
    
    // Test freezing
    const frozenTransaction = testTransaction.freeze();
    const transactionBytes = frozenTransaction.toBytes();
    
    results.hederaSDK = {
      canCreateTransaction: true,
      canSetTransactionId: true,
      canSetNodeAccountIds: true,
      canFreeze: true,
      canConvertToBytes: true,
      transactionSize: transactionBytes.length
    };
    
  } catch (hederaSDKError) {
    results.hederaSDK.error = hederaSDKError.message;
  }

  // 5. Check NFT minting module
  try {
    console.log('🎨 Checking NFT minting module...');
    const { mintNFTWorkflowWithBlade } = await import('./bladeWalletNFTMinting');
    
    results.nftMinting = {
      hasWorkflowFunction: typeof mintNFTWorkflowWithBlade === 'function',
      functionName: mintNFTWorkflowWithBlade.name,
      module: 'bladeWalletNFTMinting'
    };
    
  } catch (nftMintingError) {
    results.nftMinting.error = nftMintingError.message;
  }

  // 6. Generate recommendations
  if (!results.imports.hederaSDK?.available) {
    results.recommendations.push('❌ Install Hedera SDK: npm install @hashgraph/sdk');
  }
  
  if (!results.imports.bladeSDK?.available) {
    results.recommendations.push('❌ Install Blade SDK: npm install @bladelabs/blade-web3.js');
  }
  
  if (!results.walletManager.currentConnection) {
    results.recommendations.push('⚠️ No wallet connected - connect a wallet to test NFT minting');
  }
  
  if (!results.bladeWallet.windowBlade?.exists) {
    results.recommendations.push('⚠️ Blade Wallet extension not detected - install from https://bladewallet.io/');
  }
  
  if (results.hederaSDK.error) {
    results.recommendations.push('❌ Hedera SDK issues detected - check console for details');
  }
  
  if (results.nftMinting.error) {
    results.recommendations.push('❌ NFT minting module issues detected - check imports');
  }

  // 7. Output results
  console.log('📊 System Check Results:');
  console.table(results.imports);
  console.table(results.walletManager);
  console.table(results.bladeWallet);
  console.table(results.hederaSDK);
  console.table(results.nftMinting);
  
  if (results.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    results.recommendations.forEach(rec => console.log(rec));
  } else {
    console.log('✅ All system components appear to be working correctly');
  }

  return results;
}

/**
 * Add system check function to window for manual testing
 */
export function addSystemCheckToWindow() {
  if (typeof window !== 'undefined') {
    window.performSystemCheck = performSystemCheck;
    console.log('🔧 System check function added: window.performSystemCheck()');
  }
}

export default {
  performSystemCheck,
  addSystemCheckToWindow
};
