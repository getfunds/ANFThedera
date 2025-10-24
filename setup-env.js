#!/usr/bin/env node

/**
 * Environment Setup Script for AI Art NFT Marketplace
 * 
 * This script helps you set up your .env.local file with the correct configuration.
 * Run: node setup-env.js
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function setupEnvironment() {
  console.log("🚀 AI Art NFT Marketplace - Environment Setup");
  console.log("=".repeat(50));
  
  try {
    // Check if .env.local already exists
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const overwrite = await question("⚠️  .env.local already exists. Overwrite? (y/N): ");
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        console.log("❌ Setup cancelled.");
        process.exit(0);
      }
    }
    
    console.log("\n📋 Please provide the following information:\n");
    
    // Hedera Configuration
    console.log("🔹 Hedera Configuration:");
    const network = await question("Network (testnet/mainnet) [testnet]: ") || "testnet";
    
    // Smart Contract Configuration
    console.log("\n🔹 Smart Contract Configuration (add after deployment):");
    const contractId = await question("PromptVault Contract ID (e.g., 0.0.789012) [leave empty]: ");
    
    console.log("\n💡 Note: No operator credentials needed!");
    console.log("   Creators manage their own collections through connected wallets.");
    
    // API Configuration
    console.log("\n🔹 API Configuration:");
    const hfApiKey = await question("Hugging Face API Key: ");
    const pinataApiKey = await question("Pinata API Key (optional): ");
    const pinataSecret = await question("Pinata Secret Key (optional): ");
    
    // Application Configuration
    console.log("\n🔹 Application Configuration:");
    const appName = await question("App Name [AI Art NFT Marketplace]: ") || "AI Art NFT Marketplace";
    const appUrl = await question("App URL [http://localhost:3000]: ") || "http://localhost:3000";
    
    // Development Configuration
    console.log("\n🔹 Development Configuration:");
    const useMockData = await question("Use mock data for testing? (y/N): ");
    const debugMode = await question("Enable debug mode? (Y/n): ");
    
    // Generate .env.local content
    const envContent = `# Hedera Network Configuration
NEXT_PUBLIC_HEDERA_NETWORK=${network}

# Smart Contract Configuration (Add after deployment)
NEXT_PUBLIC_PROMPT_VAULT_CONTRACT_ID=${contractId || '0.0.CONTRACT_ID_HERE'}

# NOTE: No operator credentials needed! 
# Creators manage their own collections and NFTs through connected wallets

# Hugging Face API Configuration
NEXT_PUBLIC_HUGGING_FACE_API_KEY=${hfApiKey || 'your_hugging_face_api_key_here'}

# IPFS Configuration (Pinata)
NEXT_PUBLIC_PINATA_API_KEY=${pinataApiKey || 'your_pinata_api_key_here'}
NEXT_PUBLIC_PINATA_SECRET_KEY=${pinataSecret || 'your_pinata_secret_key_here'}

# Application Configuration
NEXT_PUBLIC_APP_NAME="${appName}"
NEXT_PUBLIC_APP_URL=${appUrl}

# Development/Testing Flags
NEXT_PUBLIC_USE_MOCK_DATA=${useMockData.toLowerCase() === 'y' || useMockData.toLowerCase() === 'yes' ? 'true' : 'false'}
NEXT_PUBLIC_DEBUG_MODE=${debugMode.toLowerCase() !== 'n' && debugMode.toLowerCase() !== 'no' ? 'true' : 'false'}

# Generated on: ${new Date().toISOString()}
`;
    
    // Write .env.local file
    fs.writeFileSync(envPath, envContent);
    
    console.log("\n✅ Environment setup completed!");
    console.log(`📁 Created: ${envPath}`);
    
    // Show next steps
    console.log("\n🔧 Next Steps:");
    console.log("1. Review your .env.local file");
    
    if (!contractId || contractId === '0.0.CONTRACT_ID_HERE') {
      console.log("2. Deploy PromptVault Contract and update NEXT_PUBLIC_PROMPT_VAULT_CONTRACT_ID");
    }
    
    console.log("3. Run 'npm run dev' to start the application");
    console.log("4. Check CREATOR_GUIDE.md for the new creator-centric workflow");
    console.log("5. Creators will create their own collections when minting NFTs");
    
    // Security reminder
    console.log("\n⚠️  Security Reminder:");
    console.log("   - Never commit .env.local to version control");
    console.log("   - Creators manage their own private keys through wallets");
    console.log("   - Use testnet for development and testing");
    
  } catch (error) {
    console.error("❌ Setup failed:", error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run setup
setupEnvironment();
