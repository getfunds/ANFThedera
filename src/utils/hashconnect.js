// Modern Hedera wallet integration using official SDKs
import walletManager, { WALLET_TYPES } from './wallets/wallet-manager.js';

// Export wallet types for compatibility
export { WALLET_TYPES };

// Legacy compatibility functions - now powered by modern wallet manager

export const getAvailableWallets = () => {
  return walletManager.getAvailableWallets();
};

export const connectToWallet = async (walletType) => {
  return await walletManager.connectWallet(walletType);
};

export const disconnectWallet = async () => {
  return await walletManager.disconnect();
};

export const isWalletConnected = () => {
  return walletManager.isConnected();
};

export const getPrimaryAccountId = () => {
  return walletManager.getPrimaryAccountId();
};

export const getConnectionState = () => {
  return walletManager.getConnectionState();
};

export const sendTransaction = async (transaction, accountToSign) => {
  return await walletManager.sendTransaction(transaction, accountToSign);
};

// Additional utility functions
export const getCurrentWalletType = () => {
  return walletManager.getCurrentWalletType();
};

export const getCurrentWallet = () => {
  return walletManager.getCurrentWallet();
};

export const debugWalletStates = () => {
  return walletManager.debugWalletStates();
};

// Initialize function for backward compatibility
export const initHashConnect = async () => {
  console.log('🔗 Modern wallet system initialized');
  return true;
};

// Legacy functions for compatibility (now use wallet manager)
export const getHashConnect = () => {
  return walletManager.getCurrentWallet();
};

export const signAndExecuteTransaction = async (transaction, accountId) => {
  return await walletManager.sendTransaction(transaction, accountId);
};

export const getAccountInfo = async (accountId) => {
  const currentWallet = walletManager.getCurrentWallet();
  if (currentWallet && typeof currentWallet.getAccountInfo === 'function') {
    return await currentWallet.getAccountInfo(accountId);
  }
  throw new Error('Account info not available for current wallet');
};

console.log('✅ Modern Hedera wallet system loaded with official SDKs');

// Association helper
export const ensureTokenAssociation = async (tokenId) => {
  return await walletManager.ensureTokenAssociation(tokenId);
};

// User-owned mint helpers
export const prepareUserMint = async (accountId, tokenId, metadata) => {
  const r = await fetch('/api/hts/mint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, tokenId, metadata })
  });
  const j = await r.json();
  if (!r.ok || !j.success) throw new Error(j.error || 'Failed to prepare mint');
  return Uint8Array.from(atob(j.transactionBytes), c => c.charCodeAt(0));
};

export const prepareUserCreateCollection = async (accountId, params) => {
  const r = await fetch('/api/hts/prepareCreate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, ...params })
  });
  const j = await r.json();
  if (!r.ok || !j.success) throw new Error(j.error || 'Failed to prepare create');
  return Uint8Array.from(atob(j.transactionBytes), c => c.charCodeAt(0));
};