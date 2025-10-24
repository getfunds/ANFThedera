// Blade Wallet integration using official Blade Web3 SDK
import { BladeConnector, ConnectorStrategy } from '@bladelabs/blade-web3.js';

class BladeWallet {
  constructor() {
    this.bladeConnector = null;
    this.isInitialized = false;
    this.state = {
      accountIds: [],
      network: null,
      isConnected: false,
      walletType: 'blade'
    };
  }

  async initialize() {
    try {
      console.log('⚔️ Initializing Blade Wallet with official SDK...');
      
      // Initialize BladeConnector with safe error handling for cross-origin issues
      const dappMetadata = {
        name: "AI Art NFT Marketplace",
        description: "Create and mint AI-generated NFTs on Hedera",
        url: window.location.origin,
        icons: [`${window.location.origin}/favicon.ico`]
      };
      
      console.log('🔧 DApp metadata:', dappMetadata);
      
      // Wrap initialization in try-catch to handle cross-origin SecurityErrors
      try {
        this.bladeConnector = await BladeConnector.init(
          ConnectorStrategy.EXTENSION,
          dappMetadata
        );
        console.log('✅ BladeConnector initialized successfully');
      } catch (initError) {
        console.error('❌ BladeConnector initialization error:', initError);
        
        // Handle specific cross-origin errors
        if (initError.name === 'SecurityError' || initError.message.includes('cross-origin')) {
          console.log('🔄 Attempting initialization with modified configuration...');
          
          // Try with a modified configuration that might avoid cross-origin issues
          try {
            this.bladeConnector = await BladeConnector.init(
              ConnectorStrategy.WALLET_CONNECT, // Try WalletConnect as alternative
              {
                ...dappMetadata,
                url: 'http://localhost:3000' // Explicit localhost URL
              }
            );
            console.log('✅ BladeConnector initialized with WalletConnect strategy');
          } catch (fallbackError) {
            console.error('❌ Fallback initialization also failed:', fallbackError);
            throw new Error(`Blade Wallet initialization failed due to browser security restrictions. Original error: ${initError.message}. Fallback error: ${fallbackError.message}`);
          }
        } else {
          throw initError;
        }
      }
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Blade Wallet initialization failed:', error);
      throw new Error(`Blade Wallet initialization failed: ${error.message}`);
    }
  }

  isAvailable() {
    if (typeof window === 'undefined') return false;
    
    console.log('🔍 Checking Blade Wallet extension availability...');
    
    // Safely check for Blade Wallet without triggering cross-origin errors
    try {
      // The BladeConnector will handle extension detection during initialization
      // We'll return true to show the option and let BladeConnector validate during connection
      console.log('✅ Blade Wallet option available (BladeConnector will verify extension)');
      return true;
    } catch (error) {
      console.log('⚠️ Cross-origin error during availability check:', error.message);
      // Still return true to show the option - let the connection attempt handle the validation
      return true;
    }
  }

