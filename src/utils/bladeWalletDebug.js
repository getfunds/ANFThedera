/**
 * Blade Wallet Debugging Utilities
 * Helps diagnose and fix common Blade Wallet integration issues
 */

/**
 * Comprehensive Blade Wallet environment diagnosis
 */
export async function diagnoseBlade() {
  console.log('🔍 Starting Blade Wallet comprehensive diagnosis...');
  
  const diagnosis = {
    timestamp: new Date().toISOString(),
    environment: {},
    bladeConnector: {},
    windowBlade: {},
    recommendations: []
  };

  // 1. Check browser environment
  try {
    diagnosis.environment = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      windowExists: typeof window !== 'undefined',
      location: window.location.href
    };
  } catch (envError) {
    diagnosis.environment.error = envError.message;
  }

  // 2. Check BladeConnector availability
  try {
    const { BladeConnector, ConnectorStrategy } = await import('@bladelabs/blade-web3.js');
    diagnosis.bladeConnector.imported = true;
    diagnosis.bladeConnector.hasConnectorStrategy = typeof ConnectorStrategy !== 'undefined';
    
    // Try to initialize BladeConnector
    try {
      const dappMetadata = {
        name: "AI Art NFT Marketplace",
        description: "Debug test for Blade Wallet integration",
        url: window.location.origin,
        icons: [`${window.location.origin}/favicon.ico`]
      };
      
      const connector = await BladeConnector.init(
        ConnectorStrategy.EXTENSION,
        dappMetadata
      );
      
      diagnosis.bladeConnector.initialized = true;
      diagnosis.bladeConnector.canGetSigners = typeof connector.getSigners === 'function';
      diagnosis.bladeConnector.canCreateSession = typeof connector.createSession === 'function';
      
      // Try to get signers
      try {
        const signers = await connector.getSigners();
        diagnosis.bladeConnector.signersAvailable = signers && signers.length > 0;
        diagnosis.bladeConnector.signerCount = signers ? signers.length : 0;
        
        if (signers && signers.length > 0) {
          const signer = signers[0];
          diagnosis.bladeConnector.signerType = signer.constructor.name;
          diagnosis.bladeConnector.signerMethods = Object.keys(signer).filter(key => typeof signer[key] === 'function');
          
          // Check for WalletConnect service
          if (signer.walletConnectService) {
            diagnosis.bladeConnector.hasWalletConnectService = true;
            diagnosis.bladeConnector.walletConnectMethods = Object.keys(signer.walletConnectService).filter(key => typeof signer.walletConnectService[key] === 'function');
          }
        }
      } catch (signerError) {
        diagnosis.bladeConnector.signerError = signerError.message;
      }
      
    } catch (initError) {
      diagnosis.bladeConnector.initError = initError.message;
      diagnosis.bladeConnector.initialized = false;
    }
    
  } catch (importError) {
    diagnosis.bladeConnector.importError = importError.message;
    diagnosis.bladeConnector.imported = false;
  }

  // 3. Check window.blade availability
  try {
    if (typeof window !== 'undefined') {
      diagnosis.windowBlade.windowExists = true;
      diagnosis.windowBlade.bladeExists = typeof window.blade !== 'undefined';
      
      if (window.blade) {
        diagnosis.windowBlade.methods = Object.keys(window.blade).filter(key => typeof window.blade[key] === 'function');
        diagnosis.windowBlade.properties = Object.keys(window.blade).filter(key => typeof window.blade[key] !== 'function');
        
        // Check specific methods we need
        diagnosis.windowBlade.hasSendTransaction = typeof window.blade.sendTransaction === 'function';
        diagnosis.windowBlade.hasExecuteTransaction = typeof window.blade.executeTransaction === 'function';
        diagnosis.windowBlade.hasSignAndExecuteTransaction = typeof window.blade.signAndExecuteTransaction === 'function';
      }
    }
  } catch (windowError) {
    diagnosis.windowBlade.error = windowError.message;
  }

  // 4. Generate recommendations
  if (!diagnosis.bladeConnector.imported) {
    diagnosis.recommendations.push('❌ Install @bladelabs/blade-web3.js: npm install @bladelabs/blade-web3.js');
  }
  
  if (!diagnosis.bladeConnector.initialized) {
    diagnosis.recommendations.push('⚠️ BladeConnector initialization failed - check browser console for details');
  }
  
  if (!diagnosis.windowBlade.bladeExists) {
    diagnosis.recommendations.push('❌ Blade Wallet extension not detected - install from https://bladewallet.io/');
  }
  
  if (diagnosis.bladeConnector.signerError) {
    diagnosis.recommendations.push('⚠️ Signer access failed - try connecting wallet first');
  }
  
  if (diagnosis.windowBlade.methods && diagnosis.windowBlade.methods.length === 0) {
    diagnosis.recommendations.push('⚠️ No window.blade methods available - extension may be disabled');
  }

  // 5. Output diagnosis
  console.log('📊 Blade Wallet Diagnosis Results:');
  console.table(diagnosis.environment);
  console.table(diagnosis.bladeConnector);
  console.table(diagnosis.windowBlade);
  
  if (diagnosis.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    diagnosis.recommendations.forEach(rec => console.log(rec));
  } else {
    console.log('✅ All Blade Wallet components appear to be working correctly');
  }

  return diagnosis;
}

