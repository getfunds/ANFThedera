'use strict';

import { Client, AccountId, PrivateKey, TokenId, TokenMintTransaction, TransferTransaction, Hbar } from '@hashgraph/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountId: userAccountId, tokenId: tokenIdStr, metadata } = req.body || {};

    if (!userAccountId || !tokenIdStr || !metadata) {
      return res.status(400).json({ error: 'Missing required fields: accountId, tokenId, metadata' });
    }

    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
    const tokenId = TokenId.fromString(tokenIdStr);

    // Prepare a user-payer mint for client-side signing
    const metadataBytes = Buffer.from(JSON.stringify(metadata));
    const txId = client.generateTransactionId(AccountId.fromString(userAccountId));

    const mintTx = await new TokenMintTransaction()
      .setTokenId(tokenId)
      .setMetadata([metadataBytes])
      .setMaxTransactionFee(new Hbar(10))
      .setTransactionId(txId)
      .freezeWith(client);

    const bytes = mintTx.toBytes();
    return res.status(200).json({ success: true, transactionBytes: Buffer.from(bytes).toString('base64'), transactionId: txId.toString() });
  } catch (error) {
    console.error('HTS mint API error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}


