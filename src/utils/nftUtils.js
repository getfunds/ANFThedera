/**
 * NFT utility functions for fetching and processing NFT data
 */

const NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';

/**
 * Get all NFTs owned by an account from Hedera Mirror Node
 */
export async function getAccountNFTs(accountId) {
  try {
    const baseUrl = NETWORK === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
    
    const response = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/nfts`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.nfts || [];
  } catch (error) {
    console.error('❌ Error getting account NFTs:', error);
    throw error;
  }
}

/**
 * Get NFT metadata from IPFS URL
 */
export async function getNFTMetadata(metadataUrl) {
  try {
    if (!metadataUrl || typeof metadataUrl !== 'string') {
      return null;
    }
    
    // Handle different IPFS URL formats
    let url = metadataUrl;
    if (metadataUrl.startsWith('ipfs://')) {
      url = metadataUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
    } else if (metadataUrl.includes('ipfs/Qm') || metadataUrl.includes('ipfs/bafy')) {
      // Already in gateway format
      url = metadataUrl;
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch metadata from ${url}`);
      return null;
    }
    
    const metadata = await response.json();
    return metadata;
  } catch (error) {
    console.warn('Failed to fetch NFT metadata:', error);
    return null;
  }
}

/**
 * Process raw NFT data from Mirror Node to user-friendly format
 */
export async function processNFTData(rawNfts, userAccountId) {
  const processedNfts = [];
  
  for (const nft of rawNfts) {
    try {
      // Decode metadata (usually base64 encoded IPFS URL)
      let metadataUrl = null;
      let metadata = null;
      
      if (nft.metadata) {
        try {
          // Try to decode base64
          const decodedMetadata = atob(nft.metadata);
          
          // Check if it's an IPFS URL
          if (decodedMetadata.includes('ipfs') || decodedMetadata.startsWith('http')) {
            metadataUrl = decodedMetadata;
            metadata = await getNFTMetadata(metadataUrl);
          } else {
            // Try parsing as JSON directly
            metadata = JSON.parse(decodedMetadata);
          }
        } catch {
          // If base64 decode fails, try as plain text
          if (nft.metadata.includes('ipfs') || nft.metadata.startsWith('http')) {
            metadataUrl = nft.metadata;
            metadata = await getNFTMetadata(metadataUrl);
          }
        }
      }
      
      // Create processed NFT object
      const processedNft = {
        id: `${nft.token_id}-${nft.serial_number}`,
        tokenId: nft.token_id,
        serialNumber: nft.serial_number,
        name: metadata?.name || `NFT #${nft.serial_number}`,
        description: metadata?.description || 'No description available',
        image: metadata?.image || metadata?.imageUrl || null,
        creator: nft.account_id, // This might not always be the creator
        owner: userAccountId,
        attributes: metadata?.attributes || [],
        metadataUrl: metadataUrl,
        rawMetadata: metadata,
        createdAt: nft.created_timestamp ? new Date(nft.created_timestamp * 1000).toISOString() : null,
        isReal: true, // Mark as real NFT from blockchain
        relationship: 'owned' // We know user owns it since we fetched from their account
      };
      
      processedNfts.push(processedNft);
    } catch (error) {
      console.warn(`Failed to process NFT ${nft.token_id}-${nft.serial_number}:`, error);
      
      // Add minimal NFT data even if processing fails
      processedNfts.push({
        id: `${nft.token_id}-${nft.serial_number}`,
        tokenId: nft.token_id,
        serialNumber: nft.serial_number,
        name: `NFT #${nft.serial_number}`,
        description: 'Unable to load metadata',
        image: null,
        creator: nft.account_id,
        owner: userAccountId,
        attributes: [],
        metadataUrl: null,
        rawMetadata: null,
        createdAt: nft.created_timestamp ? new Date(nft.created_timestamp * 1000).toISOString() : null,
        isReal: true,
        relationship: 'owned'
      });
    }
  }
  
  return processedNfts;
}

/**
 * Check if an NFT is a mock/test NFT (should be filtered out)
 */
export function isMockNFT(nft) {
  // Check for mock indicators
  const mockIndicators = [
    'mock',
    'test',
    'placeholder',
    'example',
    'demo',
    'data:image/svg+xml', // SVG placeholders
    'base64'
  ];
  
  const nftName = (nft.name || '').toLowerCase();
  const nftDescription = (nft.description || '').toLowerCase();
  const nftImage = (nft.image || '').toLowerCase();
  
  return mockIndicators.some(indicator => 
    nftName.includes(indicator) || 
    nftDescription.includes(indicator) || 
    nftImage.includes(indicator)
  );
}

/**
 * Filter out mock NFTs and return only real NFTs
 */
export function filterRealNFTs(nfts) {
  return nfts.filter(nft => !isMockNFT(nft));
}

export default {
  getAccountNFTs,
  getNFTMetadata,
  processNFTData,
  isMockNFT,
  filterRealNFTs
};
