import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "../components/Navbar";
import { WalletProvider } from "../context/WalletContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "AI Art NFT Marketplace - Hedera",
  description: "Create, mint, and trade AI-generated NFTs on the Hedera network",
  keywords: "NFT, AI Art, Hedera, Blockchain, Digital Art, Marketplace",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable}`}>
        <WalletProvider>
          <div className="layout-container">
            <Navbar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
