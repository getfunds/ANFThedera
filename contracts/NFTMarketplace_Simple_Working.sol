// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Import OpenZeppelin contracts
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

// Hedera Token Service interface for system contract calls
interface IHederaTokenService {
    function redirectForToken(address token, bytes calldata encodedFunctionSelector) external returns (int64 responseCode, bytes memory response);
    function transferNFT(address token, address from, address to, int64 serialNumber) external returns (int64 responseCode);
}

/**
 * @title NFTMarketplace - Simple Working Version
 * @dev NFT marketplace that works reliably with HTS NFTs
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
     * @dev Create a new listing - simplified version
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
        
        // Basic ownership verification using standard ERC721
        IERC721 nftContract = IERC721(tokenAddress);
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not token owner");
        
        // Basic approval verification using standard ERC721
        require(
            nftContract.isApprovedForAll(msg.sender, address(this)) ||
            nftContract.getApproved(tokenId) == address(this),
            "Contract not approved"
        );
        
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
        
        require(transferSuccess, "HTS NFT transfer failed");
        
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
     * @dev Transfer HTS NFT using system contract - simplified version
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
            // Method 3: Fallback to standard ERC721 transfer
            try IERC721(tokenAddress).transferFrom(from, to, tokenId) {
                return true;
            } catch {
                return false;
            }
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
    
    /**
     * @dev Public function to check NFT approval (simplified)
     */
    function checkNFTApproval(address tokenAddress, uint256 tokenId, address owner) 
        external 
        view
        returns (bool approved, string memory status) 
    {
        IERC721 nftContract = IERC721(tokenAddress);
        
        try nftContract.isApprovedForAll(owner, address(this)) returns (bool approvedForAll) {
            if (approvedForAll) {
                return (true, "NFT is approved for all");
            }
        } catch {}
        
        try nftContract.getApproved(tokenId) returns (address approvedAddress) {
            if (approvedAddress == address(this)) {
                return (true, "NFT is specifically approved");
            }
        } catch {}
        
        return (false, "NFT is not approved - use setApprovalForAll or approve");
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
