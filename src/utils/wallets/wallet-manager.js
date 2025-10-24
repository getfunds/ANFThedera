import bladeWallet from './blade.js';

export const WALLET_TYPES = {
  BLADE: 'blade'
};

class WalletManager {
  constructor() {
    this.currentWallet = null;
    this.currentWalletType = null;
    this.connectionState = {
      isConnected: false,
      accountId: null,
      walletType: null,
      network: null
    };
  }

  // Get available wallets with proper detection
  getAvailableWallets() {
    const wallets = [];

    console.log('🔍 Detecting available Hedera wallets...');

    // Blade Wallet (direct integration - only supported wallet)
    if (bladeWallet.isAvailable()) {
      wallets.push({
        type: WALLET_TYPES.BLADE,
        name: 'Blade Wallet',
        icon: '⚔️',
        description: 'Multi-chain wallet with Hedera support',
        priority: 1,
        available: true
      });
      console.log('✅ Blade Wallet detected');
    } else {
      console.log('❌ Blade Wallet not detected');
    }

    console.log(`📱 Found ${wallets.length} available wallet(s)`);
    return wallets;
  }

  async connectWallet(walletType) {
    try {
      console.log(`🔗 Connecting to ${walletType}...`);

      let result;
      let wallet;

      if (walletType === WALLET_TYPES.BLADE) {
        wallet = bladeWallet;
        result = await bladeWallet.connect();
      } else {
        throw new Error(`Unsupported wallet type: ${walletType}. Only Blade wallet is supported.`);
      }

      // Update connection state
      this.currentWallet = wallet;
      this.currentWalletType = walletType;
      this.connectionState = {
        isConnected: true,
        accountId: result.accountId,
        walletType: result.walletType,
        network: result.network,
        ...result
      };

      console.log(`✅ Successfully connected to ${walletType}:`, result);
      return result;

    } catch (error) {
      console.error(`❌ Failed to connect to ${walletType}:`, error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.currentWallet) {
        await this.currentWallet.disconnect();
      }

      // Reset state
      this.currentWallet = null;
      this.currentWalletType = null;
      this.connectionState = {
        isConnected: false,
        accountId: null,
        walletType: null,
        network: null
      };

      console.log('✅ Wallet disconnected');
    } catch (error) {
      console.error('❌ Wallet disconnect error:', error);
      throw error;
    }
  }

  isConnected() {
    return this.connectionState.isConnected && 
           this.currentWallet && 
           this.currentWallet.isConnected();
  }

  getConnectionState() {
    if (this.currentWallet) {
      return this.currentWallet.getConnectionState();
    }
    return this.connectionState;
  }

  getPrimaryAccountId() {
    if (this.currentWallet) {
      return this.currentWallet.getPrimaryAccountId();
    }
    return this.connectionState.accountId;
  }

  getCurrentWalletType() {
    return this.currentWalletType;
  }

  getCurrentWallet() {
    return this.currentWallet;
  }

  async sendTransaction(transaction, accountToSign) {
    if (!this.isConnected()) {
      throw new Error('No wallet connected');
    }

    try {
      return await this.currentWallet.sendTransaction(transaction, accountToSign);
    } catch (error) {
      console.error('❌ Transaction error:', error);
      throw error;
    }
  }

  async ensureTokenAssociation(tokenId) {
    if (!this.isConnected()) {
      throw new Error('No wallet connected');
    }

    const wallet = this.currentWallet;
    if (wallet && typeof wallet.ensureTokenAssociation === 'function') {
      return await wallet.ensureTokenAssociation(tokenId);
    }

    throw new Error('Token association not supported by current wallet');
  }

  // Debug method to inspect wallet states
  debugWalletStates() {
    console.log('🔍 Wallet Manager Debug Info:');
    console.log('Current Wallet Type:', this.currentWalletType);
    console.log('Connection State:', this.connectionState);
    
    console.log('Blade Wallet State:', bladeWallet.getConnectionState());
    
    console.log('Available Wallets:', this.getAvailableWallets());
  }
}

// Export singleton instance
const walletManager = new WalletManager();
export default walletManager;

// Export Blade wallet instance for advanced use
export { bladeWallet };
