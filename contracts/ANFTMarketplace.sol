// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

// Import Hedera Token Service interface for system contract calls
interface IHederaTokenService {
    function redirectForToken(address token, bytes calldata encodedFunctionSelector) external returns (int64 responseCode, bytes memory response);
    function transferToken(address token, address from, address to, int64 amount) external returns (int64 responseCode);
    function transferNFT(address token, address from, address to, int64 serialNumber) external returns (int64 responseCode);
}

/**
 * @title NFTMarketplace - HTS Working Version
 * @dev NFT marketplace that properly handles HTS NFT transfers using Hedera system contracts
 */
contract NFTMarketplace is ReentrancyGuard, Ownable, Pausable {
    
    // Hedera Token Service system contract address
    address constant HTS_PRECOMPILE_ADDRESS = address(0x167);
    IHederaTokenService constant HTS = IHederaTokenService(HTS_PRECOMPILE_ADDRESS);
    
    // ============ STRUCTS ============
    
    struct Listing {
        address tokenAddress;
        uint256 tokenId;
        address seller;
        uint256 price;
        uint256 expirationTime;
        bool isActive;
        bool isAuction;
        uint256 highestBid;
        address highestBidder;
    }
    
    // ============ STATE VARIABLES ============
    
    uint256 private _listingIdCounter = 1;
    
    // Platform fee (in basis points, 250 = 2.5%)
    uint256 public platformFeePercentage = 250;
    address public platformFeeRecipient;
    
    // Minimum listing duration (24 hours)
    uint256 public constant MIN_LISTING_DURATION = 86400;
    
    // Mappings
    mapping(uint256 => Listing) public listings;
    mapping(address => uint256[]) public userListings;
    
    // Active listings array for iteration
    uint256[] public activeListings;
    
    // ============ EVENTS ============
    
    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        address indexed tokenAddress,
        uint256 tokenId,
        uint256 price,
        bool isAuction
    );
    
    event NFTPurchased(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 price
    );
    
    event ListingCancelled(uint256 indexed listingId);
    
    // ============ CONSTRUCTOR ============
    
    constructor(address _platformFeeRecipient) Ownable(msg.sender) {
        require(_platformFeeRecipient != address(0), "Invalid fee recipient");
        platformFeeRecipient = _platformFeeRecipient;
    }
    
    // ============ CORE FUNCTIONS ============
    
    /**
     * @dev Create a new listing
     */
    function createListing(
        address tokenAddress,
        uint256 tokenId,
        uint256 price,
        uint256 duration,
        bool isAuction
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(tokenAddress != address(0), "Invalid token address");
        require(price > 0, "Price must be greater than 0");
        require(duration >= MIN_LISTING_DURATION, "Duration too short");
        
        // Verify ownership using HTS system contract
        require(_verifyNFTOwnership(tokenAddress, tokenId, msg.sender), "Not token owner");
        
        // Verify approval using HTS system contract
        require(_checkHTSApproval(tokenAddress, tokenId, msg.sender), "NFT not approved for marketplace");
        
        uint256 listingId = _listingIdCounter++;
        
        listings[listingId] = Listing({
            tokenAddress: tokenAddress,
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            expirationTime: block.timestamp + duration,
            isActive: true,
            isAuction: isAuction,
            highestBid: 0,
            highestBidder: address(0)
        });
        
        activeListings.push(listingId);
        userListings[msg.sender].push(listingId);
        
        emit ListingCreated(listingId, msg.sender, tokenAddress, tokenId, price, isAuction);
        return listingId;
    }
    
    /**
     * @dev Purchase an NFT
     */
    function purchaseNFT(uint256 listingId) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
    {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Listing not active");
        require(block.timestamp < listing.expirationTime, "Listing expired");
        require(!listing.isAuction, "Use bidding for auctions");
        require(msg.value >= listing.price, "Insufficient payment");
        require(listing.seller != msg.sender, "Cannot buy own listing");
        
        _executePurchaseWithHTSTransfer(listingId, msg.sender, listing.price);
        
        // Refund excess payment
        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }
    }
    
    /**
     * @dev Execute purchase with HTS-compatible NFT transfer
     */
    function _executePurchaseWithHTSTransfer(
        uint256 listingId,
        address buyer,
        uint256 totalAmount
    ) internal {
        Listing storage listing = listings[listingId];
        
        // Pre-transfer validation
        require(_verifyNFTOwnership(listing.tokenAddress, listing.tokenId, listing.seller), "Seller no longer owns NFT");
        require(_checkHTSApproval(listing.tokenAddress, listing.tokenId, listing.seller), "Marketplace no longer approved");
        
        // Calculate platform fee
        uint256 platformFee = (totalAmount * platformFeePercentage) / 10000;
        uint256 sellerAmount = totalAmount - platformFee;
        
        // Execute HTS NFT transfer using system contract
        bool transferSuccess = _transferHTSNFT(
            listing.tokenAddress,
            listing.tokenId,
            listing.seller,
            buyer
        );
        
        require(transferSuccess, "HTS NFT transfer failed - this usually means the seller hasn't approved the marketplace or the NFT is not an HTS token");
        
        // Verify transfer was successful
        require(_verifyNFTOwnership(listing.tokenAddress, listing.tokenId, buyer), "Transfer verification failed - NFT not in buyer's wallet");
        
        // Distribute payments
        if (platformFee > 0) {
            payable(platformFeeRecipient).transfer(platformFee);
        }
        
        payable(listing.seller).transfer(sellerAmount);
        
        // Mark listing as completed
        listing.isActive = false;
        _removeFromActiveListings(listingId);
        
        emit NFTPurchased(listingId, buyer, listing.seller, totalAmount);
    }
    
    /**
     * @dev Transfer HTS NFT using system contract
     */
    function _transferHTSNFT(
        address tokenAddress,
        uint256 tokenId,
        address from,
        address to
    ) internal returns (bool) {
        // Method 1: Try HTS transferNFT function
        try HTS.transferNFT(
            tokenAddress,
            from,
            to,
            int64(uint64(tokenId))
        ) returns (int64 responseCode) {
            // Response code 22 indicates SUCCESS
            if (responseCode == 22) {
                return true;
            }
        } catch {
            // If direct transfer fails, try method 2
        }
        
        // Method 2: Try redirectForToken with transferFrom
        bytes memory transferFromCall = abi.encodeWithSignature(
            "transferFrom(address,address,uint256)",
            from,
            to,
            tokenId
        );
        
        try HTS.redirectForToken(
            tokenAddress,
            transferFromCall
        ) returns (int64 redirectCode, bytes memory) {
            // Response code 22 indicates SUCCESS
            return redirectCode == 22;
        } catch {
            return false;
        }
    }
    
    /**
     * @dev Verify NFT ownership using HTS system contract
     */
    function _verifyNFTOwnership(
        address tokenAddress,
        uint256 tokenId,
        address expectedOwner
    ) internal returns (bool) {
        bytes memory ownerOfCall = abi.encodeWithSignature(
            "ownerOf(uint256)",
            tokenId
        );
        
        try HTS.redirectForToken(
            tokenAddress,
            ownerOfCall
        ) returns (int64 responseCode, bytes memory result) {
            if (responseCode == 22 && result.length > 0) {
                address actualOwner = abi.decode(result, (address));
                return actualOwner == expectedOwner;
            }
            return false;
        } catch {
            return false;
        }
    }
    
    /**
     * @dev Check HTS approval using system contract
     */
    function _checkHTSApproval(
        address tokenAddress,
        uint256 tokenId,
        address owner
    ) internal returns (bool) {
        // Check isApprovedForAll
        bytes memory approvedForAllCall = abi.encodeWithSignature(
            "isApprovedForAll(address,address)",
            owner,
            address(this)
        );
        
        try HTS.redirectForToken(
            tokenAddress,
            approvedForAllCall
        ) returns (int64 responseCode1, bytes memory result1) {
            if (responseCode1 == 22 && result1.length > 0) {
                bool approvedForAll = abi.decode(result1, (bool));
                if (approvedForAll) {
                    return true;
                }
            }
        } catch {
            // Continue to specific approval check
        }
        
        // Check specific approval
        bytes memory getApprovedCall = abi.encodeWithSignature(
            "getApproved(uint256)",
            tokenId
        );
        
        try HTS.redirectForToken(
            tokenAddress,
            getApprovedCall
        ) returns (int64 responseCode2, bytes memory result2) {
            if (responseCode2 == 22 && result2.length > 0) {
                address approvedAddress = abi.decode(result2, (address));
                return approvedAddress == address(this);
            }
        } catch {
            // Both checks failed
        }
        
        return false;
    }
    
    /**
     * @dev Cancel a listing
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.isActive, "Listing not active");
        require(listing.seller == msg.sender || owner() == msg.sender, "Not authorized");
        
        listing.isActive = false;
        _removeFromActiveListings(listingId);
        
        emit ListingCancelled(listingId);
    }
    
    /**
     * @dev Remove listing from active array
     */
    function _removeFromActiveListings(uint256 listingId) internal {
        for (uint256 i = 0; i < activeListings.length; i++) {
            if (activeListings[i] == listingId) {
                activeListings[i] = activeListings[activeListings.length - 1];
                activeListings.pop();
                break;
            }
        }
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get active listings count
     */
    function getActiveListingsCount() external view returns (uint256) {
        return activeListings.length;
    }
    
    /**
     * @dev Get active listing ID by index
     */
    function getActiveListingId(uint256 index) external view returns (uint256) {
        require(index < activeListings.length, "Index out of bounds");
        return activeListings[index];
    }
    
    /**
     * @dev Get listing details
     */
    function getListing(uint256 listingId) external view returns (
        address tokenAddress,
        uint256 tokenId,
        address seller,
        uint256 price,
        uint256 expirationTime,
        bool isActive,
        bool isAuction,
        uint256 highestBid,
        address highestBidder
    ) {
        Listing storage listing = listings[listingId];
        return (
            listing.tokenAddress,
            listing.tokenId,
            listing.seller,
            listing.price,
            listing.expirationTime,
            listing.isActive,
            listing.isAuction,
            listing.highestBid,
            listing.highestBidder
        );
    }
    
    /**
     * @dev Public function to check NFT approval (for debugging)
     */
    function checkNFTApproval(address tokenAddress, uint256 tokenId, address owner) 
        external 
        returns (bool approved, string memory status) 
    {
        bool isApproved = _checkHTSApproval(tokenAddress, tokenId, owner);
        
        if (isApproved) {
            return (true, "NFT is approved for marketplace");
        } else {
            return (false, "NFT is not approved - seller needs to use setApprovalForAll or approve this contract");
        }
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Update platform fee
     */
    function setPlatformFeePercentage(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1000, "Fee too high (max 10%)");
        platformFeePercentage = _feePercentage;
    }
    
    /**
     * @dev Update platform fee recipient
     */
    function setPlatformFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        platformFeeRecipient = _feeRecipient;
    }
    
    /**
     * @dev Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency withdraw (only for stuck funds)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