/**
 * Test Blade Wallet transaction preparation
 */
export async function testBladeTransaction() {
  console.log('🧪 Testing Blade Wallet transaction preparation...');
  
  try {
    const { 
      TokenCreateTransaction, 
      TokenType, 
      TokenSupplyType, 
      AccountId, 
      Hbar, 
      TransactionId 
    } = await import('@hashgraph/sdk');
    
    // Create a test transaction
    const testAccountId = AccountId.fromString('0.0.123456');
    const testTransaction = new TokenCreateTransaction()
      .setTokenName('Test NFT Collection')
      .setTokenSymbol('TEST')
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(100)
      .setTreasuryAccountId(testAccountId)
      .setMaxTransactionFee(new Hbar(20));
    
    // Set transaction ID
    const transactionId = TransactionId.generate(testAccountId);
    testTransaction.setTransactionId(transactionId);
    
    // Set node account IDs
    const nodeAccountIds = [new AccountId(3), new AccountId(4), new AccountId(5)];
    testTransaction.setNodeAccountIds(nodeAccountIds);
    
    console.log('✅ Test transaction created successfully');
    console.log('📋 Transaction details:');
    console.log('  - Transaction ID:', transactionId.toString());
    console.log('  - Node Account IDs:', nodeAccountIds.map(id => id.toString()));
    
    // Test freezing
    try {
      const frozenTransaction = testTransaction.freeze();
      const transactionBytes = frozenTransaction.toBytes();
      
      console.log('✅ Transaction frozen successfully');
      console.log('📦 Frozen transaction size:', transactionBytes.length, 'bytes');
      
      return {
        success: true,
        transactionId: transactionId.toString(),
        nodeAccountIds: nodeAccountIds.map(id => id.toString()),
        transactionSize: transactionBytes.length
      };
      
    } catch (freezeError) {
      console.error('❌ Transaction freeze failed:', freezeError);
      return {
        success: false,
        error: freezeError.message,
        stage: 'freeze'
      };
    }
    
  } catch (sdkError) {
    console.error('❌ Hedera SDK test failed:', sdkError);
    return {
      success: false,
      error: sdkError.message,
      stage: 'sdk_import'
    };
  }
}

/**
 * Add debugging functions to window for manual testing
 */
export function addDebugFunctions() {
  if (typeof window !== 'undefined') {
    window.diagnoseBlade = diagnoseBlade;
    window.testBladeTransaction = testBladeTransaction;
    
    console.log('🔧 Debug functions added to window:');
    console.log('  - window.diagnoseBlade() - Full Blade Wallet diagnosis');
    console.log('  - window.testBladeTransaction() - Test transaction preparation');
  }
}

export default {
  diagnoseBlade,
  testBladeTransaction,
  addDebugFunctions
};
