'use client';

import { useState } from 'react';
import styles from './DIDRegistrationModal.module.css';

/**
 * DID Registration Modal Component
 * 
 * Guides users through the DID creation process when they don't have one
 * Shows progress, explains benefits, and handles the registration flow
 */
export default function DIDRegistrationModal({ 
  isOpen, 
  onClose, 
  onRegister, 
  accountId,
  isRegistering = false 
}) {
  const [step, setStep] = useState(1);
  const [creatorName, setCreatorName] = useState('');
  const [creatorBio, setCreatorBio] = useState('');

  if (!isOpen) return null;

  const handleRegister = async () => {
    await onRegister({
      name: creatorName,
      bio: creatorBio,
      platform: 'ANFT'
    });
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className={styles.stepContent}>
            <div className={styles.iconWrapper}>
              <svg width="80" height="80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className={styles.stepTitle}>Decentralized Identity Required</h3>
            <p className={styles.stepDescription}>
              To mint NFTs on ANFT, you need a Decentralized Identity (DID). This ensures:
            </p>
            <div className={styles.benefitsList}>
              <div className={styles.benefit}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><strong>Verified Creator Identity:</strong> Your artwork is linked to your verified on-chain identity</span>
              </div>
              <div className={styles.benefit}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><strong>Immutable Attestations:</strong> Each NFT includes proof of authenticity on Hedera</span>
              </div>
              <div className={styles.benefit}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><strong>Trust & Transparency:</strong> Buyers can verify artwork provenance</span>
              </div>
              <div className={styles.benefit}>
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><strong>Cross-Platform Portable:</strong> Your DID works across the entire Hedera ecosystem</span>
              </div>
            </div>
            <div className={styles.infoBox}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>Your DID is created once and stored on Hedera&apos;s secure network. You&apos;ll sign the creation with your Blade Wallet.</p>
            </div>
            <div className={styles.buttonGroup}>
              <button onClick={onClose} className={styles.secondaryButton}>
                Cancel
              </button>
              <button onClick={() => setStep(2)} className={styles.primaryButton}>
                Continue
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className={styles.stepContent}>
            <div className={styles.iconWrapper}>
              <svg width="80" height="80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className={styles.stepTitle}>Creator Profile</h3>
            <p className={styles.stepDescription}>
              Add optional information to your DID. This helps collectors learn more about you.
            </p>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Creator Name <span className={styles.optional}>(optional)</span>
              </label>
              <input
                type="text"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                placeholder="Your name or pseudonym"
                className={styles.input}
                maxLength={50}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Bio <span className={styles.optional}>(optional)</span>
              </label>
              <textarea
                value={creatorBio}
                onChange={(e) => setCreatorBio(e.target.value)}
                placeholder="Tell collectors about yourself and your art..."
                className={styles.textarea}
                rows={4}
                maxLength={500}
              />
              <div className={styles.charCount}>{creatorBio.length}/500</div>
            </div>
            <div className={styles.accountInfo}>
              <div className={styles.accountLabel}>Connected Account:</div>
              <div className={styles.accountId}>{accountId}</div>
            </div>
            <div className={styles.buttonGroup}>
              <button onClick={() => setStep(1)} className={styles.secondaryButton}>
                Back
              </button>
              <button onClick={() => setStep(3)} className={styles.primaryButton}>
                Continue
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className={styles.stepContent}>
            <div className={styles.iconWrapper}>
              <svg width="80" height="80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className={styles.stepTitle}>Create Your DID</h3>
            <p className={styles.stepDescription}>
              Click below to create your Decentralized Identity. You&apos;ll be prompted to sign with your Blade Wallet.
            </p>
            
            <div className={styles.reviewBox}>
              <div className={styles.reviewTitle}>Review Information:</div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>Account:</span>
                <span className={styles.reviewValue}>{accountId}</span>
              </div>
              {creatorName && (
                <div className={styles.reviewItem}>
                  <span className={styles.reviewLabel}>Name:</span>
                  <span className={styles.reviewValue}>{creatorName}</span>
                </div>
              )}
              {creatorBio && (
                <div className={styles.reviewItem}>
                  <span className={styles.reviewLabel}>Bio:</span>
                  <span className={styles.reviewValue}>{creatorBio}</span>
                </div>
              )}
            </div>

            {!isRegistering ? (
              <>
                <div className={styles.processInfo}>
                  <h4>What happens next:</h4>
                  <ol>
                    <li>Your DID keys are generated locally</li>
                    <li>A DID topic is created on Hedera Consensus Service</li>
                    <li>Your DID Document is uploaded to Hedera File Service</li>
                    <li>You sign the transaction with your Blade Wallet</li>
                  </ol>
                </div>

                <div className={styles.warningBox}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p>This action requires a small HBAR transaction fee (typically less than $0.01)</p>
                </div>
              </>
            ) : (
              <div className={styles.progressBox}>
                <div className={styles.progressBoxTitle}>
                  <div className={styles.spinner}></div>
                  <span>Creating Your Decentralized Identity...</span>
                </div>
                <div className={styles.progressSteps}>
                  <div className={styles.progressItem}>
                    <div className={styles.progressDot}></div>
                    <span>Generating DID keys locally</span>
                  </div>
                  <div className={styles.progressItem}>
                    <div className={styles.progressDot}></div>
                    <span>Creating DID topic on Hedera Consensus Service</span>
                  </div>
                  <div className={styles.progressItem}>
                    <div className={styles.progressDot}></div>
                    <span>Uploading DID Document to Hedera File Service</span>
                  </div>
                  <div className={styles.progressItem}>
                    <div className={styles.progressDot}></div>
                    <span>Waiting for your signature via Blade Wallet</span>
                  </div>
                </div>
                <div className={styles.progressNote}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>Please check your Blade Wallet extension for signature requests. Do not close this window.</p>
                </div>
              </div>
            )}

            <div className={styles.buttonGroup}>
              <button onClick={() => setStep(2)} className={styles.secondaryButton} disabled={isRegistering}>
                Back
              </button>
              <button onClick={handleRegister} className={styles.createButton} disabled={isRegistering}>
                {isRegistering ? (
                  <>
                    <div className={styles.spinner}></div>
                    Creating DID...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Create DID
                  </>
                )}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={isRegistering ? undefined : onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button 
          className={styles.closeButton} 
          onClick={onClose}
          disabled={isRegistering}
          aria-label="Close"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className={styles.progressSteps}>
          <div className={`${styles.progressStep} ${step >= 1 ? styles.active : ''}`}>
            <div className={styles.stepCircle}>1</div>
            <span>Learn</span>
          </div>
          <div className={styles.progressLine}></div>
          <div className={`${styles.progressStep} ${step >= 2 ? styles.active : ''}`}>
            <div className={styles.stepCircle}>2</div>
            <span>Profile</span>
          </div>
          <div className={styles.progressLine}></div>
          <div className={`${styles.progressStep} ${step >= 3 ? styles.active : ''}`}>
            <div className={styles.stepCircle}>3</div>
            <span>Create</span>
          </div>
        </div>

        {renderStepContent()}
      </div>
    </div>
  );
}

