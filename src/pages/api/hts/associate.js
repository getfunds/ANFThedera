'use strict';

import { Client, AccountId, TokenId, TokenAssociateTransaction, Hbar, TransactionId } from '@hashgraph/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountId: userAccountId, tokenId: tokenIdStr } = req.body || {};
    if (!userAccountId || !tokenIdStr) {
      return res.status(400).json({ error: 'Missing required fields: accountId, tokenId' });
    }

    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const tokenId = TokenId.fromString(tokenIdStr);

    // Build a client without server operator; user will be the payer
    const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

    // Explicitly set transaction ID using user's account so wallet pays fees
    const txId = TransactionId.generate(AccountId.fromString(userAccountId));

    const tx = await new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(userAccountId))
      .setTokenIds([tokenId])
      .setMaxTransactionFee(new Hbar(2))
      .setTransactionId(txId)
      .freezeWith(client);

    const bytes = tx.toBytes();

    return res.status(200).json({ success: true, transactionBytes: Buffer.from(bytes).toString('base64'), transactionId: txId.toString() });

  } catch (error) {
    console.error('HTS associate API error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}


