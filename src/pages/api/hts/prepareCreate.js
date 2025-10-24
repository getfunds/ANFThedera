'use strict';

import { Client, AccountId, TokenCreateTransaction, TokenType, TokenSupplyType, PublicKey, Hbar, TransactionId } from '@hashgraph/sdk';

async function getAccountPublicKeyFromMirror(accountId) {
  const base = process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com';
  const url = `${base}/api/v1/accounts/${accountId}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Mirror query failed: ${r.status}`);
  const j = await r.json();
  // Mirror may return key as string or object with {key, _type} or nested
  const k = j.key || (j.accounts && j.accounts[0]?.key);
  if (!k) throw new Error('Public key not found for account');
  if (typeof k === 'string') return k;
  if (typeof k === 'object') {
    if (typeof k.key === 'string') return k.key;
    if (typeof k.ed25519 === 'string') return k.ed25519;
    if (typeof k.ECDSA_secp256k1 === 'string') return k.ECDSA_secp256k1;
  }
  throw new Error('Unsupported key format from mirror');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accountId, name, symbol, memo, maxSupply } = req.body || {};
    if (!accountId) return res.status(400).json({ error: 'Missing accountId' });

    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';
    const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();

    // Require explicit transactionId using user as payer so wallet pays fees
    const txId = TransactionId.generate(AccountId.fromString(accountId));

    // Get user's public key to set as admin/supply keys
    let pubKeyStr = await getAccountPublicKeyFromMirror(accountId);
    if (typeof pubKeyStr !== 'string') throw new Error('Invalid public key format');
    // Normalize common prefixes
    if (pubKeyStr.startsWith('0x') || pubKeyStr.startsWith('0X')) {
      pubKeyStr = pubKeyStr.slice(2);
    }
    const pubKey = PublicKey.fromString(pubKeyStr);

    const tokenCreate = new TokenCreateTransaction()
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTokenName(name || 'AI Art Collection')
      .setTokenSymbol(symbol || 'AIART')
      .setTokenMemo(memo || 'User-owned AI Art collection')
      .setTreasuryAccountId(AccountId.fromString(accountId))
      .setAdminKey(pubKey)
      .setSupplyKey(pubKey)
      .setMaxTransactionFee(new Hbar(20))
      .setTransactionId(txId);

    const frozen = await tokenCreate.freezeWith(client);
    const bytes = frozen.toBytes();

    return res.status(200).json({ success: true, transactionBytes: Buffer.from(bytes).toString('base64'), transactionId: txId.toString() });
  } catch (error) {
    console.error('prepareCreate error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}


