# ANFT - Authentic NFT Platform 🎨

**Hedera Track Submission**

A next-generation NFT marketplace built on Hedera that combines AI-powered art generation, digital painting tools, and comprehensive on-chain provenance tracking to create truly authentic and verifiable digital art.

[![Built on Hedera](https://img.shields.io/badge/Built%20on-Hedera-7B2BFF.svg)](https://hedera.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black.svg)](https://nextjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.19-blue.svg)](https://soliditylang.org/)

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Hedera Integration](#-hedera-integration-detailed)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Deployment & Setup](#-deployment--setup)
- [Environment Configuration](#-environment-configuration)
- [Deployed Hedera IDs](#-deployed-hedera-ids-testnet)
- [How It Works](#-how-it-works)
- [Smart Contracts](#-smart-contracts)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Project Overview

ANFT (Authentic NFT) is a comprehensive NFT platform that revolutionizes digital art creation and trading on the Hedera network. The platform provides two distinct creation methods:

1. **AI Art Generation** - Leverages text-to-image ai agents to generate high-quality, AI artwork
2. **Digital Painting Studio** - A professional-grade canvas-based drawing tool with multiple brushes, colors, and layers

What sets ANFT apart is its **three-layer authenticity system**: every artwork is tied to a Decentralized Identity (DID), cryptographically hashed for integrity verification, and permanently attested on-chain through Hedera Consensus Service, creating an immutable chain of provenance that proves ownership, authenticity, and creation history.

---

## 🌐 Hedera Integration (Detailed)

ANFT extensively leverages multiple Hedera services to create a fast, affordable, and trustworthy NFT ecosystem. Below is a comprehensive breakdown of how each service is utilized and why.

### 1. **Hedera Token Service (HTS)**

#### Why We Use HTS
We chose HTS for NFT creation and management because it provides **native token functionality** at the protocol level with **predictable, low-cost minting** ($0.001 per NFT mint) and **built-in royalty support**. Unlike Ethereum-based ERC-721 implementations that require complex smart contracts and high gas fees, HTS enables instant NFT creation with association, transfer, and ownership tracking—all handled by Hedera's network layer. This drastically reduces development complexity and ensures creators can mint NFTs without worrying about fluctuating costs or failed transactions.

#### Transaction Types Executed
- **`TokenCreateTransaction`** - Creates new NFT collections with customizable metadata, supply limits, and royalty configurations
- **`TokenMintTransaction`** - Mints individual NFTs with unique metadata URIs (IPFS CIDs) and serial numbers
- **`TokenAssociateTransaction`** - Associates tokens with user accounts before transfers (Hedera security requirement)
- **`TokenNftTransfer`** - Transfers NFT ownership between accounts (via marketplace purchases)
- **`AccountAllowanceApproveTransaction`** - Grants marketplace contract permission to transfer NFTs on behalf of sellers

#### Economic Justification
HTS's **$0.001 fixed minting cost** makes ANFT economically viable for both casual creators and professional artists. This cost reduction enables:
- **Accessible Creation**: Artists can mint dozens of NFTs for under $1
- **Sustainable Business Model**: Platform can charge minimal fees while remaining profitable
- **User Adoption**: Low barriers to entry attract new creators to Web3
- **High Throughput**: 10,000 TPS ensures instant minting during high traffic

The predictable fee structure also allows ANFT to offer **transparent pricing** to users,they know exactly what they'll pay before minting, fostering trust and reducing transaction anxiety.

---

### 2. **Hedera Consensus Service (HCS)**

#### Why We Use HCS for Decentralized Identities (DIDs)
We implemented DIDs on HCS because it provides **immutable, timestamped identity records** at a cost of **$0.0001 per message**. DIDs are critical for establishing creator authenticity and preventing art theft. By storing DID documents and public keys on HCS topics, we create a **permanent, verifiable identity layer** that exists independently of ANFT's servers. If our platform disappeared tomorrow, creators' identities and ownership proofs would remain intact on Hedera's ledger.

#### Transaction Types Executed
- **`TopicCreateTransaction`** - Creates personal HCS topics for each user's DID document
- **`TopicMessageSubmitTransaction`** - Submits DID registration and update messages
- **`FileCreateTransaction`** - Stores DID documents on Hedera File Service for retrieval
- **`FileAppendTransaction`** - Updates DID documents when creators modify their profiles

#### Why HCS for Attestations
HCS also powers our **on-chain attestation system**, which creates an immutable record proving:
- **Who** created the artwork (DID)
- **What** was created (content hash)
- **When** it was created (timestamp)
- **How** it was created (AI vs. Digital Painting)

This attestation acts as a **digital notarization** that can be independently verified by anyone. The $0.0001 cost per attestation is negligible compared to the legal and reputational value it provides—enabling ANFT to offer enterprise-grade provenance tracking at consumer-friendly prices.

#### Economic Justification
At **$0.0001 per message**, HCS is 100x cheaper than alternative decentralized storage solutions like Arweave ($0.01 per KB). For ANFT's use case:
- **DID Creation**: ~$0.0003 (topic + file + message)
- **Attestation**: $0.0001 per artwork
- **Total Cost per NFT**: ~$0.0014 (including all Hedera services)

This ultra-low cost structure allows ANFT to absorb consensus fees entirely, providing a **completely free DID and attestation system** to users. This removes friction from the onboarding process and ensures every artwork is automatically protected, not just those from paying users.

The **ABFT (Asynchronous Byzantine Fault Tolerant)** consensus provided by HCS ensures that once an attestation is recorded, it achieves **irreversible finality within 3-5 seconds**, far faster than Ethereum's probabilistic finality (10+ minutes). This means creators see their artwork authenticated in real-time, enhancing user experience.

---

### 3. **Hedera Smart Contract Service (HSCS)**

#### Why We Use HSCS for the Marketplace
We deployed our NFT Marketplace smart contract on HSCS because it combines **EVM compatibility** (allowing us to use Solidity and OpenZeppelin libraries) with **Hedera's fee structure and finality guarantees**. The marketplace contract handles listing creation, purchase execution, platform fee collection (2.5%), and NFT transfers—all while interacting seamlessly with HTS tokens via Hedera's precompiled contracts.

#### Transaction Types Executed
- **`ContractCreateTransaction`** - Deploys the NFTMarketplace contract with platform fee recipient
- **`ContractExecuteTransaction` (createListing)** - Sellers list NFTs with price and duration
- **`ContractExecuteTransaction` (purchaseNFT)** - Buyers purchase listed NFTs with HBAR
- **`ContractExecuteTransaction` (cancelListing)** - Sellers cancel active listings
- **`ContractCallQuery`** - Retrieves listing details, active listings, and user listings

The marketplace contract uses **HTS precompiled contracts** (`address(0x167)`) to interact directly with native HTS NFTs, eliminating the need for wrapper contracts or token bridging. This reduces transaction costs by ~40% compared to ERC-721 equivalents.

Our **2.5% platform fee** is competitive with industry standards (OpenSea: 2.5%, Rarible: 2.5%) but benefits from Hedera's low infrastructure costs, allowing ANFT to remain profitable while offering the lowest overall transaction costs in the NFT space.

---

### 4. **Hedera File Service (HFS)**

#### Why We Use HFS
We use HFS to store **DID documents** and **large metadata payloads** that exceed HCS's message size limits. HFS provides immutable, content-addressed storage, which is ideal for structured identity data that needs to be publicly retrievable.

#### Transaction Types Executed
- **`FileCreateTransaction`** - Creates files to store DID documents (~1-2 KB)
- **`FileAppendTransaction`** - Appends additional data to files when DID updates occur
- **`FileInfoQuery`** - Retrieves file metadata and content hashes
- **`FileContentsQuery`** - Fetches full DID documents for verification

This makes HFS ideal for storing immutable identity credentials that need to be **publicly accessible but rarely updated**.

---

### 5. **Hedera Mirror Node**

#### Why We Use Mirror Nodes
Mirror nodes provide **public REST APIs** for querying historical transactions, account balances, token metadata, and HCS messages. ANFT uses mirror nodes extensively for:
- **DID Resolution**: Check existing DID documents before creating new ones
- **Transaction Verification**: Confirming NFT mints and transfers completed successfully
- **Marketplace Data**: Loading active listings and purchase history
- **Attestation Retrieval**: Displaying on-chain provenance proofs in NFT metadata
- **Account Lookups**: Converting EVM addresses to Hedera account IDs for approval checks

By leveraging mirror nodes, ANFT delivers a **rich, data-driven user experience** (transaction history, NFT galleries, marketplace analytics) at **zero marginal cost**.

---

### **Summary: Why Hedera for ANFT?**

| Metric | Ethereum | Hedera (ANFT) | **Advantage** |
|--------|----------|---------------|---------------|
| **NFT Mint Cost** | $50-$200 | $0.001 | **50,000x cheaper** |
| **DID + Attestation** | $10-$30 | $0.0004 | **75,000x cheaper** |
| **Marketplace Trade** | $5-$50 | $0.02-$0.05 | **250x cheaper** |
| **Transaction Finality** | 10-15 min | 3-5 sec | **200x faster** |
| **TPS (Peak Load)** | ~15 TPS | 10,000 TPS | **666x higher throughput** |
| **Carbon Footprint** | High | Carbon-negative | **Eco-friendly** |

**Total Cost per Full NFT Lifecycle** (mint + DID + attestation + 1 trade):
- **Ethereum**: ~$75-$280
- **ANFT on Hedera**: ~$0.03

This **2,500x - 9,000x cost reduction** makes ANFT accessible to creators globally, particularly in regions where $75 transaction fees would be prohibitive. Hedera's predictable, sub-cent fees enable ANFT to scale sustainably while maintaining a user-first pricing model.

---

## ✨ Key Features

### 🎨 **Dual Creation Methods**
- **AI Art Generation**
  - Integration with public AI agents
  - high-quality text-to-image generation
  - Real-time prompt validation and content filtering
  - Automatic image optimization for large files (>2MB)

- **Digital Painting Studio**
  - Professional canvas-based drawing interface
  - Multiple brush types (pen, marker, pencil, spray, calligraphy)
  - Variable brush sizes (1-50px)
  - Color picker with custom palette support

### 🔐 **Three-Layer Authenticity System**
1. **Decentralized Identity (DID)** - Hedera-based creator identities using HCS and HFS
2. **Content Hashing** - SHA-256 fingerprinting of images and metadata
3. **On-Chain Attestation** - Immutable provenance records via HCS

### 🛒 **NFT Marketplace**
- List NFTs with custom pricing (in HBAR)
- Configurable listing durations (minimum 24 hours)
- 2.5% platform fee with transparent breakdown
- Instant purchase with automatic HTS token transfers
- Smart contract-enforced approvals and escrow
- Real-time listing updates via Mirror Node integration

### 💼 **Blade Wallet Integration**
- Seamless wallet connection via Blade Wallet
- Client-side transaction signing (no private keys stored)
- Token association handling
- Transaction status tracking with Mirror Node confirmation
- Multi-account support

### 📦 **IPFS Storage**
- Filebase S3-compatible IPFS pinning
- Automatic CID generation for images and metadata
- Permanent, decentralized storage
- Gateway redundancy for high availability

---

## 🏗 Architecture

### **System Architecture Diagram**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ANFT Platform (Frontend)                     │
│                         Next.js 15 + React 19                        │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     │ 1. User connects Blade Wallet
                     │    (Account ID: 0.0.XXXXXX)
                     │
                     ▼
          ┌──────────────────────┐
          │   Blade Wallet SDK   │◄──── User signs all transactions
          │  (@bladelabs/web3)   │      (DID, Attestation, Minting, Trading)
          └──────────┬───────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐
│   Hedera    │ │   Hedera    │ │   Hedera Smart      │
│   Token     │ │  Consensus  │ │   Contract Service  │
│   Service   │ │   Service   │ │   (Marketplace)     │
│   (HTS)     │ │   (HCS)     │ │                     │
│             │ │             │ │                     │
└──────┬──────┘ └──────┬──────┘ └──────────┬──────────┘
       │               │                   │
       │ Mint NFTs     │ Store DIDs        │ Execute Trades
       │ (Token ID)    │ & Attestations    │ (2.5% fee)
       │               │ (Topic IDs)       │
       │               │                   │
       └───────────────┼───────────────────┘
                       │
                       │ All transactions recorded on
                       ▼
              ┌─────────────────┐
              │  Hedera Network │
              │   (Mainnet/     │
              │    Testnet)     │
              └────────┬────────┘
                       │
                       │ Transaction history & metadata
                       ▼
              ┌─────────────────┐
              │  Mirror Nodes   │◄───── ANFT queries for:
              │   (REST API)    │       • DID resolution
              │                 │       • Transaction verification
              │                 │       • Marketplace listings
              │                 │       • NFT metadata
              └─────────────────┘       • Attestation records


┌─────────────────────────────────────────────────────────────────────┐
│                      IPFS Storage Layer                              │
│                      (Filebase S3 Gateway)                           │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     │ Store NFT images & metadata
                     │ (Permanent, content-addressed)
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌───────────────┐         ┌───────────────┐
│  Image Files  │         │  Metadata     │
│  (PNG/JPEG)   │         │  (JSON)       │
│  IPFS CID:    │         │  IPFS CID:    │
│  Qm...        │         │  Qm...        │
└───────────────┘         └───────────────┘
        │                         │
        └────────────┬────────────┘
                     │
                     │ Referenced in NFT token metadata
                     ▼
              ┌─────────────────┐
              │   HTS Token     │
              │   Metadata URI  │
              │  (ipfs://CID)   │
              └─────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                      Data Flow Summary                               │
└─────────────────────────────────────────────────────────────────────┘

User Action           → Hedera Service      → Result
────────────────────────────────────────────────────────────────────
1. Create DID         → HCS + HFS           → DID Topic + File
2. Generate AI Art    → Hugging Face API    → Image Blob
3. Hash Artwork       → Client-side SHA-256 → Content Hash
4. Create Attestation → HCS                 → Attestation Message
5. Upload to IPFS     → Filebase            → Image + Metadata CIDs
6. Mint NFT           → HTS                 → Token ID + Serial #
7. List NFT           → Smart Contract      → Listing ID
8. Purchase NFT       → Smart Contract      → Transfer + HBAR payment
9. View History       → Mirror Node         → Transaction records
```

### **Transaction Flow Example: Creating an AI NFT**

```
Step 1: User enters prompt → "A serene mountain landscape at sunset"
   ↓
Step 2: Check for existing DID
   ↓ Query: GET /api/did/check?accountId=0.0.xxxxxx
   ↓
Step 3: If no DID, create one
   ↓ HCS: TopicCreateTransaction 
   ↓ HFS: FileCreateTransaction 
   ↓ HCS: TopicMessageSubmitTransaction (DID document)
   ↓ Result: DID = did:hedera:testnet:0.0.xxxx_0.0.xxxxx
   ↓
Step 4: Generate AI artwork
   ↓ API: POST https://router.huggingface.co/hf-inference
   ↓ Model: black-forest-labs/FLUX.1-dev
   ↓ Result: 512x512 PNG image
   ↓
Step 5: Hash artwork
   ↓ SHA-256(image bytes) → imageHash
   ↓ SHA-256(metadata JSON) → metadataHash
   ↓ Combine → contentHash
   ↓
Step 6: Create attestation
   ↓ HCS: TopicCreateTransaction (personal attestation topic)
   ↓ HCS: TopicMessageSubmitTransaction
   ↓ Payload: { did, contentHash, timestamp, method: "AI" }
   ↓ Result: Attestation TX = 0.0.4475114@1234567890.123456789
   ↓
Step 7: Upload to IPFS (Filebase)
   ↓ POST /api/upload-file-to-filebase (image)
   ↓ POST /api/upload-to-ipfs (metadata JSON)
   ↓ Result: Image CID = QmABC..., Metadata CID = QmXYZ...
   ↓
Step 8: Mint NFT
   ↓ HTS: TokenCreateTransaction (if new collection)
   ↓ HTS: TokenAssociateTransaction (user associates token)
   ↓ HTS: TokenMintTransaction
   ↓   - Metadata URI: ipfs://QmXYZ...
   ↓   - Contains: imageHash, contentHash, DID, attestation TX
   ↓ Result: Token ID = 0.0.xxxxxx, Serial #1
   ↓
Step 9: Mirror Node confirmation
   ↓ Query: GET /api/v1/tokens/0.0.xxxxxxx/nfts/1
   ↓ Display NFT with full provenance in "My NFTs" gallery
```

---

## 💻 Technology Stack

### **Frontend**
- **Framework**: Next.js 15.5.3 (React 19.1.0)
- **Styling**: CSS Modules with modern responsive design
- **State Management**: React Hooks (useState, useEffect, useCallback)
- **Wallet Integration**: Blade Wallet SDK (@bladelabs/blade-web3.js)

### **Backend / APIs**
- **Runtime**: Next.js API Routes (serverless functions)
- **Hedera SDK**: @hashgraph/sdk v2.49.0
- **DID SDK**: @hashgraph/did-sdk-js v0.1.1
- **AI Integration**: @huggingface/inference v4.12.0 (Inference Providers API)
- **IPFS Client**: @aws-sdk/client-s3 (Filebase S3-compatible)

### **Smart Contracts**
- **Language**: Solidity 0.8.19
- **Framework**: OpenZeppelin Contracts (ERC721, Ownable, ReentrancyGuard, Pausable)
- **HTS Integration**: Custom IHederaTokenService interface (precompile address 0x167)

### **Storage**
- **IPFS**: Filebase (S3-compatible gateway)
- **On-Chain**: Hedera File Service (HFS) for DID documents
- **Consensus**: Hedera Consensus Service (HCS) for attestations

---

## 🚀 Deployment & Setup

### **Prerequisites**

Before starting, ensure you have the following installed:

- **Node.js** v20.11.0 or higher
- **npm** v10.4.0 or higher
- **Git** for cloning the repository
- **Blade Wallet** browser extension
- **Hedera Testnet Account** with HBAR for testing

### **Step-by-Step Setup Instructions**

#### **1. Clone the Repository**

```bash
git clone https://github.com/getfunds/anft.git
cd anft
```

#### **2. Install Dependencies**

```bash
npm install
```

This will install all required packages including:
- Next.js and React
- Hedera SDK and Blade Wallet integration
- Hugging Face Inference client
- AWS S3 SDK (for Filebase IPFS)
- OpenZeppelin contracts (for smart contract compilation)

#### **3. Configure Environment Variables**

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in the required values:

```bash
# ============================================
# REQUIRED VARIABLES
# ============================================

# Network Configuration
NEXT_PUBLIC_HEDERA_NETWORK=testnet

# Marketplace Contract (deploy first, then add ID here)
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID=0.0.YOUR_MARKETPLACE_CONTRACT_ID

# Platform fee recipient (your Hedera account)
NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT=0.0.YOUR_FEE_RECIPIENT_ACCOUNT

# Hugging Face API Key
# Get from: https://huggingface.co/settings/tokens
NEXT_PUBLIC_HUGGING_FACE_API_KEY=hf_your_api_key_here

# Filebase IPFS Credentials
# Get from: https://console.filebase.com/keys
FILEBASE_ACCESS_KEY=your_filebase_access_key_here
FILEBASE_SECRET_KEY=your_filebase_secret_key_here
FILEBASE_BUCKET=anft-nfts



#### **4. Deploy Smart Contracts (First-Time Setup)**

**Option A: Deploy via Remix IDE (Recommended for testing)**

1. Open [Remix IDE](https://remix.ethereum.org/)
2. Create a new file: `NFTMarketplace.sol`
3. Copy the contents from `contracts/NFTMarketplace_HTS_Working.sol`
4. Compile with Solidity 0.8.19
5. Deploy using **Hedera Testnet** environment:
   - Select "Injected Provider" (connect Blade Wallet)
   - Constructor argument: Your platform fee recipient address (e.g., `0.0.4475114`)
   - Deploy and note the contract ID (e.g., `0.0.16436066`)
6. Add the contract ID to `.env.local` as `NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID`

#### **5. Create Filebase Account and Bucket**

1. Sign up at [Filebase](https://filebase.com/)
2. Navigate to **API Keys** and create a new S3-compatible key
3. Copy the Access Key and Secret Key to `.env.local`
4. Navigate to **Buckets** and create a new bucket named `anft-nfts` (or custom name)
5. Add the bucket name to `.env.local` as `FILEBASE_BUCKET`

#### **6. Get Hugging Face API Key**

1. Sign up at [Hugging Face](https://huggingface.co/)
2. Go to [Settings → Tokens](https://huggingface.co/settings/tokens)
3. Create a **Fine-grained token** with permission: "Make calls to Inference Providers"
4. Copy the token (starts with `hf_`) to `.env.local` as `NEXT_PUBLIC_HUGGING_FACE_API_KEY`

#### **7. Run the Development Server**
```bash
npm run dev
```

The application will start on **http://localhost:3000**

#### **8. Test the Application**

1. Open **http://localhost:3000** in your browser
2. Click **"Connect Wallet"** and connect your Blade Wallet
3. Navigate to **"Create NFT"** → Choose "AI Art" or "Digital Studio"
4. Create your first NFT (this will also create your DID automatically)
5. View your NFT in **"My NFTs"**
6. List it on the marketplace via **"Marketplace"**

**Built with ❤️ for the Hedera ecosystem**

*ANFT - Where Authenticity Meets Innovation*