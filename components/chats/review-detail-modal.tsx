"use client"
import { useEffect } from "react"
import { View, Text, Modal, TouchableOpacity, ScrollView, Dimensions, StyleSheet } from "react-native"
import { X, Star, Shield, ExternalLink, User, Calendar } from "lucide-react-native"
import { format } from "date-fns"

export const ReviewDetailModal = ({ isVisible, onClose, review }) => {
  useEffect(() => {
    if (isVisible && review) {
      console.log("Modal opened with review:", {
        id: review.id,
        rating: review.rating,
        reviewerType: review.reviewer_type,
        hasText: !!review.review_text,
      })
    }
  }, [isVisible, review])

  if (!review) return null

  const { width, height } = Dimensions.get("window")

  return (
    <Modal visible={isVisible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { width: width * 0.9, maxHeight: height * 0.85 }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerText}>Review Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Rating */}
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingLabel}>
                {review.reviewer_type === "client" ? "Client Rating" : "Freelancer Rating"}
              </Text>
              <View style={styles.starsRow}>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={32} color="#FFD700" fill={i < review.rating ? "#FFD700" : "none"} />
                ))}
              </View>
              <Text style={styles.ratingText}>
                {review.rating === 1
                  ? "Poor"
                  : review.rating === 2
                  ? "Fair"
                  : review.rating === 3
                  ? "Good"
                  : review.rating === 4
                  ? "Very Good"
                  : "Excellent"}
              </Text>
            </View>

            {/* Review text */}
            <View style={styles.reviewTextContainer}>
              <Text style={styles.reviewText}>{review.review_text || "No additional comments provided."}</Text>
            </View>

            {/* Metadata */}
            <View style={styles.metadataContainer}>
              <View style={styles.metadataRow}>
                <User size={18} color="#0D9F70" />
                <Text style={styles.metadataText}>
                  By: {review.reviewer_name || (review.reviewer_type === "client" ? "Client" : "Freelancer")}
                </Text>
              </View>

              <View style={styles.metadataRow}>
                <Calendar size={18} color="#0D9F70" />
                <Text style={styles.metadataText}>Date: {format(new Date(review.created_at), "MMMM d, yyyy")}</Text>
              </View>

              {/* Blockchain verification */}
              <View style={styles.blockchainContainer}>
                <View style={styles.blockchainHeader}>
                  <Shield size={20} color="#1D4ED8" />
                  <View style={styles.blockchainContent}>
                    <Text style={styles.blockchainTitle}>Blockchain Verification</Text>
                    <Text style={styles.blockchainDescription}>
                      This review is securely stored on the blockchain and cannot be altered.
                    </Text>

                    <Text style={styles.hashLabel}>Transaction Hash:</Text>
                    <Text style={styles.hashValue}>{review.blockchain_tx_hash}</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeFullButton} onPress={onClose}>
              <Text style={styles.closeFullButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f1f1",
  },
  headerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f1f1f1",
  },
  scrollView: {
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  ratingContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  ratingLabel: {
    color: "#666",
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  reviewTextContainer: {
    backgroundColor: "#f9f9f9",
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  reviewText: {
    color: "#333",
    lineHeight: 20,
  },
  metadataContainer: {
    gap: 16,
  },
  metadataRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  metadataText: {
    marginLeft: 8,
    color: "#555",
  },
  blockchainContainer: {
    backgroundColor: "#EBF5FF",
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  blockchainHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  blockchainContent: {
    marginLeft: 8,
    flex: 1,
  },
  blockchainTitle: {
    color: "#333",
    fontWeight: "bold",
  },
  blockchainDescription: {
    color: "#555",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  hashLabel: {
    fontSize: 12,
    color: "#666",
  },
  hashValue: {
    fontSize: 12,
    color: "#333",
    fontWeight: "500",
    marginBottom: 8,
  },
  verifyButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  verifyText: {
    fontSize: 14,
    color: "#0D9F70",
    marginLeft: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f1f1",
  },
  closeFullButton: {
    backgroundColor: "#0D9F70",
    padding: 12,
    borderRadius: 24,
    alignItems: "center",
  },
  closeFullButtonText: {
    color: "white",
    fontWeight: "500",
  },
})
