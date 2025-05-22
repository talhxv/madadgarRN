"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  Linking,
  Dimensions,
} from "react-native"
import { supabase } from "@/lib/supabase"
import { Star, X, CheckCircle, Shield, ExternalLink } from "lucide-react-native"
import { blockchainReviewService } from "@/lib/blockchain-review-service"

export const ReviewModal = ({
  isVisible,
  onClose,
  chatId,
  jobId,
  proposalId,
  isJobOwner,
  freelancerId,
  clientId,
  onReviewSubmitted,
}) => {
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [transactionHash, setTransactionHash] = useState("")
  const [animation] = useState(new Animated.Value(0))
  const { height: screenHeight } = Dimensions.get("window")

  // Reset form when modal opens
  useEffect(() => {
    if (isVisible) {
      setRating(0)
      setReviewText("")
    }
  }, [isVisible])

  // Animation for the modal
  useEffect(() => {
    Animated.timing(animation, {
      toValue: isVisible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [isVisible, animation])

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  })

  const handleRatingPress = (selectedRating) => {
    setRating(selectedRating)
  }

  const submitReview = async () => {
    if (rating === 0) {
      Alert.alert("Error", "Please select a rating")
      return
    }

    if (!reviewText.trim()) {
      Alert.alert("Error", "Please provide a review message")
      return
    }

    try {
      setSubmitting(true)

      // Create review data
      const reviewData = {
        job_id: jobId,
        proposal_id: proposalId,
        chat_id: chatId,
        reviewer_id: isJobOwner ? clientId : freelancerId,
        reviewee_id: isJobOwner ? freelancerId : clientId,
        rating,
        review_text: reviewText,
        reviewer_type: isJobOwner ? "client" : "freelancer",
        created_at: new Date().toISOString(),
      }

      // Submit to blockchain service
      const { transactionHash: txHash, error: blockchainError } = await blockchainReviewService.submitReview(reviewData)

      if (blockchainError) {
        throw new Error(`Blockchain error: ${blockchainError}`)
      }

      // Store the review in Supabase with the blockchain transaction hash
      const { error: supabaseError } = await supabase.from("job_reviews").insert({
        ...reviewData,
        blockchain_tx_hash: txHash,
        blockchain_verified: true,
      })

      if (supabaseError) {
        throw supabaseError
      }

      // Add system message to chat
      await supabase.from("messages").insert({
        chat_id: chatId,
        content: `${isJobOwner ? "Client" : "Freelancer"} submitted a ${rating}-star review for this job`,
        is_system: true,
        created_at: new Date().toISOString(),
      })

      // Show success and store transaction hash for viewing
      setTransactionHash(txHash)
      setShowSuccessModal(true)

      // Notify parent component
      if (onReviewSubmitted) {
        onReviewSubmitted(txHash)
      }
    } catch (error) {
      console.error("Error submitting review:", error)
      Alert.alert("Error", "Failed to submit review. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const renderStars = () => {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => handleRatingPress(i)}
          className="p-2"
          hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
        >
          <Star size={32} color={i <= rating ? "#FFD700" : "#D1D5DB"} fill={i <= rating ? "#FFD700" : "none"} />
        </TouchableOpacity>,
      )
    }
    return stars
  }

  const renderSuccessModal = () => {
    return (
      <Modal visible={showSuccessModal} animationType="fade" transparent={true}>
        <View className="flex-1 bg-black/60 justify-center items-center">
          <View className="bg-white rounded-xl m-5 w-11/12 max-w-md">
            <View className="p-5 items-center">
              <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
                <CheckCircle size={32} color="#10B981" />
              </View>
              <Text className="text-xl font-pbold text-gray-800 mb-2">Review Submitted!</Text>
              <Text className="text-gray-600 text-center mb-4">
                Your review has been securely stored on the blockchain and is now immutable and verifiable.
              </Text>

              <View className="bg-gray-50 p-3 rounded-lg w-full mb-4">
                <View className="flex-row items-center mb-2">
                  <Shield size={16} color="#0D9F70" />
                  <Text className="text-gray-700 font-pmedium ml-2">Blockchain Transaction</Text>
                </View>
                <Text className="text-xs text-gray-500 break-all">{transactionHash}</Text>
              </View>

              <TouchableOpacity
                className="bg-[#0D9F70] py-3 rounded-full w-full items-center mb-3"
                onPress={() => {
                  setShowSuccessModal(false)
                  onClose()
                }}
              >
                <Text className="text-white font-pmedium">Done</Text>
              </TouchableOpacity>

              {/* Link to Polygon Amoy Explorer */}
              <TouchableOpacity
                className="flex-row items-center"
                onPress={() => {
                  // This would open the Polygon Amoy Explorer with the transaction
                  const explorerUrl = `https://amoy.polygonscan.com/tx/${transactionHash}`
                  Linking.openURL(explorerUrl).catch(() => {
                    Alert.alert("Error", "Could not open blockchain explorer")
                  })
                }}
              >
                <ExternalLink size={16} color="#6B7280" />
                <Text className="text-gray-500 ml-1">View on Blockchain Explorer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    )
  }

  // Simplified modal structure to ensure content is visible
  return (
    <>
      <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={onClose}>
        <View className="flex-1 bg-black/60 justify-center items-center">
          <View className="bg-white rounded-xl m-4 w-11/12 max-w-md" style={{ maxHeight: screenHeight * 0.8 }}>
            {/* Header */}
            <View className="px-6 pt-4 pb-2 flex-row justify-between items-center border-b border-gray-100">
              <Text className="text-xl font-pbold text-gray-800">Submit Review</Text>
              <TouchableOpacity
                onPress={onClose}
                className="p-2 rounded-full bg-gray-100"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView className="px-6 py-4" showsVerticalScrollIndicator={false}>
              <Text className="text-gray-700 font-pmedium mb-2">
                How would you rate your experience with this {isJobOwner ? "freelancer" : "client"}?
              </Text>

              {/* Rating stars */}
              <View className="flex-row justify-center my-4">{renderStars()}</View>

              {/* Rating text indicator */}
              <Text className="text-center text-gray-700 mb-4">
                {rating === 1
                  ? "Poor"
                  : rating === 2
                    ? "Fair"
                    : rating === 3
                      ? "Good"
                      : rating === 4
                        ? "Very Good"
                        : rating === 5
                          ? "Excellent"
                          : "Select a rating"}
              </Text>

              {/* Review text */}
              <Text className="text-gray-700 font-pmedium mb-2">Write your review:</Text>
              <TextInput
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="Share your experience working on this project..."
                multiline
                numberOfLines={5}
                className="bg-gray-100 p-4 rounded-lg mb-3 min-h-[120px] text-gray-800"
              />

              {/* Blockchain info */}
              <View className="bg-blue-50 p-4 rounded-lg mb-4">
                <View className="flex-row items-start">
                  <Shield size={20} color="#1D4ED8" />
                  <View className="ml-2 flex-1">
                    <Text className="text-gray-800 font-pmedium">Blockchain-Secured Review</Text>
                    <Text className="text-gray-600 text-sm mt-1">
                      Your review will be securely stored on the Polygon Amoy blockchain, making it tamper-proof and
                      verifiable.
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Action buttons */}
            <View className="p-4 border-t border-gray-100">
              <View className="flex-row">
                <TouchableOpacity
                  className="flex-1 bg-gray-200 py-3 rounded-full mr-2 items-center"
                  onPress={onClose}
                  disabled={submitting}
                >
                  <Text className="font-pmedium text-gray-700">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 bg-[#0D9F70] py-3 rounded-full items-center"
                  onPress={submitReview}
                  disabled={submitting || rating === 0 || !reviewText.trim()}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="font-pmedium text-white">Submit Review</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {renderSuccessModal()}
    </>
  )
}
