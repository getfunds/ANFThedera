// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title NFTMarketplace - HTS Fixed Version
 * @dev NFT marketplace with proper HTS NFT transfer handling
 * This version includes enhanced approval checking and better error handling for HTS NFTs
 */
contract NFTMarketplace is ReentrancyGuard, Ownable, Pausable {
    
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
    
    struct Offer {
        uint256 listingId;
        address buyer;
        uint256 amount;
        uint256 expirationTime;
        bool isActive;
    }
    
    // ============ STATE VARIABLES ============
    
    uint256 private _listingIdCounter = 1;
    uint256 private _offerIdCounter = 1;
    
    // Platform fee (in basis points, 250 = 2.5%)
    uint256 public platformFeePercentage = 250;
    address public platformFeeRecipient;
    
    // Minimum listing duration (24 hours)
    uint256 public constant MIN_LISTING_DURATION = 86400;
    
    // Mappings
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Offer) public offers;
    mapping(address => uint256[]) public userListings;
    mapping(address => uint256[]) public userOffers;
    
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
    
    event BidPlaced(
        uint256 indexed listingId,
        address indexed bidder,
        uint256 amount
    );
    
    event ListingCancelled(uint256 indexed listingId);
    event OfferMade(uint256 indexed offerId, uint256 indexed listingId, address indexed buyer, uint256 amount);
    event OfferAccepted(uint256 indexed offerId, uint256 indexed listingId);
    event OfferCancelled(uint256 indexed offerId);
    
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
        
        IERC721 nftContract = IERC721(tokenAddress);
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not token owner");
        
        // Enhanced approval checking for HTS NFTs
        bool isApproved = checkNFTApproval(tokenAddress, tokenId, msg.sender);
        require(isApproved, "NFT not approved for marketplace - use setApprovalForAll or approve this contract");
        
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
        
        _executePurchaseWithEnhancedChecks(listingId, msg.sender, listing.price);
        
        // Refund excess payment
        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }
    }
    
    /**
     * @dev Execute purchase with enhanced HTS NFT handling
     */
    function _executePurchaseWithEnhancedChecks(
        uint256 listingId,
        address buyer,
        uint256 totalAmount
    ) internal {
        Listing storage listing = listings[listingId];
        
        // Pre-transfer validation
        IERC721 nftContract = IERC721(listing.tokenAddress);
        
        // Verify seller still owns the NFT
        require(nftContract.ownerOf(listing.tokenId) == listing.seller, "Seller no longer owns NFT");
        
        // Verify marketplace is still approved
        bool isApproved = checkNFTApproval(listing.tokenAddress, listing.tokenId, listing.seller);
        require(isApproved, "Marketplace no longer approved for this NFT");
        
        // Calculate platform fee
        uint256 platformFee = (totalAmount * platformFeePercentage) / 10000;
        uint256 sellerAmount = totalAmount - platformFee;
        
        // Attempt NFT transfer with detailed error reporting
        bool transferSuccess = false;
        string memory detailedError = "";
        
        // Method 1: Try safeTransferFrom first
        try nftContract.safeTransferFrom(listing.seller, buyer, listing.tokenId) {
            transferSuccess = true;
        } catch Error(string memory reason) {
            detailedError = string(abi.encodePacked("safeTransferFrom failed: ", reason));
        } catch (bytes memory lowLevelData) {
            detailedError = string(abi.encodePacked("safeTransferFrom failed with low-level error: ", lowLevelData));
        }
        
        // Method 2: If safeTransferFrom failed, try regular transferFrom
        if (!transferSuccess) {
            try nftContract.transferFrom(listing.seller, buyer, listing.tokenId) {
                transferSuccess = true;
            } catch Error(string memory reason) {
                detailedError = string(abi.encodePacked(detailedError, " | transferFrom failed: ", reason));
            } catch (bytes memory lowLevelData) {
                detailedError = string(abi.encodePacked(detailedError, " | transferFrom failed with low-level error: ", lowLevelData));
            }
        }
        
        // If both methods failed, provide detailed error information
        require(transferSuccess, string(abi.encodePacked(
            "HTS NFT transfer failed. This usually means: ",
            "1) Seller needs to approve marketplace using setApprovalForAll, ",
            "2) NFT ownership changed, or ",
            "3) HTS token requires different transfer method. ",
            "Details: ", detailedError
        )));
        
        // Verify transfer was successful by checking new owner
        require(nftContract.ownerOf(listing.tokenId) == buyer, "Transfer verification failed - NFT not in buyer's wallet");
        
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
     * @dev Enhanced NFT approval checking for HTS compatibility
     */
    function checkNFTApproval(address tokenAddress, uint256 tokenId, address owner) 
        public 
        view 
        returns (bool) 
    {
        IERC721 nftContract = IERC721(tokenAddress);
        
        // Method 1: Check if marketplace is approved for all NFTs
        try nftContract.isApprovedForAll(owner, address(this)) returns (bool approvedForAll) {
            if (approvedForAll) {
                return true;
            }
        } catch {
            // If isApprovedForAll fails, continue to next check
        }
        
        // Method 2: Check if marketplace is approved for this specific NFT
        try nftContract.getApproved(tokenId) returns (address approvedAddress) {
            if (approvedAddress == address(this)) {
                return true;
            }
        } catch {
            // If getApproved fails, return false
        }
        
        return false;
    }
    
    /**
     * @dev Get approval status with detailed information
     */
    function checkNFTApprovalDetailed(address tokenAddress, uint256 tokenId, address owner) 
        external 
        view 
        returns (bool isApproved, string memory approvalStatus) 
    {
        IERC721 nftContract = IERC721(tokenAddress);
        
        bool approvedForAll = false;
        address specificApproval = address(0);
        
        // Check isApprovedForAll with error handling
        try nftContract.isApprovedForAll(owner, address(this)) returns (bool result) {
            approvedForAll = result;
        } catch {
            return (false, "Failed to check isApprovedForAll");
        }
        
        // Check getApproved with error handling
        try nftContract.getApproved(tokenId) returns (address result) {
            specificApproval = result;
        } catch {
            return (false, "Failed to check getApproved");
        }
        
        bool specificApproved = (specificApproval == address(this));
        
        if (approvedForAll) {
            return (true, "Approved for all NFTs (setApprovalForAll)");
        } else if (specificApproved) {
            return (true, "Approved for this specific NFT");
        } else {
            return (false, string(abi.encodePacked(
                "Not approved. ApprovedForAll: ", approvedForAll ? "true" : "false",
                ", SpecificApproval: ", specificApproval == address(0) ? "none" : "different address"
            )));
        }
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
