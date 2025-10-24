/**
 * File Upload API endpoint for Filebase IPFS
 * Handles image/file uploads (not just metadata)
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// Filebase S3-compatible endpoint
const FILEBASE_ENDPOINT = 'https://s3.filebase.com';
const FILEBASE_BUCKET = process.env.FILEBASE_BUCKET || process.env.NEXT_PUBLIC_FILEBASE_BUCKET || 'anft-nfts';
const FILEBASE_GATEWAY = 'https://ipfs.filebase.io/ipfs';

// Increase body size limit to 10MB for larger images
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { fileData, fileName, contentType } = req.body;
    
    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'Missing fileData or fileName in request body' });
    }
    
    // Check if Filebase credentials are available
    const accessKey = process.env.FILEBASE_ACCESS_KEY || process.env.NEXT_PUBLIC_FILEBASE_ACCESS_KEY;
    const secretKey = process.env.FILEBASE_SECRET_KEY || process.env.NEXT_PUBLIC_FILEBASE_SECRET_KEY;
    
    if (!accessKey || !secretKey) {
      console.error('❌ Filebase credentials not configured');
      return res.status(500).json({
        success: false,
        error: 'Filebase credentials not configured. Please set FILEBASE_ACCESS_KEY and FILEBASE_SECRET_KEY in .env.local'
      });
    }
    
    console.log('🔑 Using Filebase credentials');
    console.log('📦 Bucket:', FILEBASE_BUCKET);
    console.log('🌐 Endpoint:', FILEBASE_ENDPOINT);
    
    // Create Filebase S3 client
    const client = new S3Client({
      region: 'us-east-1',
      endpoint: FILEBASE_ENDPOINT,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey
      },
      forcePathStyle: true // Required for Filebase
    });
    
    // Convert base64 to buffer
    const buffer = Buffer.from(fileData, 'base64');
    
    console.log('📤 Uploading file to Filebase IPFS...');
    console.log('📝 File:', fileName);
    console.log('📊 Size:', buffer.length, 'bytes');
    console.log('📄 Type:', contentType);
    
    // Upload to Filebase with IPFS pinning
    const command = new PutObjectCommand({
      Bucket: FILEBASE_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream'
      // Note: Filebase automatically pins to IPFS, no special metadata needed
    });
    
    await client.send(command);
    
    console.log('✅ File uploaded to Filebase, retrieving IPFS CID...');
    
    // Get the IPFS CID from object metadata
    const headCommand = new HeadObjectCommand({
      Bucket: FILEBASE_BUCKET,
      Key: fileName
    });
    
    const headResponse = await client.send(headCommand);
    
    // Filebase returns the IPFS CID in the x-amz-meta-cid header
    const ipfsHash = headResponse.Metadata?.cid || '';
    
    if (!ipfsHash) {
      console.error('❌ No IPFS CID found in response metadata');
      throw new Error('Failed to retrieve IPFS CID from Filebase');
    }
    
    const ipfsUrl = `${FILEBASE_GATEWAY}/${ipfsHash}`;
    
    console.log('✅ File uploaded to Filebase IPFS');
    console.log('🔗 IPFS CID:', ipfsHash);
    console.log('🌐 IPFS URL:', ipfsUrl);
    
    return res.status(200).json({
      success: true,
      ipfsUrl: ipfsUrl,
      hash: ipfsHash
    });
    
  } catch (error) {
    console.error('❌ Filebase file upload error:', error);
    
    return res.status(500).json({
      success: false,
      error: `Failed to upload file to Filebase IPFS: ${error.message}`
    });
  }
}

