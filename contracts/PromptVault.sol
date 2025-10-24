// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract PromptVault is Ownable, ReentrancyGuard {
    
    mapping(bytes32 => string) private _encryptedPrompts;
    mapping(bytes32 => address) private _promptCreators;
    mapping(bytes32 => bool) private _promptExists;
    
    event PromptStored(
        address indexed tokenId, 
        uint256 indexed serialNumber, 
        address indexed creator,
        bytes32 promptKey
    );
    
    event PromptAccessed(
        address indexed tokenId,
        uint256 indexed serialNumber,
        address indexed accessor,
        bytes32 promptKey
    );

    constructor() Ownable(msg.sender) {}

    function storePrompt(
        address tokenId,
        uint256 serialNumber,
        string memory encryptedPrompt
    ) external nonReentrant {
        require(bytes(encryptedPrompt).length > 0, "Encrypted prompt cannot be empty");
        
        bytes32 promptKey = _generatePromptKey(tokenId, serialNumber);
        
        require(
            !_promptExists[promptKey] || _promptCreators[promptKey] == msg.sender,
            "Prompt already exists for this NFT"
        );
        
        _encryptedPrompts[promptKey] = encryptedPrompt;
        _promptCreators[promptKey] = msg.sender;
        _promptExists[promptKey] = true;
        
        emit PromptStored(tokenId, serialNumber, msg.sender, promptKey);
    }
    function getPrompt(
        address tokenId,
        uint256 serialNumber,
        address nftOwner
    ) external nonReentrant returns (string memory) {
        bytes32 promptKey = _generatePromptKey(tokenId, serialNumber);
        
        require(_promptExists[promptKey], "No prompt stored for this NFT");
        require(msg.sender == nftOwner, "Only NFT owner can access the prompt");
        
        emit PromptAccessed(tokenId, serialNumber, msg.sender, promptKey);
        
        return _encryptedPrompts[promptKey];
    }
    function promptExists(
        address tokenId,
        uint256 serialNumber
    ) external view returns (bool) {
        bytes32 promptKey = _generatePromptKey(tokenId, serialNumber);
        return _promptExists[promptKey];
    }

    function getPromptCreator(
        address tokenId,
        uint256 serialNumber
    ) external view returns (address) {
        bytes32 promptKey = _generatePromptKey(tokenId, serialNumber);
        require(_promptExists[promptKey], "No prompt stored for this NFT");
        return _promptCreators[promptKey];
    }
    function updatePrompt(
        address tokenId,
        uint256 serialNumber,
        string memory newEncryptedPrompt
    ) external nonReentrant {
        bytes32 promptKey = _generatePromptKey(tokenId, serialNumber);
        
        require(_promptExists[promptKey], "No prompt stored for this NFT");
        require(_promptCreators[promptKey] == msg.sender, "Only creator can update prompt");
        require(bytes(newEncryptedPrompt).length > 0, "New prompt cannot be empty");
        
        _encryptedPrompts[promptKey] = newEncryptedPrompt;
        
        emit PromptStored(tokenId, serialNumber, msg.sender, promptKey);
    }

    function _generatePromptKey(
        address tokenId,
        uint256 serialNumber
    ) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenId, serialNumber));
    }

    function getPromptKey(
        address tokenId,
        uint256 serialNumber
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenId, serialNumber));
    }

    function removePrompt(
        address tokenId,
        uint256 serialNumber
    ) external onlyOwner {
        bytes32 promptKey = _generatePromptKey(tokenId, serialNumber);
        require(_promptExists[promptKey], "No prompt stored for this NFT");
        
        delete _encryptedPrompts[promptKey];
        delete _promptCreators[promptKey];
        _promptExists[promptKey] = false;
    }

    function getContractInfo() external pure returns (string memory, string memory) {
        return ("PromptVault", "1.0.0");
    }
}
