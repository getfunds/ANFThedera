/**
 * Digital Painting Page
 * Main page for the digital painting studio
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DigitalPaintingStudioModern from '../../components/DigitalPaintingStudioModern';
import ListNFTModal from '../../components/ListNFTModal';
import { useWallet } from '../../context/WalletContext';
import { useDID } from '../../hooks/useDID';
import DIDRegistrationModal from '../../components/DIDRegistrationModal';
import { finalizeArtwork } from '../../utils/artworkFinalization';
import { createAttestation } from '../../utils/attestation';
import styles from './paint.module.css';

const PaintPage = () => {
  const router = useRouter();
  const { isConnected, accountId } = useWallet();
  
  // DID Management
  const {
    didInfo,
    showDIDModal,
    isLoadingDID,
    ensureDIDBeforeMint,
    completeDIDRegistration,
    cancelDIDRegistration
  } = useDID(accountId);
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedImage, setExportedImage] = useState(null);
  const [mintedNFT, setMintedNFT] = useState(null);
  const [showListNFTModal, setShowListNFTModal] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [nftName, setNftName] = useState('');
  const [nftDescription, setNftDescription] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  
  // Minting progress tracking
  const [mintingStep, setMintingStep] = useState('');
  const [mintingProgress, setMintingProgress] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [mintResult, setMintResult] = useState(null);

  // Handle NFT minting from painting studio (directly called from Mint NFT button)
  const handleMintFromStudio = useCallback((imageData) => {
    console.log('🎨 Mint NFT clicked from studio');
    
    if (!isConnected) {
      alert('Please connect your wallet first');
      router.push('/wallet');
      return;
    }
    
    // Set the exported image data
    setExportedImage({ dataURL: imageData, format: 'png' });
    
    // Generate default values
    const defaultName = `Digital Painting ${new Date().toLocaleDateString()}`;
    const defaultDescription = 'Original digital artwork created with ANFT Digital Painting Studio';
    
    console.log('✅ Opening mint modal with image data');
    setNftName(defaultName);
    setNftDescription(defaultDescription);
    setShowMintModal(true);
  }, [isConnected, router]);

  // Handle artwork export from painting studio (for download functionality)
  const handleExport = useCallback((dataURL, format) => {
    console.log('🎨 Artwork exported:', { format, size: dataURL.length });
    setExportedImage({ dataURL, format });
    setShowExportModal(true);
  }, []);

  // Handle artwork save (for later editing)
  const handleSave = useCallback((paintingData) => {
    console.log('💾 Artwork saved:', paintingData);
    // TODO: Implement save to local storage or backend
    localStorage.setItem(`painting_${Date.now()}`, JSON.stringify(paintingData));
  }, []);


  const addProgressStep = (step, status = 'processing') => {
    setMintingProgress(prev => [...prev, { step, status, timestamp: new Date() }]);
  };

  const updateProgressStep = (step, status, details = null) => {
    setMintingProgress(prev => 
      prev.map(p => p.step === step ? { ...p, status, details, timestamp: new Date() } : p)
    );
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setMintResult(null);
    setMintingProgress([]);
    setShowMintModal(false);
  };

  // Convert Mirror Node transaction ID format back to standard format
  const convertToStandardTxId = (mirrorTxId) => {
    // Convert from: 0.0.4475114-1758668160-250986456
    // To: 0.0.4475114@1758668160.250986456
    if (!mirrorTxId || !mirrorTxId.includes('-')) return mirrorTxId;
    
    const parts = mirrorTxId.split('-');
    if (parts.length !== 3) return mirrorTxId;
    
    return `${parts[0]}@${parts[1]}.${parts[2]}`;
  };

  // Actual minting process with DID + Content Hash + Attestation (same as AI NFT)
  const executeMinting = useCallback(async () => {
    if (!exportedImage || !nftName.trim()) {
      alert('Please provide an NFT name');
      return;
    }
    
    try {
      setIsMinting(true);
      setMintingProgress([]);
      setMintingStep('Initializing minting process...');
      
      console.log('🎨 Starting digital painting NFT minting process...');
      
      // ========================================
      // STEP 1: Verify/Create Creator DID
      // ========================================
      console.log('🔐 STEP 1: Verifying Creator DID...');
      setMintingStep('Step 1/4: Verifying your creator identity');
      addProgressStep('DID Verification', 'processing');
      
      const userDID = await ensureDIDBeforeMint();
      
      if (!userDID) {
        setIsMinting(false);
        setMintingProgress([]);
        return; // Modal will show, user will create DID
      }
      
      updateProgressStep('DID Verification', 'completed', {
        did: userDID.did,
        topicId: userDID.topicId,
        message: userDID.topicId ? 'Existing DID found and verified' : 'New DID created successfully'
      });
      console.log('✅ Creator DID verified:', userDID.did);
      
      // Convert data URL to blob
      const response = await fetch(exportedImage.dataURL);
      const blob = await response.blob();
      
      // ========================================
      // STEP 2: Finalize Artwork (Content Hash + IPFS Upload)
      // ========================================
      console.log('🎨 STEP 2: Finalizing Artwork...');
      setMintingStep('Step 2/4: Preparing your artwork');
      addProgressStep('Content Hashing', 'processing');
      
      const { finalizePaintedArtwork } = await import('../../utils/artworkFinalization');
      
      const finalizedArtwork = await finalizePaintedArtwork(
        blob,
        {
          name: nftName,
          description: nftDescription,
          creator: accountId,
          creator_did: userDID.did,
          attributes: [
            {
              trait_type: "Creation Date",
              value: new Date().toISOString()
            },
            {
              trait_type: "Creation Method",
              value: "Digital Painting"
            },
            {
              trait_type: "Studio",
              value: "ANFT Digital Painting Studio"
            }
          ]
        }
      );
      
      updateProgressStep('Content Hashing', 'completed', {
        contentHash: finalizedArtwork.contentHash,
        imageCID: finalizedArtwork.imageCID,
        metadataCID: finalizedArtwork.metadataCID,
        message: 'Content hash computed and uploaded to IPFS'
      });
      console.log('✅ Artwork finalized:', {
        contentHash: finalizedArtwork.contentHash,
        imageCID: finalizedArtwork.imageCID,
        metadataCID: finalizedArtwork.metadataCID
      });

      // ========================================
      // STEP 3: Create On-Chain Attestation
      // ========================================
      console.log('📝 STEP 3: Creating On-Chain Attestation...');
      setMintingStep('Step 3/4: Creating on-chain attestation');
      addProgressStep('Attestation', 'processing');
      setMintingStep('⏳ Please sign the attestation transaction in your Blade Wallet');
      
      const { createAttestation } = await import('../../utils/attestation');
      
      const attestation = await createAttestation(
        userDID.did,
        finalizedArtwork.contentHash,
        {
          nftName: nftName,
          nftDescription: nftDescription,
          creatorAccountId: accountId,
          imageHash: finalizedArtwork.imageHash,
          metadataHash: finalizedArtwork.metadataHash,
          imageCID: finalizedArtwork.imageCID,
          metadataCID: finalizedArtwork.metadataCID,
          creationMethod: 'Digital Painting'
        }
      );
      
      updateProgressStep('Attestation', 'completed', {
        transactionId: attestation.attestationTx,
        topicId: attestation.topicId,
        sequenceNumber: attestation.sequenceNumber,
        message: 'Immutable attestation recorded on Hedera'
      });
      console.log('✅ Attestation created');
      console.log('   🔗 Transaction ID:', attestation.attestationTx);
      console.log('   📋 Topic ID:', attestation.topicId);
      console.log('   🔢 Sequence #:', attestation.sequenceNumber);

      // ========================================
      // STEP 4: Mint NFT with Complete Metadata
      // ========================================
      console.log('🪙 STEP 4: Minting NFT...');
      setMintingStep('Step 4/4: Minting your NFT on Hedera');
      addProgressStep('NFT Minting', 'processing');
      
      // Create NFT metadata with DID, content hash, and attestation
      const nftMetadata = {
        name: nftName,
        description: nftDescription,
        image: finalizedArtwork.imageUrl,
        external_url: finalizedArtwork.metadataUrl,
        creator: accountId,
        created_at: new Date().toISOString(),
        
        // DID Information
        creator_did: userDID.did,
        did_topic_id: userDID.topicId,
        did_file_id: userDID.fileId,
        
        // Content Hashes
        content_hash: finalizedArtwork.contentHash,
        image_hash: finalizedArtwork.imageHash,
        metadata_hash: finalizedArtwork.metadataHash,
        
        // IPFS Information
        image_ipfs_cid: finalizedArtwork.imageCID,
        metadata_ipfs_cid: finalizedArtwork.metadataCID,
        
        // Attestation Information
        attestation_tx: attestation.attestationTx,
        attestation_topic_id: attestation.topicId,
        attestation_sequence: attestation.sequenceNumber,
        attestation_hash: attestation.attestationHash,
        attestation_timestamp: attestation.timestamp,
        
        // Enhanced attributes
        attributes: [
          ...finalizedArtwork.metadata.attributes,
          {
            trait_type: 'Creator DID',
            value: userDID.did
          },
          {
            trait_type: 'Image Hash',
            value: finalizedArtwork.imageHash
          },
          {
            trait_type: 'Content Hash',
            value: finalizedArtwork.contentHash
          },
          {
            trait_type: 'Metadata Hash',
            value: finalizedArtwork.metadataHash
          },
          {
            trait_type: 'Attestation TX',
            value: convertToStandardTxId(attestation.attestationTx)
          }
        ]
      };
      
      // Use Blade Wallet for NFT minting
      console.log('🔄 Using Blade Wallet for NFT minting...');
      setMintingStep('⏳ Please sign to create NFT collection in your Blade Wallet');
      
      const { getBladeWalletSigner, mintNFTWorkflowWithBlade } = await import('../../utils/bladeWalletNFTMinting');
      
      const { bladeSigner, accountId: bladeAccountId } = await getBladeWalletSigner();
      
      console.log('✅ Blade Wallet signer obtained:', bladeAccountId);
      console.log('📤 Starting Blade Wallet NFT minting workflow...');
      
      updateProgressStep('NFT Minting', 'processing', {
        message: 'Creating NFT collection (please sign in wallet)...'
      });
      
      // Mint with Blade Wallet
      const bladeResult = await mintNFTWorkflowWithBlade(bladeSigner, bladeAccountId, nftMetadata, {
        collectionName: `Digital Art Collection ${Date.now()}`,
        collectionSymbol: 'DIGART',
        maxSupply: 1,
        memo: `ANFT:${finalizedArtwork.contentHash.substring(0, 16)}`
      }, (status) => {
        // Progress callback from minting workflow
        setMintingStep(status);
      });
      
      const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
      const nftUrl = `https://hashscan.io/${network}/token/${bladeResult.mint.tokenId}`;
      const attestationUrl = `https://hashscan.io/${network}/topic/${attestation.topicId}`;
      
      updateProgressStep('NFT Minting', 'completed', {
        tokenId: bladeResult.mint.tokenId,
        serialNumber: bladeResult.mint.serialNumber,
        transactionId: bladeResult.mint.transactionId,
        message: 'NFT minted successfully with complete provenance'
      });
      
      console.log('✅ NFT minted successfully!');
      console.log('🎉 Complete minting result:', {
        tokenId: bladeResult.mint.tokenId,
        serialNumber: bladeResult.mint.serialNumber,
        did: userDID.did,
        contentHash: finalizedArtwork.contentHash,
        imageHash: finalizedArtwork.imageHash,
        metadataHash: finalizedArtwork.metadataHash,
        attestation: attestation.attestationTx,
        attestationTopicId: attestation.topicId,
        attestationSequence: attestation.sequenceNumber
      });
      
      // Store minted NFT data and show success modal
      const successResult = {
        tokenId: bladeResult.mint.tokenId,
        serialNumber: bladeResult.mint.serialNumber,
        transactionId: bladeResult.mint.transactionId,
        contentHash: finalizedArtwork.contentHash,
        attestationTx: attestation.attestationTx,
        attestationTopicId: attestation.topicId,
        nftUrl: nftUrl,
        attestationUrl: attestationUrl,
        creatorDID: userDID.did,
        imageCID: finalizedArtwork.imageCID,
        metadataCID: finalizedArtwork.metadataCID,
        name: nftName,
        description: nftDescription,
        image: finalizedArtwork.imageUrl,
        metadata: nftMetadata,
        hashscanUrl: bladeResult.hashscanUrl
      };
      
      setMintedNFT(successResult);
      setMintResult(successResult);
      
      // Close mint modal and show success
      setIsMinting(false);
      setShowMintModal(false);
      setShowSuccessModal(true);
      setMintingStep('');
      
    } catch (error) {
      console.error('❌ Digital painting NFT minting failed:', error);
      alert(`❌ Failed to mint NFT: ${error.message}\n\nPlease try again or check your wallet connection.`);
    } finally {
      if (!mintResult) {
        setIsMinting(false);
        setMintingStep('');
        setMintingProgress([]);
      }
    }
  }, [exportedImage, accountId, router, nftName, nftDescription, ensureDIDBeforeMint, mintResult]);

  // Download the artwork
  const handleDownload = useCallback(() => {
    if (!exportedImage) return;
    
    const link = document.createElement('a');
    link.download = `digital_painting_${Date.now()}.${exportedImage.format}`;
    link.href = exportedImage.dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [exportedImage]);

  // Handle marketplace listing
  const handleListForSale = useCallback(async (price, duration) => {
    if (!mintedNFT) return;
    
    try {
      console.log('🏪 Listing digital painting NFT for sale...', {
        tokenId: mintedNFT.tokenId,
        serialNumber: mintedNFT.serialNumber,
        price,
        duration
      });
      
      // Use the same marketplace listing system as other NFTs
      const { createMarketplaceListing } = await import('../../utils/marketplace');
      const { getBladeWalletSigner } = await import('../../utils/bladeWalletNFTMinting');
      
      // Get wallet signer
      const { bladeSigner, accountId: bladeAccountId } = await getBladeWalletSigner();
      
      // Create marketplace listing
      const listingResult = await createMarketplaceListing({
        tokenAddress: mintedNFT.tokenId.split('-')[0], // Extract token address
        tokenId: mintedNFT.serialNumber,
        price: price,
        duration: parseInt(duration),
        isAuction: false,
        royaltyPercentage: 500, // 5% royalty
        royaltyRecipient: bladeAccountId
      }, bladeSigner, bladeAccountId);
      
      console.log('✅ Marketplace listing successful:', listingResult);
      
      alert(`🎉 Digital Painting Listed Successfully!\n\n🎨 ${mintedNFT.name}\n💰 Price: ${price} HBAR\n⏰ Duration: ${duration / 86400} days\n\n✅ Your painting is now available in the marketplace!`);
      
      // Close listing modal and redirect to marketplace
      setShowListNFTModal(false);
      setTimeout(() => {
        router.push('/marketplace');
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error listing NFT for sale:', error);
      alert(`❌ Failed to list NFT: ${error.message}\n\nPlease ensure your NFT is approved for the marketplace.`);
    }
  }, [mintedNFT, router]);

  return (
    <div className={styles.paintPage}>
      {/* Painting Studio */}
      <main className={styles.main}>
        <DigitalPaintingStudioModern 
          onMintNFT={handleMintFromStudio}
          onListForSale={handleListForSale}
        />
      </main>

      {/* Export Modal */}
      {showExportModal && exportedImage && (
        <div className={styles.modalOverlay}>
          <div className={styles.exportModal}>
            <div className={styles.modalHeader}>
              <h2>🎨 Artwork Ready!</h2>
              <button 
                onClick={() => setShowExportModal(false)}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.previewContainer}>
                <img 
                  src={exportedImage.dataURL} 
                  alt="Exported artwork"
                  className={styles.artworkPreview}
                />
              </div>
              
              <div className={styles.exportInfo}>
                <p><strong>Format:</strong> {exportedImage.format.toUpperCase()}</p>
                <p><strong>Created:</strong> {new Date().toLocaleString()}</p>
                <p><strong>Size:</strong> {Math.round(exportedImage.dataURL.length / 1024)} KB</p>
              </div>
              
              <div className={styles.exportActions}>
                <button 
                  onClick={handleDownload}
                  className={styles.downloadButton}
                >
                  📥 Download Image
                </button>
              </div>
              
              <div className={styles.modalFooter}>
                <p className={styles.footerText}>
                  💡 <strong>Tip:</strong> Use the &quot;🎨 Mint NFT&quot; button in the top toolbar to mint your artwork as an NFT on Hedera blockchain!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mint NFT Modal (like AI NFT flow) */}
      {showMintModal && exportedImage && (
        <div className={styles.modalOverlay}>
          <div className={styles.mintModal}>
            <div className={styles.modalHeader}>
              <h2>🪙 Mint Your Digital Painting as NFT</h2>
              <button 
                onClick={() => setShowMintModal(false)}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.previewContainer}>
                <img 
                  src={exportedImage.dataURL} 
                  alt="Painting preview"
                  className={styles.artworkPreview}
                />
              </div>
              
              <div className={styles.inputGroup}>
                <label htmlFor="nftName">NFT Name / Title *</label>
                <input
                  id="nftName"
                  type="text"
                  value={nftName}
                  onChange={(e) => setNftName(e.target.value)}
                  placeholder="Enter NFT name..."
                  className={styles.inputField}
                  maxLength={100}
                />
              </div>
              
              <div className={styles.inputGroup}>
                <label htmlFor="nftDescription">Description</label>
                <textarea
                  id="nftDescription"
                  value={nftDescription}
                  onChange={(e) => setNftDescription(e.target.value)}
                  placeholder="Describe your digital painting..."
                  className={styles.textareaField}
                  rows={4}
                  maxLength={500}
                />
              </div>
              
              <div className={styles.mintInfo}>
                <p>🎨 <strong>Artwork Type:</strong> Digital Painting</p>
                <p>👤 <strong>Creator:</strong> {accountId}</p>
                <p>📅 <strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                <p>💾 <strong>Format:</strong> {exportedImage.format.toUpperCase()}</p>
              </div>
              
              <div className={styles.mintActions}>
                <button 
                  onClick={() => setShowMintModal(false)}
                  className={styles.cancelButton}
                  disabled={isMinting}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeMinting}
                  disabled={isMinting || !nftName.trim()}
                  className={styles.confirmMintButton}
                >
                  {isMinting ? (
                    <>
                      <div className={styles.spinner}></div>
                      Minting...
                    </>
                  ) : (
                    <>
                      🪙 Mint NFT
                    </>
                  )}
                </button>
              </div>

              {/* Minting Progress Display */}
              {isMinting && mintingProgress.length > 0 && (
                <div className={styles.progressContainer}>
                  <div className={styles.progressHeader}>
                    <h3 className={styles.progressTitle}>{mintingStep}</h3>
                  </div>
                  <div className={styles.progressSteps}>
                    {mintingProgress.map((step, index) => (
                      <div key={index} className={`${styles.progressStepItem} ${styles[step.status]}`}>
                        <div className={styles.progressStepIcon}>
                          {step.status === 'completed' && (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          )}
                          {step.status === 'processing' && (
                            <div className={styles.spinner}></div>
                          )}
                        </div>
                        <div className={styles.progressStepContent}>
                          <div className={styles.progressStepName}>{step.step}</div>
                          {step.details && (
                            <div className={styles.progressStepDetails}>
                              <div className={styles.detailMessage}>{step.details.message}</div>
                              {step.details.did && (
                                <div className={styles.detailValue}>DID: {step.details.did.substring(0, 30)}...</div>
                              )}
                              {step.details.contentHash && (
                                <div className={styles.detailValue}>Hash: {step.details.contentHash.substring(0, 20)}...</div>
                              )}
                              {step.details.tokenId && (
                                <div className={styles.detailValue}>Token: {step.details.tokenId}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className={styles.modalFooter}>
                <p className={styles.footerText}>
                  💡 <strong>Note:</strong> Your painting will be uploaded to IPFS and minted as an NFT on Hedera network. This process is permanent and cannot be reversed.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && mintResult && (
        <div className={styles.successModalOverlay} onClick={closeSuccessModal}>
          <div className={styles.successModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.successHeader}>
              <div className={styles.successIcon}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className={styles.successTitle}>Digital Painting Minted! 🎨</h2>
              <p className={styles.successSubtitle}>
                Your artwork is now an authentic, verified NFT on Hedera
              </p>
            </div>

            <div className={styles.successDetails}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Token ID</span>
                <span className={styles.detailValueMono}>{mintResult.tokenId}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Serial Number</span>
                <span className={styles.detailValueMono}>#{mintResult.serialNumber}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Content Hash</span>
                <span className={styles.detailValueMono}>{mintResult.contentHash.substring(0, 20)}...</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Creator DID</span>
                <span className={styles.detailValueMono}>{mintResult.creatorDID.substring(0, 30)}...</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Attestation TX</span>
                <span className={styles.detailValueMono}>{mintResult.attestationTx.substring(0, 20)}...</span>
              </div>
            </div>

            <div className={styles.provenanceChain}>
              <div className={styles.chainTitle}>Immutable Proof Chain</div>
              <div className={styles.chainFlow}>
                <div className={styles.chainStep}>Creator DID</div>
                <div className={styles.chainArrow}>→</div>
                <div className={styles.chainStep}>Content Hash</div>
                <div className={styles.chainArrow}>→</div>
                <div className={styles.chainStep}>Attestation</div>
                <div className={styles.chainArrow}>→</div>
                <div className={styles.chainStep}>NFT</div>
              </div>
            </div>

            <div className={styles.successActions}>
              <a 
                href={mintResult.nftUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.successButton}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                View on HashScan
              </a>
              <button
                onClick={() => {
                  closeSuccessModal();
                  router.push('/my-nfts');
                }}
                className={styles.successButtonSecondary}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                View My NFTs
              </button>
            </div>

            <button onClick={closeSuccessModal} className={styles.closeModalButton}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Listing Modal */}
      {showListNFTModal && mintedNFT && (
        <ListNFTModal 
          nft={mintedNFT}
          onClose={() => setShowListNFTModal(false)}
          onList={handleListForSale}
        />
      )}

      {/* DID Registration Modal */}
      <DIDRegistrationModal
        isOpen={showDIDModal}
        accountId={accountId}
        onRegister={completeDIDRegistration}
        onClose={cancelDIDRegistration}
        isRegistering={isLoadingDID}
      />
    </div>
  );
};

export default PaintPage;
