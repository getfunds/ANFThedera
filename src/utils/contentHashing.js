/**
 * Content Hashing Utility for NFT Attestation
 * 
 * Creates canonical content hashes for artworks by:
 * 1. Hashing the raw image bytes (SHA-256)
 * 2. Normalizing metadata to canonical JSON
 * 3. Combining image hash + metadata into final content hash
 * 
 * This ensures each artwork has a unique, verifiable fingerprint
 */

/**
 * Compute SHA-256 hash of raw bytes (browser-safe)
 * @param {Buffer|Uint8Array|ArrayBuffer} bytes - Raw bytes to hash
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
export async function sha256Hash(bytes) {
  // Convert to Uint8Array if needed
  let data;
  if (bytes instanceof Uint8Array) {
    data = bytes;
  } else if (bytes instanceof ArrayBuffer) {
    data = new Uint8Array(bytes);
  } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(bytes)) {
    data = new Uint8Array(bytes);
  } else {
    data = new Uint8Array(bytes);
  }
  
  // Use Web Crypto API (browser-safe)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hash;
}

/**
 * Normalize metadata to canonical JSON form
 * This ensures consistent hashing regardless of key order or formatting
 * 
 * @param {Object} metadata - NFT metadata object
 * @returns {string} Canonical JSON string
 */
export function canonicalizeMetadata(metadata) {
  // Create a clean copy with only essential fields
  const canonical = {
    name: metadata.name || '',
    description: metadata.description || '',
    // Sort attributes by trait_type for consistency
    attributes: (metadata.attributes || [])
      .map(attr => ({
        trait_type: attr.trait_type || '',
        value: attr.value !== undefined ? attr.value : '',
        ...(attr.display_type && { display_type: attr.display_type })
      }))
      .sort((a, b) => (a.trait_type || '').localeCompare(b.trait_type || '')),
    // Include creator info if present
    ...(metadata.creator && { creator: metadata.creator }),
    ...(metadata.creator_did && { creator_did: metadata.creator_did })
  };

  // Convert to JSON with sorted keys and no whitespace
  return JSON.stringify(canonical, Object.keys(canonical).sort(), 0);
}

/**
 * Compute canonical content hash from image and metadata
 * 
 * Process:
 * 1. imageHash = SHA256(imageBytes)
 * 2. canonicalMetadata = normalize(metadata)
 * 3. contentHash = SHA256(imageHash + canonicalMetadata)
 * 
 * @param {Buffer|Blob} imageBuffer - Raw image bytes
 * @param {Object} metadata - NFT metadata
 * @returns {Promise<Object>} { imageHash, metadataHash, contentHash }
 */
export async function computeContentHash(imageBuffer, metadata) {
  try {
    console.log('🔐 Computing content hash...');
    
    // Convert Blob to Buffer if needed
    let imageBytes;
    if (imageBuffer instanceof Blob) {
      const arrayBuffer = await imageBuffer.arrayBuffer();
      imageBytes = Buffer.from(arrayBuffer);
    } else {
      imageBytes = Buffer.isBuffer(imageBuffer) 
        ? imageBuffer 
        : Buffer.from(imageBuffer);
    }
    
    console.log('📊 Image size:', imageBytes.length, 'bytes');
    
    // Step 1: Hash the raw image bytes
    const imageHash = await sha256Hash(imageBytes);
    console.log('🖼️ Image Hash:', imageHash);
    
    // Step 2: Canonicalize metadata
    const canonicalMetadata = canonicalizeMetadata(metadata);
    console.log('📝 Canonical Metadata:', canonicalMetadata.substring(0, 100) + '...');
    
    // Compute metadata hash
    const encoder = new TextEncoder();
    const metadataHash = await sha256Hash(encoder.encode(canonicalMetadata));
    console.log('📋 Metadata Hash:', metadataHash);
    
    // Step 3: Combine hashes for final content hash
    const combined = imageHash + canonicalMetadata;
    const contentHash = await sha256Hash(encoder.encode(combined));
    
    console.log('✅ Content Hash:', contentHash);
    
    return {
      imageHash,
      metadataHash,
      contentHash,
      canonicalMetadata,
      imageSize: imageBytes.length
    };
    
  } catch (error) {
    console.error('❌ Error computing content hash:', error);
    throw new Error(`Content hash computation failed: ${error.message}`);
  }
}

/**
 * Verify content hash matches image and metadata
 * Used to validate artwork authenticity
 * 
 * @param {Buffer|Blob} imageBuffer - Raw image bytes
 * @param {Object} metadata - NFT metadata
 * @param {string} expectedHash - Expected content hash
 * @returns {Promise<boolean>} True if hash matches
 */
export async function verifyContentHash(imageBuffer, metadata, expectedHash) {
  try {
    console.log('🔍 Verifying content hash...');
    console.log('📌 Expected:', expectedHash);
    
    const { contentHash } = await computeContentHash(imageBuffer, metadata);
    
    console.log('📌 Computed:', contentHash);
    
    const isValid = contentHash === expectedHash;
    
    if (isValid) {
      console.log('✅ Content hash verification PASSED');
    } else {
      console.warn('⚠️ Content hash verification FAILED');
    }
    
    return isValid;
    
  } catch (error) {
    console.error('❌ Error verifying content hash:', error);
    return false;
  }
}

/**
 * Create hash fingerprint for display
 * Shows abbreviated hash for UI display
 * 
 * @param {string} hash - Full hash string
 * @returns {string} Abbreviated hash
 */
export function formatHashFingerprint(hash) {
  if (!hash || hash.length < 16) return hash;
  return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
}

export default {
  sha256Hash,
  canonicalizeMetadata,
  computeContentHash,
  verifyContentHash,
  formatHashFingerprint
};

