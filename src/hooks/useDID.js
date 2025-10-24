/**
 * React Hook for Decentralized Identity (DID) Management
 * 
 * This hook provides:
 * - DID status checking
 * - DID registration flow
 * - Integration with Blade Wallet
 * - Pre-mint DID verification
 */

import { useState, useEffect, useCallback } from 'react';
import { checkExistingDID, getOrCreateDID } from '../utils/hederaDID';

export function useDID(accountId) {
  const [didInfo, setDidInfo] = useState(null);
  const [isLoadingDID, setIsLoadingDID] = useState(false);
  const [didError, setDidError] = useState(null);
  const [hasDID, setHasDID] = useState(false);
  const [showDIDModal, setShowDIDModal] = useState(false);

  /**
   * Check if user has an existing DID
   */
  const checkDID = useCallback(async () => {
    if (!accountId) {
      return null;
    }

    try {
      setIsLoadingDID(true);
      setDidError(null);

      console.log('🔍 Checking DID for account:', accountId);
      
      const existingDID = await checkExistingDID(accountId);
      
      if (existingDID) {
        console.log('✅ Found existing DID:', existingDID.did);
        setDidInfo(existingDID);
        setHasDID(true);
        return existingDID;
      } else {
        console.log('ℹ️ No DID found for this account');
        setHasDID(false);
        return null;
      }

    } catch (error) {
      console.error('❌ Error checking DID:', error);
      setDidError(error.message);
      setHasDID(false);
      return null;
    } finally {
      setIsLoadingDID(false);
    }
  }, [accountId]);

  /**
   * Register a new DID for the user
   */
  const registerDID = useCallback(async (profile = {}) => {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    try {
      setIsLoadingDID(true);
      setDidError(null);

      console.log('🆕 Registering new DID for account:', accountId);
      console.log('📝 Profile:', profile);

      // Pass skipCheck=true since we already checked before showing the modal
      const newDID = await getOrCreateDID(accountId, profile, true);

      console.log('🎉 DID registration complete!');
      console.log('🆔 DID:', newDID.did);

      setDidInfo(newDID);
      setHasDID(true);
      setShowDIDModal(false);

      return newDID;

    } catch (error) {
      console.error('❌ Error registering DID:', error);
      setDidError(error.message);
      throw error;
    } finally {
      setIsLoadingDID(false);
    }
  }, [accountId]);

  /**
   * Ensure user has a DID before minting
   * This is the main function to call before minting an NFT
   */
  const ensureDIDBeforeMint = useCallback(async () => {
    console.log('🔐 Ensuring DID before minting...');

    // First check if DID already exists
    const existingDID = await checkDID();

    if (existingDID) {
      console.log('✅ User has DID, can proceed with minting');
      return existingDID;
    }

    // No DID exists - show registration modal
    console.log('⚠️ No DID found, showing registration modal');
    setShowDIDModal(true);

    // Return a promise that will be resolved when DID is registered
    return new Promise((resolve, reject) => {
      // Store resolve/reject functions to be called after registration
      window.__didRegistrationResolve = resolve;
      window.__didRegistrationReject = reject;
    });

  }, [checkDID]);

  /**
   * Complete DID registration and resolve the promise
   */
  const completeDIDRegistration = useCallback(async (metadata) => {
    try {
      const newDID = await registerDID(metadata);
      
      // Resolve the promise if it exists
      if (window.__didRegistrationResolve) {
        window.__didRegistrationResolve(newDID);
        delete window.__didRegistrationResolve;
        delete window.__didRegistrationReject;
      }

      return newDID;

    } catch (error) {
      // Reject the promise if it exists
      if (window.__didRegistrationReject) {
        window.__didRegistrationReject(error);
        delete window.__didRegistrationResolve;
        delete window.__didRegistrationReject;
      }

      throw error;
    }
  }, [registerDID]);

  /**
   * Cancel DID registration
   */
  const cancelDIDRegistration = useCallback(() => {
    setShowDIDModal(false);

    // Reject the promise if it exists
    if (window.__didRegistrationReject) {
      window.__didRegistrationReject(new Error('DID registration cancelled by user'));
      delete window.__didRegistrationResolve;
      delete window.__didRegistrationReject;
    }
  }, []);

  // Reset DID state when account changes
  // NOTE: We don't check automatically - only when user clicks "Mint NFT"
  useEffect(() => {
    if (!accountId) {
      // Only reset state when disconnected
      setDidInfo(null);
      setHasDID(false);
      setDidError(null);
    }
    // Don't check DID automatically - wait for mint action
  }, [accountId]);

  return {
    // State
    didInfo,
    hasDID,
    isLoadingDID,
    didError,
    showDIDModal,

    // Functions
    checkDID,
    registerDID,
    ensureDIDBeforeMint,
    completeDIDRegistration,
    cancelDIDRegistration,
    setShowDIDModal
  };
}

export default useDID;

