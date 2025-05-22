import { Alchemy, Network } from "alchemy-sdk"

class BlockchainReviewService {
  private alchemy

  constructor() {
    // Configure Alchemy SDK
   const settings = {
  apiKey: "LRGHh1wMn01YEff8E9T2DhPih7ZGvaW_", // Replace with your Alchemy API Key.
  network: Network.MATIC_AMOY, // Replace with your network.
};

    this.alchemy = new Alchemy(settings)
  }

  // Store review data on the blockchain
  async submitReview(reviewData: any) {
    try {
      console.log("Submitting review to blockchain:", reviewData)

      // For a beginner-friendly implementation, we'll use a simplified approach:
      // 1. Create a hash of the review data
      const reviewString = JSON.stringify({
        jobId: reviewData.job_id,
        proposalId: reviewData.proposal_id,
        rating: reviewData.rating,
        reviewText: reviewData.review_text,
        reviewerId: reviewData.reviewer_id,
        revieweeId: reviewData.reviewee_id,
        timestamp: Date.now(),
      })

      // 2. In a real implementation with a smart contract, you would:
      //    - Send a transaction to your smart contract with this data
      //    - But for simplicity, we'll just simulate storing the hash

      // Simulate blockchain transaction delay
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Generate a transaction hash (in a real implementation, this would come from the blockchain)
      const txHash = this.generateTransactionHash()

      console.log("Review submitted to blockchain with transaction hash:", txHash)

      return {
        success: true,
        transactionHash: txHash,
        error: null,
      }
    } catch (error) {
      console.error("Error submitting review to blockchain:", error)
      return {
        success: false,
        transactionHash: null,
        error: error.message,
      }
    }
  }

  // Verify a review on the blockchain
  async verifyReview(transactionHash: string) {
    try {
      console.log("Verifying review on blockchain with hash:", transactionHash)

      // For this demo, we'll simulate the verification
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // For demo purposes, we'll just return true for valid-looking hashes
      const isValid = transactionHash.startsWith("0x") && transactionHash.length === 66

      return {
        verified: isValid,
        error: null,
      }
    } catch (error) {
      console.error("Error verifying review on blockchain:", error)
      return {
        verified: false,
        error: error.message,
      }
    }
  }

  // Generate a fake Ethereum-style transaction hash
  private generateTransactionHash() {
    const chars = "0123456789abcdef"
    let hash = "0x"

    // Generate a 64-character hash (32 bytes)
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)]
    }

    return hash
  }
}

export const blockchainReviewService = new BlockchainReviewService()
