/**
 * List NFT Modal Component
 * Allows users to list their NFTs for sale on the marketplace
 */

import { useState, useEffect } from 'react';
import { createMarketplaceListing } from '../utils/marketplace';
import styles from './ListNFTModal.module.css';

const ListNFTModal = ({ nft, isOpen, onClose, onSuccess }) => {
  const [listingType, setListingType] = useState('fixed'); // fixed, auction
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('604800'); // 7 days default
  const [royaltyPercentage, setRoyaltyPercentage] = useState('500'); // 5% default
  const [royaltyRecipient, setRoyaltyRecipient] = useState('');
  const [isListing, setIsListing] = useState(false);
  const [error, setError] = useState(null);
  
  // Approval state - now handled during listing submission
  const [approvalStep, setApprovalStep] = useState('form'); // form, checking, approving, confirming, approved, listing
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState(null);
  const [approvalError, setApprovalError] = useState(null);
  const [confirmationAttempt, setConfirmationAttempt] = useState(0);

  // No longer check approval on modal open - let user enter details first

  // Legacy approval functions - kept for potential manual debugging
  const checkApprovalStatus = async () => {
    const result = await checkApprovalStatusInternal();
    setApprovalStatus(result);
    return result;
  };

  // Internal helper functions (no UI state changes)
  const checkApprovalStatusInternal = async () => {
    try {
      console.log('🔍 Checking NFT approval status internally...');
      
      const response = await fetch('/api/check-hts-nft-approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenAddress: nft.tokenId.split('-')[0],
          tokenId: nft.serialNumber,
          spenderAddress: process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('📊 Internal approval check result:', result);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error checking approval internally:', error);
      return { isApproved: false, error: error.message };
    }
  };

  const executeApprovalForAllInternal = async (bladeSigner, accountId) => {
    try {
      console.log('🔓 Executing internal HTS setApprovalForAll...');
      
      const { setApprovalForAllHTS } = await import('../utils/htsNFTApproval');
      
      const result = await setApprovalForAllHTS(
        nft.tokenId.split('-')[0], // HTS token address
        process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID, // Marketplace address
        true, // Approve
        bladeSigner,
        accountId
      );
      
      console.log('✅ Internal HTS setApprovalForAll successful!', result);
      return result;
      
    } catch (error) {
      console.error('❌ Internal HTS setApprovalForAll failed:', error);
      throw error;
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!price || parseFloat(price) <= 0) {
      setError('Please enter a valid price');
      return;
    }

    try {
      setIsListing(true);
      setError(null);
      setApprovalError(null);
      
      console.log('🏪 Starting listing process...', {
        nft,
        listingType,
        price,
        duration
      });

      // Get wallet signer
      const { getBladeWalletSigner } = await import('../utils/bladeWalletNFTMinting');
      const { bladeSigner, accountId } = await getBladeWalletSigner();

      // Step 1: Check approval status first
      setApprovalStep('checking');
      console.log('🔍 Checking NFT approval status before listing...');
      
      const approvalCheck = await checkApprovalStatusInternal();
      
      if (!approvalCheck.isApproved) {
        // Step 2: If not approved, trigger approval automatically
        setApprovalStep('approving');
        console.log('🔓 NFT not approved - triggering automatic approval...');
        
        const approvalResult = await executeApprovalForAllInternal(bladeSigner, accountId);
        
        // Wait for approval confirmation with retry logic
        setApprovalStep('confirming');
        console.log('⏳ Waiting for approval confirmation with retry logic...');
        
        let approvalConfirmed = false;
        let attempts = 0;
        const maxAttempts = 8;
        
        while (!approvalConfirmed && attempts < maxAttempts) {
          attempts++;
          setConfirmationAttempt(attempts);
          const waitTime = Math.min(2000 + (attempts * 1000), 8000); // Increase wait time: 3s, 4s, 5s...
          console.log(`🔄 Attempt ${attempts}/${maxAttempts}: Waiting ${waitTime/1000}s before checking approval...`);
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          const recheck = await checkApprovalStatusInternal();
          
          if (recheck.isApproved) {
            approvalConfirmed = true;
            console.log('✅ Approval confirmed!');
            break;
          } else {
            console.log(`⚠️ Attempt ${attempts}: Approval not yet confirmed, retrying...`);
          }
        }
        
        if (!approvalConfirmed) {
          throw new Error('NFT approval transaction was sent but confirmation timed out. Please wait a moment and try listing again.');
        }
        
        setApprovalStep('approved');
      }

      // Step 3: Create marketplace listing
      setApprovalStep('listing');
      console.log('📝 Creating marketplace listing...');
      
      const result = await createMarketplaceListing({
        tokenAddress: nft.tokenId.split('-')[0], // Extract token address from NFT ID
        tokenId: nft.serialNumber,
        price: price,
        duration: parseInt(duration),
        isAuction: listingType === 'auction',
        royaltyPercentage: parseInt(royaltyPercentage),
        royaltyRecipient: royaltyRecipient || accountId
      }, bladeSigner, accountId);

      console.log('✅ Listing created successfully:', result);

      // Call success callback
      if (onSuccess) {
        onSuccess(result);
      }

      // Close modal
      onClose();

      // Reset form
      resetForm();

    } catch (error) {
      console.error('❌ Error in listing process:', error);
      setError(error.message || 'Failed to create listing');
      setApprovalStep('form'); // Go back to form state
    } finally {
      setIsListing(false);
    }
  };

  const resetForm = () => {
    setListingType('fixed');
    setPrice('');
    setDuration('604800');
    setRoyaltyPercentage('500');
    setRoyaltyRecipient('');
    setError(null);
    // Reset approval state
    setApprovalStep('form');
    setApprovalStatus(null);
    setApprovalError(null);
    setConfirmationAttempt(0);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Helper function to convert account ID to EVM address
  const convertToEvmAddress = (accountId) => {
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
  };

  const formatDuration = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  };

  if (!isOpen || !nft) {
    return null;
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>List NFT for Sale</h2>
          <button
            onClick={handleClose}
            className={styles.closeButton}
          >
            <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Progress Step - Only show during listing process */}
          {(approvalStep === 'checking' || approvalStep === 'approving' || approvalStep === 'confirming' || approvalStep === 'listing') && (
            <div className={styles.approvalSection}>
              <div className={styles.approvalHeader}>
                <h3 className={styles.approvalTitle}>
                  {approvalStep === 'checking' && '🔍 Checking NFT Approval...'}
                  {approvalStep === 'approving' && '🔓 Approving NFT for Marketplace...'}
                  {approvalStep === 'confirming' && `⏳ Confirming Approval (Attempt ${confirmationAttempt}/8)...`}
                  {approvalStep === 'listing' && '📝 Creating Marketplace Listing...'}
                </h3>
                <p className={styles.approvalDescription}>
                  {approvalStep === 'checking' && 'Verifying if your NFT is approved for marketplace trading...'}
                  {approvalStep === 'approving' && 'Please sign the approval transaction in your wallet to allow marketplace trading...'}
                  {approvalStep === 'confirming' && 'Waiting for the approval transaction to be confirmed on Hedera network... This may take a few moments.'}
                  {approvalStep === 'listing' && 'Creating your marketplace listing - please wait...'}
                </p>
              </div>

              {/* Show loading spinner during progress */}
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
              </div>

              {/* Show any errors during the process */}
              {(approvalError || error) && (
                <div className={styles.approvalError}>
                  <svg className={styles.errorIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {approvalError || error}
                </div>
              )}
            </div>
          )}

          {/* Listing Form - Show immediately, disable during processing */}
          {approvalStep === 'form' && (
            <form onSubmit={handleSubmit} className={styles.listingForm}>
              {/* Info Message */}
              <div className={styles.infoMessage}>
                <div className={styles.infoIcon}>ℹ️</div>
                <div className={styles.infoContent}>
                  <h4>List Your NFT</h4>
                  <p>Enter your listing details below. We'll automatically handle approval if needed when you submit.</p>
                </div>
              </div>
              
              {/* NFT Preview */}
              <div className={styles.nftPreview}>
            <div className={styles.nftImageContainer}>
              {nft.image ? (
                <img
                  src={nft.image}
                  alt={nft.name}
                  className={styles.nftImage}
                />
              ) : (
                <div className={styles.nftImagePlaceholder}>
                  <svg className={styles.placeholderIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className={styles.nftInfo}>
              <h3 className={styles.nftName}>{nft.name}</h3>
              <p className={styles.nftDescription}>{nft.description}</p>
              <div className={styles.nftDetails}>
                <span>Token ID: {nft.tokenId}</span>
                <span>Serial: #{nft.serialNumber}</span>
              </div>
            </div>
          </div>

          {/* Price */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Price (HBAR)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter price in HBAR"
              className={styles.numberInput}
              required
            />
            <div className={styles.inputHint}>
              Minimum price: 0.01 HBAR
            </div>
          </div>

          {/* Duration */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Listing Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={styles.selectInput}
            >
              <option value="86400">1 Day</option>
              <option value="259200">3 Days</option>
              <option value="604800">7 Days</option>
              <option value="1209600">14 Days</option>
              <option value="2592000">30 Days</option>
            </select>
            <div className={styles.inputHint}>
              Your {listingType === 'auction' ? 'auction' : 'listing'} will be active for {formatDuration(parseInt(duration))}
            </div>
          </div>

          {/* Royalty Settings */}
          <div className={styles.formSection}>
            <h4 className={styles.sectionTitle}>Royalty Settings</h4>
            <p className={styles.sectionDescription}>
              Set royalties for future sales of this NFT
            </p>
            
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Royalty Percentage</label>
                <select
                  value={royaltyPercentage}
                  onChange={(e) => setRoyaltyPercentage(e.target.value)}
                  className={styles.selectInput}
                >
                  <option value="0">0% (No Royalties)</option>
                  <option value="250">2.5%</option>
                  <option value="500">5%</option>
                  <option value="750">7.5%</option>
                  <option value="1000">10%</option>
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Royalty Recipient</label>
                <input
                  type="text"
                  value={royaltyRecipient}
                  onChange={(e) => setRoyaltyRecipient(e.target.value)}
                  placeholder="0.0.123456 (leave empty for your account)"
                  className={styles.textInput}
                />
              </div>
            </div>
            
            <div className={styles.inputHint}>
              Royalties are paid to the recipient on each future sale
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className={styles.feeBreakdown}>
            <h4 className={styles.sectionTitle}>Fee Breakdown</h4>
            <div className={styles.feeRow}>
              <span>Platform Fee (2.5%)</span>
              <span>{price ? (parseFloat(price) * 0.025).toFixed(2) : '0.00'} HBAR</span>
            </div>
            <div className={styles.feeRow}>
              <span>Royalty Fee ({(parseInt(royaltyPercentage) / 100).toFixed(1)}%)</span>
              <span>{price ? (parseFloat(price) * parseInt(royaltyPercentage) / 10000).toFixed(2) : '0.00'} HBAR</span>
            </div>
            <div className={styles.feeRow + ' ' + styles.totalRow}>
              <span><strong>You'll Receive</strong></span>
              <span><strong>
                {price ? (parseFloat(price) * (1 - 0.025 - parseInt(royaltyPercentage) / 10000)).toFixed(2) : '0.00'} HBAR
              </strong></span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className={styles.errorMessage}>
              <svg className={styles.errorIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

              {/* Actions */}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={handleClose}
                  className={styles.cancelButton}
                  disabled={isListing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isListing || !price}
                  className={styles.listButton}
                >
                  {isListing ? (
                    <>
                      <div className={styles.loadingSpinner}></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      List NFT for Sale
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListNFTModal;
