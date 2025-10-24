/**
 * API Endpoint: Resolve DID
 * 
 * Resolves a DID to its document
 */

import { Client, FileContentsQuery, FileId } from '@hashgraph/sdk';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { did, fileId } = req.query;

    if (!did && !fileId) {
      return res.status(400).json({ error: 'DID or File ID is required' });
    }

    console.log('🔍 Resolving DID:', did || fileId);

    // Initialize Hedera client
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const operatorId = process.env.HEDERA_ACCOUNT_ID;
    const operatorKey = process.env.HEDERA_PRIVATE_KEY;

    if (!operatorId || !operatorKey) {
      return res.status(500).json({ error: 'Hedera credentials not configured' });
    }

    const client = network === 'mainnet'
      ? Client.forMainnet()
      : Client.forTestnet();

    client.setOperator(operatorId, operatorKey);

    // If we have fileId, retrieve document from HFS
    if (fileId) {
      const query = new FileContentsQuery()
        .setFileId(FileId.fromString(fileId));

      const contents = await query.execute(client);
      const documentJson = contents.toString('utf-8');
      const document = JSON.parse(documentJson);

      client.close();

      return res.status(200).json({
        success: true,
        document: document,
        did: document.id
      });
    }

    // Otherwise, extract topic ID from DID and query
    // For now, return not found
    client.close();

    return res.status(404).json({
      error: 'DID resolution not implemented yet. Please provide fileId.'
    });

  } catch (error) {
    console.error('❌ DID resolution error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to resolve DID'
    });
  }
}
