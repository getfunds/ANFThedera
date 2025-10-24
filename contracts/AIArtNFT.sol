// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract AIArtNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    // Mapping from token ID to the encrypted prompt used to generate the NFT
    mapping(uint256 => string) private _tokenPrompts;
    
    // Mapping from token ID to creator address
    mapping(uint256 => address) private _tokenCreators;
    
    // Mapping from token ID to sale status and price
    mapping(uint256 => bool) private _tokenForSale;
    mapping(uint256 => uint256) private _tokenPrices;
    
    // Events
    event NFTMinted(uint256 indexed tokenId, address indexed creator, string tokenURI);
    event NFTListedForSale(uint256 indexed tokenId, uint256 price);
    event NFTSold(uint256 indexed tokenId, address indexed from, address indexed to, uint256 price);
    event NFTRemovedFromSale(uint256 indexed tokenId);

    constructor() ERC721("AI Art NFT", "AINFT") {}

    /**
     * @dev Mint a new NFT with associated prompt
     * @param to The address to mint the NFT to
     * @param tokenURI The metadata URI for the NFT
     * @param encryptedPrompt The encrypted prompt used to generate the artwork
     */
    function mintNFT(
        address to,
        string memory tokenURI,
        string memory encryptedPrompt
    ) public returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        _tokenPrompts[tokenId] = encryptedPrompt;
        _tokenCreators[tokenId] = msg.sender;
        
        emit NFTMinted(tokenId, msg.sender, tokenURI);
        return tokenId;
    }

    /**
     * @dev Get the prompt for a token (only accessible by token owner)
     * @param tokenId The token ID to get the prompt for
     */
    function getTokenPrompt(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Only token owner can access the prompt");
        return _tokenPrompts[tokenId];
    }

    /**
     * @dev Get the creator of a token
     * @param tokenId The token ID to get the creator for
     */
    function getTokenCreator(uint256 tokenId) public view returns (address) {
        require(_exists(tokenId), "Token does not exist");
        return _tokenCreators[tokenId];
    }

    /**
     * @dev List an NFT for sale
     * @param tokenId The token ID to list for sale
     * @param price The price in wei
     */
    function listForSale(uint256 tokenId, uint256 price) public {
        require(ownerOf(tokenId) == msg.sender, "Only token owner can list for sale");
        require(price > 0, "Price must be greater than 0");
        
        _tokenForSale[tokenId] = true;
        _tokenPrices[tokenId] = price;
        
        emit NFTListedForSale(tokenId, price);
    }

    /**
     * @dev Remove an NFT from sale
     * @param tokenId The token ID to remove from sale
     */
    function removeFromSale(uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender, "Only token owner can remove from sale");
        
        _tokenForSale[tokenId] = false;
        _tokenPrices[tokenId] = 0;
        
        emit NFTRemovedFromSale(tokenId);
    }

    /**
     * @dev Buy an NFT that's listed for sale
     * @param tokenId The token ID to buy
     */
    function buyNFT(uint256 tokenId) public payable {
        require(_exists(tokenId), "Token does not exist");
        require(_tokenForSale[tokenId], "Token is not for sale");
        require(msg.value >= _tokenPrices[tokenId], "Insufficient payment");
        require(ownerOf(tokenId) != msg.sender, "Cannot buy your own NFT");
        
        address seller = ownerOf(tokenId);
        uint256 price = _tokenPrices[tokenId];
        
        // Remove from sale
        _tokenForSale[tokenId] = false;
        _tokenPrices[tokenId] = 0;
        
        // Transfer NFT
        _transfer(seller, msg.sender, tokenId);
        
        // Transfer payment to seller
        payable(seller).transfer(price);
        
        // Refund excess payment
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit NFTSold(tokenId, seller, msg.sender, price);
    }

    /**
     * @dev Check if a token is for sale
     * @param tokenId The token ID to check
     */
    function isTokenForSale(uint256 tokenId) public view returns (bool) {
        return _tokenForSale[tokenId];
    }

    /**
     * @dev Get the price of a token
     * @param tokenId The token ID to get the price for
     */
    function getTokenPrice(uint256 tokenId) public view returns (uint256) {
        return _tokenPrices[tokenId];
    }

    /**
     * @dev Get all tokens owned by an address
     * @param owner The address to get tokens for
     */
    function getTokensByOwner(address owner) public view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](tokenCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < _tokenIdCounter.current(); i++) {
            if (_exists(i) && ownerOf(i) == owner) {
                tokenIds[index] = i;
                index++;
            }
        }
        
        return tokenIds;
    }

    /**
     * @dev Get all tokens that are for sale
     */
    function getTokensForSale() public view returns (uint256[] memory, uint256[] memory) {
        uint256 totalTokens = _tokenIdCounter.current();
        uint256 forSaleCount = 0;
        
        // Count tokens for sale
        for (uint256 i = 0; i < totalTokens; i++) {
            if (_exists(i) && _tokenForSale[i]) {
                forSaleCount++;
            }
        }
        
        uint256[] memory tokenIds = new uint256[](forSaleCount);
        uint256[] memory prices = new uint256[](forSaleCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < totalTokens; i++) {
            if (_exists(i) && _tokenForSale[i]) {
                tokenIds[index] = i;
                prices[index] = _tokenPrices[i];
                index++;
            }
        }
        
        return (tokenIds, prices);
    }

    // Override required functions
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
