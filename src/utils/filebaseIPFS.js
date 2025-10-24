/**
 * Filebase IPFS Upload Utility (Client-Side)
 * Routes uploads through API endpoint for security
 * Documentation: https://docs.filebase.com/
 */

// Filebase IPFS Gateway
const FILEBASE_GATEWAY = 'https://ipfs.filebase.io/ipfs';

/**
 * Check if we're running on the server
 */
function isServer() {
  return typeof window === 'undefined';
}

/**
 * Get Filebase S3 client (Server-side only)
 */
async function getFilebaseClient() {
  if (!isServer()) {
    throw new Error('S3Client can only be used on the server side');
  }

  const { S3Client } = await import('@aws-sdk/client-s3');
  
  const accessKey = process.env.FILEBASE_ACCESS_KEY || process.env.NEXT_PUBLIC_FILEBASE_ACCESS_KEY;
  const secretKey = process.env.FILEBASE_SECRET_KEY || process.env.NEXT_PUBLIC_FILEBASE_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error('Filebase credentials not configured. Please set FILEBASE_ACCESS_KEY and FILEBASE_SECRET_KEY in your environment variables.');
  }

  return new S3Client({
    region: 'us-east-1',
    endpoint: 'https://s3.filebase.com',
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey
    }
  });
}

/**
 * Upload file (blob) to Filebase IPFS via API endpoint
 * @param {Blob} fileBlob - The file blob to upload
 * @param {string} fileName - The filename
 * @returns {Promise<{success: boolean, ipfsHash: string, ipfsUrl: string}>}
 */
export async function uploadFileToFilebase(fileBlob, fileName) {
  try {
    console.log('📤 Uploading file to Filebase IPFS via API...');
    console.log('📝 File name:', fileName);
    console.log('📊 File size:', fileBlob.size, 'bytes');

    // Convert blob to base64 for API transmission
    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Upload via API endpoint
    const response = await fetch('/api/upload-file-to-filebase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileData: base64,
        fileName: fileName,
        contentType: fileBlob.type || 'application/octet-stream'
      })
    });

    if (!response.ok) {
      throw new Error(`API upload failed: ${response.status}`);
    }

    const result = await response.json();

    console.log('✅ File uploaded to Filebase IPFS');
    console.log('🔗 IPFS Hash:', result.hash);
    console.log('🌐 IPFS URL:', result.ipfsUrl);

    return {
      success: true,
      ipfsHash: result.hash,
      ipfsUrl: result.ipfsUrl
    };

  } catch (error) {
    console.error('❌ Filebase upload failed:', error);
    throw new Error(`Failed to upload to Filebase IPFS: ${error.message}`);
  }
}

/**
 * Upload JSON metadata to Filebase IPFS via API endpoint
 * @param {Object} metadata - The metadata object
 * @param {string} fileName - Optional filename (will generate if not provided)
 * @returns {Promise<{success: boolean, ipfsHash: string, ipfsUrl: string}>}
 */
export async function uploadJSONToFilebase(metadata, fileName) {
  try {
    console.log('📦 Uploading JSON metadata to Filebase IPFS via API...');

    // Use the existing upload-to-ipfs API endpoint
    const response = await fetch('/api/upload-to-ipfs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ metadata })
    });

    if (!response.ok) {
      throw new Error(`API upload failed: ${response.status}`);
    }

    const result = await response.json();

    console.log('✅ JSON metadata uploaded to Filebase IPFS');
    console.log('🔗 IPFS Hash:', result.hash);
    console.log('🌐 IPFS URL:', result.ipfsUrl);

    return {
      success: true,
      ipfsHash: result.hash,
      ipfsUrl: result.ipfsUrl
    };

  } catch (error) {
    console.error('❌ Filebase JSON upload failed:', error);
    throw new Error(`Failed to upload JSON to Filebase IPFS: ${error.message}`);
  }
}

/**
 * Complete NFT upload workflow: Upload image and metadata to Filebase IPFS
 * @param {Blob} imageBlob - The image blob
 * @param {Object} metadata - NFT metadata (will be enhanced with image URL)
 * @param {string} imageName - Optional image filename
 * @returns {Promise<{success: boolean, imageUrl: string, imageHash: string, metadataUrl: string, metadataHash: string, metadata: Object}>}
 */
export async function uploadNFTToFilebase(imageBlob, metadata, imageName = null) {
  try {
    console.log('🚀 Starting complete NFT upload to Filebase IPFS...');

    // Generate image filename if not provided
    const imageFileName = imageName || `nft-image-${Date.now()}.png`;

    // Step 1: Upload image
    console.log('📸 Step 1: Uploading image...');
    const imageResult = await uploadFileToFilebase(imageBlob, imageFileName);

    if (!imageResult.success) {
      throw new Error('Image upload failed');
    }

    // Step 2: Create complete metadata with image URL
    console.log('📝 Step 2: Creating metadata with image URL...');
    const completeMetadata = {
      ...metadata,
      image: imageResult.ipfsUrl
    };

    // Step 3: Upload metadata
    console.log('📦 Step 3: Uploading metadata...');
    const metadataFileName = `metadata-${Date.now()}.json`;
    const metadataResult = await uploadJSONToFilebase(completeMetadata, metadataFileName);

    if (!metadataResult.success) {
      throw new Error('Metadata upload failed');
    }

    console.log('🎉 Complete NFT upload successful!');

    return {
      success: true,
      imageUrl: imageResult.ipfsUrl,
      imageHash: imageResult.ipfsHash,
      metadataUrl: metadataResult.ipfsUrl,
      metadataHash: metadataResult.ipfsHash,
      metadata: completeMetadata
    };

  } catch (error) {
    console.error('❌ Complete NFT upload failed:', error);
    throw new Error(`Failed to upload NFT to Filebase IPFS: ${error.message}`);
  }
}

/**
 * Check if Filebase is configured
 * @returns {boolean}
 */
export function isFilebaseConfigured() {
  const accessKey = process.env.NEXT_PUBLIC_FILEBASE_ACCESS_KEY || process.env.FILEBASE_ACCESS_KEY;
  const secretKey = process.env.NEXT_PUBLIC_FILEBASE_SECRET_KEY || process.env.FILEBASE_SECRET_KEY;
  return !!(accessKey && secretKey);
}

export default {
  uploadFileToFilebase,
  uploadJSONToFilebase,
  uploadNFTToFilebase,
  isFilebaseConfigured
};