  async connect() {
    try {
      console.log('⚔️ Connecting to Blade Wallet using BladeConnector...');
      
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.bladeConnector) {
        throw new Error('BladeConnector not initialized');
      }

      // Create session with Blade Wallet
      const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
      console.log(`🔗 Creating Blade session on ${network}...`);
      
      try {
        const pairedAccountIds = await this.bladeConnector.createSession({
          network: network,
          dAppCode: "AI_ART_NFT" // Your dApp identifier
        });

        if (!pairedAccountIds || pairedAccountIds.length === 0) {
          throw new Error('No accounts returned from Blade Wallet connection');
        }

        const primaryAccountId = pairedAccountIds[0];
        
        // Update state
        this.state.accountIds = pairedAccountIds;
        this.state.network = network;
        this.state.isConnected = true;

        console.log('✅ Blade Wallet connected successfully!');
        console.log('🔗 Connected accounts:', pairedAccountIds);
        console.log('🎯 Primary account:', primaryAccountId);

        return {
          accountId: primaryAccountId,
          walletType: 'blade',
          network: network,
          allAccounts: pairedAccountIds
        };
      } catch (sessionError) {
        console.error('❌ Session creation failed:', sessionError);
        
        // Handle cross-origin and other session errors
        if (sessionError.message.includes('cross-origin') || sessionError.message.includes('SecurityError')) {
          throw new Error('Blade Wallet connection blocked by browser security. Please try refreshing the page or using a different browser.');
        } else if (sessionError.message.includes('Extension not found')) {
          throw new Error('Blade Wallet extension not detected. Please ensure it is installed and enabled.');
        } else {
          throw sessionError;
        }
      }
      
    } catch (error) {
      console.error('❌ Blade Wallet connection failed:', error);
      
      // Provide specific error messages
      if (error.message.includes('Extension not found') || error.message.includes('not installed')) {
        throw new Error('Blade Wallet extension not found. Please install Blade Wallet from https://bladewallet.io/');
      } else if (error.message.includes('User rejected') || error.message.includes('denied')) {
        throw new Error('Connection rejected by user in Blade Wallet');
      } else if (error.message.includes('cross-origin') || error.message.includes('SecurityError')) {
        throw new Error('Browser security restrictions prevent Blade Wallet connection. Please try refreshing the page or using HTTPS.');
      } else {
        throw new Error(`Blade Wallet connection failed: ${error.message}`);
      }
    }
  }


  async disconnect() {
    try {
      if (this.bladeConnector && typeof this.bladeConnector.killSession === 'function') {
        await this.bladeConnector.killSession();
        console.log('🔌 Blade Wallet session terminated');
      }
      
      // Reset state
      this.state.isConnected = false;
      this.state.accountIds = [];
      this.state.network = null;
      this.bladeConnector = null;
      this.isInitialized = false;
      
      console.log('✅ Blade Wallet disconnected');
    } catch (error) {
      console.error('❌ Blade Wallet disconnect error:', error);
    }
  }

  getConnectionState() {
    return {
      ...this.state
    };
  }

  isConnected() {
    return this.state.isConnected && this.state.accountIds.length > 0;
  }

  getPrimaryAccountId() {
    return this.state.accountIds.length > 0 ? this.state.accountIds[0] : null;
  }

  async sendTransaction(transaction, accountToSign) {
    if (!this.isConnected()) {
      throw new Error('Blade Wallet not connected');
    }

    try {
      console.log('⚔️ Signing transaction with Blade Wallet...');
      console.log('👤 Account to sign:', accountToSign);
      
      if (!this.bladeConnector) {
        throw new Error('BladeConnector not initialized');
      }

      // CORRECT APPROACH: Use BladeSigner pattern from official Blade SDK
      // Reference: https://github.com/Blade-Labs/blade-web3.js/
      try {
        console.log('🔄 Using BladeSigner pattern for Hedera transactions...');
        
        // Get the BladeSigner from BladeConnector
        const signers = await this.bladeConnector.getSigners();
        if (!signers || signers.length === 0) {
          throw new Error('No signers available from BladeConnector');
        }

        const bladeSigner = signers[0];
        console.log('📤 Using BladeSigner for transaction execution...');
        console.log('🔍 BladeSigner type:', bladeSigner.constructor.name);
        console.log('🔍 Available methods:', Object.keys(bladeSigner));

        // Method 1: Use the proper BladeSigner pattern with transaction preparation
        try {
          console.log('🔧 Attempting BladeSigner with proper transaction preparation...');
          
          // CORRECTED: Use proper Hedera SDK pattern for BladeSigner
          console.log('🧊 Preparing transaction with BladeSigner (correct Hedera pattern)...');
          
          // Method A: Try freezeWithSigner if available
          let preparedTransaction;
          try {
            preparedTransaction = await transaction.freezeWithSigner(bladeSigner);
            console.log('✅ Transaction frozen with BladeSigner');
          } catch (freezeError) {
            console.log('⚠️ freezeWithSigner failed, using standard freeze...');
            // Fallback: Use standard freeze
            preparedTransaction = transaction.freeze();
          }
          
          // Step 2: Sign the prepared transaction
          console.log('✍️ Signing prepared transaction...');
          const signedTransaction = await bladeSigner.signTransaction(preparedTransaction);
          console.log('✅ Transaction signed successfully');
          
          // Step 3: Execute using the correct method
          console.log('🚀 Executing signed transaction...');
          let result;
          
          // Try different execution methods based on what's available
          if (typeof bladeSigner.call === 'function') {
            result = await bladeSigner.call(signedTransaction);
            console.log('✅ Transaction executed via BladeSigner.call:', result);
          } else if (typeof signedTransaction.execute === 'function') {
            result = await signedTransaction.execute();
            console.log('✅ Transaction executed via signedTransaction.execute:', result);
          } else {
            throw new Error('No execution method available on BladeSigner');
          }

          // Extract transaction details
          let transactionId = 'unknown';
          if (result && result.transactionId) {
            transactionId = result.transactionId.toString();
          } else if (result && result.id) {
            transactionId = result.id.toString();
          }
          
          console.log('✅ Blade Wallet transaction completed successfully!');
          console.log('🔍 Transaction ID:', transactionId);
          
          return {
            transactionId,
            success: true,
            result: result
          };
          
        } catch (signerError) {
          console.error('❌ BladeSigner method failed:', signerError);
          
          // Method 2: Try executeWithSigner pattern (standard Hedera SDK)
          try {
            console.log('🔧 Attempting executeWithSigner pattern...');
            
            // Use the standard Hedera SDK executeWithSigner method
            const result = await transaction.executeWithSigner(bladeSigner);
            console.log('✅ Transaction executed via executeWithSigner:', result);
            
            // Get the receipt to extract transaction details
            const receipt = await result.getReceiptWithSigner(bladeSigner);
            console.log('✅ Transaction receipt obtained:', receipt);
            
            let transactionId = result.transactionId ? result.transactionId.toString() : 'unknown';
            
            return {
              transactionId,
              success: true,
              result: result,
              receipt: receipt
            };
            
          } catch (executeError) {
            console.error('❌ BladeSigner.execute failed:', executeError);
            
            // Method 3: Handle WCSigner (WalletConnect Signer) properly
            try {
              console.log('🔧 Attempting WalletConnect signer handling...');
              
              // Check what methods and properties are actually available
              const availableMethods = Object.keys(bladeSigner).filter(key => typeof bladeSigner[key] === 'function');
              const availableProperties = Object.keys(bladeSigner).filter(key => typeof bladeSigner[key] !== 'function');
              
              console.log('🔍 Available BladeSigner methods:', availableMethods);
              console.log('🔍 Available BladeSigner properties:', availableProperties);
              console.log('🔍 BladeSigner type:', bladeSigner.constructor.name);
              
              // Handle WCSigner (WalletConnect Signer) - this is what Blade actually provides
              if (bladeSigner.constructor.name === 'WCSigner' || availableProperties.includes('walletConnectService')) {
                console.log('📱 WCSigner detected - using WalletConnect RPC approach...');
                
                if (bladeSigner.walletConnectService && typeof bladeSigner.walletConnectService.request === 'function') {
                  console.log('📞 Using WalletConnect service for transaction...');
                  
                  // Convert transaction to bytes for WalletConnect
                  const transactionBytes = transaction.toBytes();
                  
                  // Use WalletConnect RPC to sign and execute transaction
                  const wcRequest = {
                    method: 'hedera_signAndExecuteTransaction',
                    params: {
                      signerAccountId: accountToSign,
                      transactionList: Buffer.from(transactionBytes).toString('base64')
                    }
                  };
                  
                  console.log('📤 Sending WalletConnect RPC request...');
                  const result = await bladeSigner.walletConnectService.request(wcRequest);
                  console.log('✅ WalletConnect RPC successful:', result);
                  
                  return {
                    transactionId: result.transactionId || result.id || 'pending',
                    success: true,
                    result: result
                  };
                } else {
                  throw new Error('WalletConnect service not available on WCSigner');
                }
              } 
              // Handle other signer types
              else if (availableMethods.length > 0) {
                console.log('🔧 Trying available signer methods...');
                
                // Try any available method that might work
                for (const method of availableMethods) {
                  if (method.toLowerCase().includes('sign') || method.toLowerCase().includes('execute') || method.toLowerCase().includes('call')) {
                    try {
                      console.log(`📤 Trying ${method}...`);
                      const result = await bladeSigner[method](transaction);
                      console.log(`✅ ${method} successful:`, result);
                      
                      return {
                        transactionId: result.transactionId || result.id || 'pending',
                        success: true,
                        result: result
                      };
                    } catch (methodError) {
                      console.log(`❌ ${method} failed:`, methodError.message);
                      continue;
                    }
                  }
                }
                
                throw new Error(`No working methods found among available: ${availableMethods.join(', ')}`);
              } else {
                throw new Error(`BladeSigner has no methods available. Type: ${bladeSigner.constructor.name}`);
              }
              
            } catch (alternativeError) {
              console.error('❌ WalletConnect signer handling failed:', alternativeError);
              throw signerError; // Throw the original signer error
            }
          }
        }
        
      } catch (bladeError) {
        console.error('❌ Blade SDK transaction failed:', bladeError);
        
        // Fallback: Try window.blade API if available
        try {
          console.log('🔄 Trying window.blade API fallback...');
          
          // Safely check for window.blade methods
          let bladeMethods = [];
          try {
            if (typeof window !== 'undefined' && window.blade) {
              bladeMethods = Object.keys(window.blade).filter(key => typeof window.blade[key] === 'function');
              console.log('🔍 Available window.blade methods:', bladeMethods);
            }
          } catch (windowError) {
            console.log('⚠️ Cannot access window.blade due to security restrictions:', windowError.message);
          }
          
          if (bladeMethods.length === 0) {
            throw new Error('No window.blade API methods available - extension may not be installed or accessible');
          }
          
          // Try different window.blade methods
          if (bladeMethods.includes('sendTransaction')) {
            console.log('📤 Using window.blade.sendTransaction...');
            const txBytes = typeof transaction.toBytes === 'function' 
              ? transaction.toBytes() 
              : transaction;
              
            const result = await window.blade.sendTransaction(txBytes, accountToSign);
            console.log('✅ window.blade.sendTransaction successful:', result);
            
            return {
              transactionId: result.transactionId || result.id || 'pending',
              success: true,
              result: result
            };
          } else if (bladeMethods.includes('executeTransaction')) {
            console.log('📤 Using window.blade.executeTransaction...');
            const result = await window.blade.executeTransaction(transaction, accountToSign);
            console.log('✅ window.blade.executeTransaction successful:', result);
            
            return {
              transactionId: result.transactionId || result.id || 'pending',
              success: true,
              result: result
            };
          } else if (bladeMethods.includes('signAndExecuteTransaction')) {
            console.log('📤 Using window.blade.signAndExecuteTransaction...');
            const result = await window.blade.signAndExecuteTransaction(transaction, accountToSign);
            console.log('✅ window.blade.signAndExecuteTransaction successful:', result);
            
            return {
              transactionId: result.transactionId || result.id || 'pending',
              success: true,
              result: result
            };
          } else {
            throw new Error(`No suitable window.blade methods found. Available: ${bladeMethods.join(', ')}`);
          }
          
        } catch (fallbackError) {
          console.error('❌ All Blade transaction methods failed:', fallbackError);
          console.error('💡 Suggestion: Try disconnecting and reconnecting Blade Wallet, or refresh the page');
          throw bladeError; // Throw the original Blade SDK error
        }
      }
      
    } catch (error) {
      console.error('❌ Blade Wallet transaction signing failed:', error);
      
      // Provide specific error messages based on Hedera documentation patterns
      if (error.message.includes('User rejected') || error.message.includes('denied')) {
        throw new Error('Transaction rejected by user in Blade Wallet');
      } else if (error.message.includes('Insufficient')) {
        throw new Error('Insufficient HBAR balance to pay transaction fees');
      } else if (error.message.includes('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT')) {
        throw new Error('Token not associated with account. Please associate the token first.');
      } else if (error.message.includes('INVALID_SIGNATURE')) {
        throw new Error('Invalid signature. Please ensure you are using the correct account and keys.');
      } else if (error.message.includes('Internal error')) {
        throw new Error('Blade Wallet internal error. Please try disconnecting and reconnecting your wallet, or refresh the page.');
      } else if (error.message.includes('Missing or invalid')) {
        throw new Error('Invalid transaction format for Blade Wallet. Please ensure the transaction is properly constructed and frozen.');
      } else {
        throw new Error(`Blade Wallet transaction failed: ${error.message}`);
      }
    }
  }

  async ensureTokenAssociation(tokenIdStr) {
    const accountId = this.getPrimaryAccountId();
    if (!accountId) throw new Error('Blade Wallet not connected');

    try {
      console.log('🔗 Ensuring token association via Blade Wallet...');
      
      // Use Blade wallet's native token association
      if (!this.bladeConnector || !this.accountId) {
        throw new Error('Blade Wallet not properly connected');
      }

      // Get the signer
      const signers = await this.bladeConnector.getSigners();
      if (!signers || signers.length === 0) {
        throw new Error('No signers available from Blade Wallet');
      }

      const bladeSigner = signers[0];

      // Import Hedera SDK for token association transaction
      const { TokenAssociateTransaction, TokenId } = await import('@hashgraph/sdk');

      // Create token association transaction
      const transaction = new TokenAssociateTransaction()
        .setAccountId(this.accountId)
        .setTokenIds([TokenId.fromString(tokenIdStr)]);

      // Execute transaction using Blade wallet
      const result = await bladeSigner.call(transaction);
      
      console.log('✅ Token association successful:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Blade Wallet token association failed:', error);
      throw new Error(`Token association failed: ${error.message}`);
    }
  }
}

// Export singleton instance
const bladeWallet = new BladeWallet();
export default bladeWallet;
