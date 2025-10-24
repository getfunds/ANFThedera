'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../context/WalletContext';
import { decryptPrompt } from '../../utils/aiImageGeneration';
import { getAccountNFTs, processNFTData, filterRealNFTs } from '../../utils/nftUtils';
import ListNFTModal from '../../components/ListNFTModal';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

const MyNFTsPage = () => {
  const { isConnected, accountId } = useWallet();
  const [myNfts, setMyNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNft, setSelectedNft] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [decryptedPrompt, setDecryptedPrompt] = useState('');
  const [filter, setFilter] = useState('all'); // all, created, owned
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isConnected || !accountId) return;

    const loadUserNfts = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('🔍 Fetching NFTs for account:', accountId);
        
        // Fetch NFTs from Hedera Mirror Node
        const rawNfts = await getAccountNFTs(accountId);
        console.log('📦 Raw NFTs from Mirror Node:', rawNfts);
        
        // Process NFT data and fetch metadata
        const processedNfts = await processNFTData(rawNfts, accountId);
        console.log('✅ Processed NFTs:', processedNfts);
        
        // Filter out mock/test NFTs - only show real NFTs
        const realNfts = filterRealNFTs(processedNfts);
        console.log('🎯 Real NFTs (filtered):', realNfts);
        
        setMyNfts(realNfts);
        
        if (realNfts.length === 0) {
          console.log('ℹ️ No real NFTs found for this account');
        }
        
      } catch (error) {
        console.error('❌ Error loading NFTs:', error);
        setError(error.message);
        setMyNfts([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserNfts();
  }, [isConnected, accountId]);

  const filteredNfts = myNfts.filter(nft => {
    if (filter === 'created') return nft.creator === accountId;
    if (filter === 'owned') return nft.owner === accountId && nft.creator !== accountId;
    return true; // Show all real NFTs by default
  });

  const handleViewPrompt = async (nft) => {
    try {
      // Only NFT owners can access the prompt
      if (nft.owner !== accountId) {
        alert('Only the NFT owner can access the original prompt');
        return;
      }

      const prompt = decryptPrompt(nft.encryptedPrompt, accountId);
      setDecryptedPrompt(prompt);
      setShowPrompt(true);
    } catch (error) {
      console.error('Error decrypting prompt:', error);
      alert('Failed to decrypt prompt. You may not be the owner of this NFT.');
    }
  };

  const openHashScan = (nft) => {
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const url = `https://hashscan.io/${network}/token/${nft.tokenId}`;
    window.open(url, '_blank');
  };

  const handleListForSale = (nft) => {
    setSelectedNft(nft);
    setShowListModal(true);
  };

  const handleListingSuccess = (result) => {
    console.log('✅ NFT listed successfully:', result);
    alert(`🎉 Successfully listed ${selectedNft.name} for sale!`);
    
    // Refresh NFTs to show updated status
    // In production, you might update the local state instead
    window.location.reload();
  };

  const formatAccountId = (id) => {
    return `${id.slice(0, 8)}...${id.slice(-6)}`;
  };


  if (!isConnected) {
    return (
      <div className={styles.container}>
        <div className={styles.walletWarning}>
          <div className={styles.walletIcon}>
            <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className={styles.walletTitle}>Connect Your Wallet</h2>
          <p className={styles.walletDescription}>
            Please connect your Hedera wallet to view your NFT collection.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p className={styles.loadingText}>Loading your NFT collection from Hedera network...</p>
          <p className={styles.loadingSubtext}>This may take a few moments</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>
            <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className={styles.errorTitle}>Failed to Load NFTs</h2>
          <p className={styles.errorMessage}>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className={styles.retryButton}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          My <span className={styles.gradientText}>NFT Collection</span>
        </h1>
        <p className={styles.subtitle}>
          Manage your AI-generated NFTs and access exclusive prompts
        </p>
      </div>

      {/* Filters */}
      <div className={styles.filtersCard}>
        <div className={styles.filtersContainer}>
          <div className={styles.filterButtons}>
            <button
              onClick={() => setFilter('all')}
              className={`${styles.filterButton} ${
                filter === 'all' ? styles.filterButtonActive : styles.filterButtonInactive
              }`}
            >
              All ({myNfts.length})
            </button>
            <button
              onClick={() => setFilter('created')}
              className={`${styles.filterButton} ${
                filter === 'created' ? styles.filterButtonActive : styles.filterButtonInactive
              }`}
            >
              Created ({myNfts.filter(nft => nft.creator === accountId).length})
            </button>
            <button
              onClick={() => setFilter('owned')}
              className={`${styles.filterButton} ${
                filter === 'owned' ? styles.filterButtonActive : styles.filterButtonInactive
              }`}
            >
              Owned ({myNfts.filter(nft => nft.owner === accountId && nft.creator !== accountId).length})
            </button>
          </div>

          <div className={styles.connectedAccount}>
            Connected: {formatAccountId(accountId)}
          </div>
        </div>
      </div>

      {/* NFT Grid */}
      {filteredNfts.length === 0 ? (
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className={styles.emptyTitle}>No Real NFTs Found</h3>
          <p className={styles.emptyDescription}>
            {filter === 'all' 
              ? "You don't have any real NFTs yet. Start creating your first AI-generated NFT!"
              : `No real NFTs match the "${filter}" filter.`
            }
          </p>
          <div className={styles.emptyNote}>
            Only showing real NFTs from the Hedera blockchain. Mock/test NFTs are filtered out.
          </div>
          {filter === 'all' && (
            <Link href="/create" className={styles.createButton}>
              Create Your First NFT
            </Link>
          )}
        </div>
      ) : (
        <div className={styles.nftGrid}>
          {filteredNfts.map((nft) => (
            <div key={nft.id} className={styles.nftCard}>
              <div className={styles.nftImageContainer}>
                {nft.image && !nft.image.includes('/placeholder-nft.svg') ? (
                  <>
                    <Image
                      src={nft.image}
                      alt={nft.name}
                      fill
                      className={styles.nftImage}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const parent = e.target.parentElement;
                        if (parent) {
                          const placeholder = document.createElement('div');
                          placeholder.className = styles.nftImagePlaceholder;
                          placeholder.style.cssText = 'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--neutral-100), var(--neutral-200));';
                          placeholder.innerHTML = `
                            <div style="text-align: center;">
                              <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto 0.5rem; color: var(--neutral-400);">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p style="font-size: 0.875rem; color: var(--neutral-500); font-weight: 500;">No Image</p>
                            </div>
                          `;
                          parent.appendChild(placeholder);
                        }
                      }}
                    />
                  </>
                ) : (
                  <div className={styles.nftImagePlaceholder}>
                    <div className={styles.nftImagePlaceholderContent}>
                      <svg className={styles.nftImagePlaceholderIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className={styles.nftImagePlaceholderText}>No Image</p>
                    </div>
                  </div>
                )}
                <div className={`${styles.statusBadge} ${styles.statusBadgeSuccess} ${styles.statusBadgeLeft}`}>
                  Real NFT
                </div>
                <div className={`${styles.statusBadge} ${styles.statusBadgeInfo} ${styles.statusBadgeRight}`}>
                  #{nft.serialNumber}
                </div>
              </div>
              
              <div className={styles.nftContent}>
                <h3 className={styles.nftTitle}>{nft.name}</h3>
                <p className={styles.nftDescription}>
                  {nft.description}
                </p>
                
                <div className={styles.nftDetails}>
                  <div className={styles.detailRow}>
                    <span>Token ID:</span>
                    <span className={styles.detailValue}>{nft.tokenId}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Created:</span>
                    <span>{new Date(nft.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {nft.attributes && nft.attributes.length > 0 && (
                  <div className={styles.attributesSection}>
                    <p className={styles.attributesLabel}>Attributes</p>
                    <div className={styles.attributesContainer}>
                      {nft.attributes
                        .filter(attr => typeof attr.value !== 'object')
                        .slice(0, 3)
                        .map((attr, index) => (
                          <span key={index} className={styles.attributeBadge}>
                            {attr.trait_type}: {attr.value}
                          </span>
                        ))}
                      {nft.attributes.filter(attr => typeof attr.value !== 'object').length > 3 && (
                        <span className={styles.attributeBadgeMore}>
                          +{nft.attributes.filter(attr => typeof attr.value !== 'object').length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className={styles.nftActions}>
                  <button
                    onClick={() => handleListForSale(nft)}
                    className={styles.actionButtonPrimary}
                  >
                    <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    List for Sale
                  </button>
                  
                  <button
                    onClick={() => openHashScan(nft)}
                    className={styles.actionButtonSecondary}
                  >
                    <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    HashScan
                  </button>
                  
                  <button
                    onClick={() => {
                      setSelectedNft(nft);
                      setShowModal(true);
                    }}
                    className={styles.actionButtonSecondary}
                  >
                    <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NFT Management Modal */}
      {showModal && selectedNft && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalBody}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Manage NFT</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className={styles.closeButton}
                >
                  <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className={styles.modalGrid}>
                <div>
                  <div className={styles.modalImageContainer}>
                    <Image
                      src={selectedNft.image}
                      alt={selectedNft.name}
                      fill
                      className={styles.modalImage}
                    />
                  </div>
                </div>

                <div className={styles.modalInfo}>
                  <div className={styles.modalNftInfo}>
                    <h3 className={styles.modalNftTitle}>{selectedNft.name}</h3>
                    <p className={styles.modalNftDescription}>{selectedNft.description}</p>
                  </div>

                  <div className={styles.modalDetails}>
                    <div className={styles.modalDetailRow}>
                      <span>Token ID:</span>
                      <span className={styles.modalDetailValue}>{selectedNft.tokenId}</span>
                    </div>
                    <div className={styles.modalDetailRow}>
                      <span>Serial Number:</span>
                      <span className={styles.modalDetailValue}>#{selectedNft.serialNumber}</span>
                    </div>
                    <div className={styles.modalDetailRow}>
                      <span>Status:</span>
                      <span className={styles.modalStatusReal}>Real NFT</span>
                    </div>
                    {selectedNft.createdAt && (
                      <div className={styles.modalDetailRow}>
                        <span>Created:</span>
                        <span>{new Date(selectedNft.createdAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {selectedNft.attributes && selectedNft.attributes.length > 0 && (
                    <div className={styles.modalAttributesSection}>
                      <h4 className={styles.modalAttributesTitle}>Attributes</h4>
                      <div className={styles.modalAttributesList}>
                        {selectedNft.attributes
                          .filter(attr => typeof attr.value !== 'object')
                          .map((attr, index) => (
                            <div key={index} className={styles.modalAttributeRow}>
                              <span className={styles.modalAttributeName}>{attr.trait_type}:</span>
                              <span className={styles.modalAttributeValue}>{attr.value}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className={styles.modalActions}>
                    <button
                      onClick={() => openHashScan(selectedNft)}
                      className={styles.modalButtonSecondary}
                    >
                      <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View on HashScan
                    </button>

                    {selectedNft.encryptedPrompt && (
                      <button
                        onClick={() => handleViewPrompt(selectedNft)}
                        className={styles.modalButtonPrimary}
                      >
                        <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View Original Prompt
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Display Modal */}
      {showPrompt && (
        <div className={styles.promptModal}>
          <div className={styles.promptModalContent}>
            <div className={styles.modalBody}>
              <div className={styles.modalHeader}>
                <h3 className={styles.promptModalTitle}>Original AI Prompt</h3>
                <button
                  onClick={() => setShowPrompt(false)}
                  className={styles.closeButton}
                >
                  <svg className={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className={styles.promptText}>
                <p className={styles.promptContent}>"{decryptedPrompt}"</p>
              </div>
              
              <div className={styles.promptNote}>
                <svg className={styles.promptNoteIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Only NFT owners can access this prompt
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(decryptedPrompt);
                  alert('Prompt copied to clipboard!');
                }}
                className={styles.promptCopyButton}
              >
                <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List NFT Modal */}
      <ListNFTModal
        nft={selectedNft}
        isOpen={showListModal}
        onClose={() => setShowListModal(false)}
        onSuccess={handleListingSuccess}
      />
    </div>
  );
};

export default MyNFTsPage;
