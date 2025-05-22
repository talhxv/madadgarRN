import { ethers } from "ethers"

// Your deployed contract address and ABI
const CONTRACT_ADDRESS = "0x101e0b2fcc83097de49ecd072bec83ab8d27efec"
const CONTRACT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "reviewer", "type": "address" },
      { "indexed": true, "internalType": "bytes32", "name": "reviewHash", "type": "bytes32" },
      { "indexed": false, "internalType": "string", "name": "supabaseId", "type": "string" }
    ],
    "name": "ReviewStored",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "reviewHash", "type": "bytes32" },
      { "internalType": "string", "name": "supabaseId", "type": "string" }
    ],
    "name": "storeReview",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "reviewHash", "type": "bytes32" }
    ],
    "name": "getSupabaseId",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "reviewHash", "type": "bytes32" }
    ],
    "name": "isReviewStored",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "", "type": "bytes32" }
    ],
    "name": "reviewSupabaseIds",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
]

class BlockchainReviewService {
  // Submit review to blockchain using MetaMask signer
  async submitReview(reviewData: { supabaseId: string }) {
    try {
      // 1. Get MetaMask signer
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      // 2. Prepare contract
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

      // 3. Hash the Supabase ID (or your unique review string)
      const reviewHash = ethers.keccak256(ethers.toUtf8Bytes(reviewData.supabaseId))

      // 4. Send transaction
      const tx = await contract.storeReview(reviewHash, reviewData.supabaseId)
      await tx.wait()

      return {
        success: true,
        transactionHash: tx.hash,
        error: null,
      }
    } catch (error) {
      return {
        success: false,
        transactionHash: null,
        error: error.message,
      }
    }
  }

  // Verify a review on the blockchain using Alchemy provider
  async verifyReview(supabaseId: string) {
    try {
      // 1. Use Alchemy as a provider (read-only)
      const provider = new ethers.JsonRpcProvider("https://polygon-amoy.g.alchemy.com/v2/LRGHh1wMn01YEff8E9T2DhPih7ZGvaW_")
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)

      // 2. Hash the Supabase ID
      const reviewHash = ethers.keccak256(ethers.toUtf8Bytes(supabaseId))

      // 3. Call the contract
      const isStored = await contract.isReviewStored(reviewHash)
      return {
        verified: isStored,
        error: null,
      }
    } catch (error) {
      return {
        verified: false,
        error: error.message,
      }
    }
  }
}

export const blockchainReviewService = new BlockchainReviewService()