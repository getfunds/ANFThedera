'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { 
  connectToWallet, 
  disconnectWallet, 
  getConnectionState,
  isWalletConnected,
  getPrimaryAccountId,
  getAvailableWallets,
  WALLET_TYPES
} from '../utils/hashconnect';

const WalletContext = createContext();

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [accountId, setAccountId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pairingString, setPairingString] = useState('');
  const [availableWallets, setAvailableWallets] = useState([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [connectedWalletType, setConnectedWalletType] = useState(null);

  useEffect(() => {
    // Check if wallet was previously connected
    const checkConnection = async () => {
      try {
        const connected = isWalletConnected();
        if (connected) {
          setIsConnected(true);
          setAccountId(getPrimaryAccountId());
          const state = getConnectionState();
          setConnectedWalletType(state.walletType);
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    };

    // Get available wallets
    const wallets = getAvailableWallets();
    console.log('Setting available wallets:', wallets);
    setAvailableWallets(wallets);
    checkConnection();
  }, []);

  const connect = async (walletType = WALLET_TYPES.BLADE) => {
    try {
      console.log('WalletContext: Starting Blade wallet connection...');
      
      setIsLoading(true);
      setError(null);
      setShowWalletModal(false);
      
      console.log('WalletContext: Calling connectToWallet with Blade');
      const connectionData = await connectToWallet(WALLET_TYPES.BLADE);
      console.log('WalletContext: Got connection data:', connectionData);
      
      // Direct connection for Blade wallet
      if (connectionData.accountId) {
        setIsConnected(true);
        setAccountId(connectionData.accountId);
        setConnectedWalletType(WALLET_TYPES.BLADE);
        setIsLoading(false);
      }
      
    } catch (error) {
      console.error('WalletContext: Error connecting wallet:', error);
      setError(`Connection failed: ${error.message}`);
      setIsLoading(false);
      setShowWalletModal(false);
    }
  };

  const disconnect = async () => {
    try {
      disconnectWallet();
      setIsConnected(false);
      setAccountId(null);
      setPairingString('');
      setConnectedWalletType(null);
      setError(null);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      setError(error.message);
    }
  };

  const value = {
    isConnected,
    accountId,
    isLoading,
    error,
    pairingString,
    availableWallets,
    showWalletModal,
    connectedWalletType,
    connect,
    disconnect,
    setShowWalletModal,
    clearError: () => setError(null)
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
