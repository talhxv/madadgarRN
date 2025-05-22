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
  Image,
  Linking,
  Animated,
} from "react-native"
import { supabase } from "@/lib/supabase"
import {
  Calendar,
  X,
  Plus,
  Check,
  DollarSign,
  CheckCircle,
  CreditCard,
  Upload,
  Clock,
  FileCheck,
  AlertCircle,
  ExternalLink,
  Eye,
  ImageIcon,
  Star,
} from "lucide-react-native"
import DateTimePicker from "@react-native-community/datetimepicker"
import { format } from "date-fns"
import * as ImagePicker from "expo-image-picker"
import { decode } from "base64-arraybuffer"
import { StripePaymentHandler } from "@/components/chats/stripe-payment-handler"
import { PaymentMethodSelector } from "@/components/chats/payment-method-selector"
import { ReviewModal } from "./review-modal"
import { ReviewDetailModal } from "./review-detail-modal"
import { ReviewBadge } from "./review-badge"

// Helper functions for date calculations
const getStartOfWeek = (date) => {
  const result = new Date(date)
  result.setDate(result.getDate() - result.getDay()) // Start of week (Sunday)
  return result
}

const getEndOfWeek = (date) => {
  const result = new Date(date)
  result.setDate(result.getDate() - result.getDay() + 6) // End of week (Saturday)
  return result
}

export const MilestonesModal = ({
  isVisible,
  onClose,
  chatId,
  jobId,
  proposalId,
  isJobOwner,
  proposal,
  agreement,
  onMilestoneAdded,
  chat, // Add chat prop here
}) => {
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [remainingAmount, setRemainingAmount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(null)

  // Animation state
  const [animation] = useState(new Animated.Value(0))

  // New milestone form states
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [dueDate, setDueDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Add this state for timesheet entry
  const [showTimesheetModal, setShowTimesheetModal] = useState(false)
  const [hoursWorked, setHoursWorked] = useState("")
  const [timesheetDescription, setTimesheetDescription] = useState("")

  // Payment proof modal
  const [showPaymentProofModal, setShowPaymentProofModal] = useState(false)
  const [milestoneToPayFor, setMilestoneToPayFor] = useState(null)

  // Image preview states
  const [selectedImage, setSelectedImage] = useState(null)
  const [showImagePreviewModal, setShowImagePreviewModal] = useState(false)
  const [fullScreenImage, setFullScreenImage] = useState(null)
  const [showFullScreenImageModal, setShowFullScreenImageModal] = useState(false)

  // Next steps guidance
  const [showNextStepsModal, setShowNextStepsModal] = useState(false)
  const [nextStepsInfo, setNextStepsInfo] = useState({
    title: "",
    description: "",
    steps: [],
  })

  const [previewRemainingAmount, setPreviewRemainingAmount] = useState(remainingAmount)

  // New state for payment method selection
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false)

  const [allMilestonesCompleted, setAllMilestonesCompleted] = useState(false)
  const [jobCompleted, setJobCompleted] = useState(false)

  // New states for review system
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviews, setReviews] = useState([])
  const [selectedReview, setSelectedReview] = useState(null)
  const [showReviewDetailModal, setShowReviewDetailModal] = useState(false)
  const [hasSubmittedReview, setHasSubmittedReview] = useState(false)

  // Animation for the modal
  useEffect(() => {
    if (isVisible) {
      Animated.spring(animation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 7,
      }).start()
    } else {
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [isVisible])

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  })

  useEffect(() => {
    if (isVisible) {
      fetchMilestones()
      fetchReviews() // Add this to fetch reviews
      console.log("Agreement in MilestonesModal:", agreement)
    }
  }, [isVisible])

  useEffect(() => {
    if (agreement) {
      console.log("Calculating budget with agreement:", {
        is_hourly: agreement.is_hourly,
        hourly_rate: agreement.hourly_rate,
        total_hours: agreement.total_hours,
        amount: agreement.amount,
      })

      let totalAmt = 0

      if (agreement.is_hourly) {
        const rate = Number.parseFloat(agreement.hourly_rate || "0") || 0
        const hours = Number.parseFloat(agreement.total_hours || "0") || 0
        totalAmt = rate * hours
        console.log(`Calculated hourly total: ${rate} × ${hours} = ${totalAmt}`)
      } else {
        // For fixed price, use payment_amount instead of amount
        totalAmt = Number.parseFloat(agreement.payment_amount || "0") || 0
        console.log(`Using fixed amount: ${totalAmt}`)
      }

      // Ensure we have a valid number
      totalAmt = isNaN(totalAmt) ? 0 : totalAmt

      console.log("Setting total amount to:", totalAmt)
      setTotalAmount(totalAmt)
    } else if (proposal) {
      console.log("No agreement data available, using proposal data")
      // Fallback to proposal rate if available
      const proposalRate = Number.parseFloat(proposal.rate || "0") || 0
      setTotalAmount(proposalRate)
      console.log("Setting total amount from proposal:", proposalRate)
    } else {
      console.log("No agreement or proposal data available")
      setTotalAmount(0)
    }
  }, [agreement, proposal])

  useEffect(() => {
    const allocated = milestones.reduce((sum, milestone) => {
      return sum + (Number.parseFloat(milestone.amount) || 0)
    }, 0)

    const remaining = totalAmount - allocated
    console.log(`Allocated amount: ${allocated} out of ${totalAmount}, remaining: ${remaining}`)

    // Ensure we don't set NaN
    setRemainingAmount(isNaN(remaining) ? 0 : remaining)
  }, [milestones, totalAmount])

  useEffect(() => {
    const amountValue = Number.parseFloat(amount) || 0
    setPreviewRemainingAmount(remainingAmount - amountValue)
  }, [amount, remainingAmount])

  useEffect(() => {
    if (milestones.length > 0 && remainingAmount <= 0) {
      // Check if all milestones are completed
      const allCompleted = milestones.every((milestone) => milestone.status === "payment_received")
      setAllMilestonesCompleted(allCompleted)

      // Check if job is already marked as completed
      if (allCompleted) {
        const fetchJobStatus = async () => {
          try {
            const { data, error } = await supabase.from("jobs").select("status").eq("id", jobId).single()

            if (error) throw error
            setJobCompleted(data?.status === "completed")
          } catch (err) {
            console.error("Error fetching job status:", err)
          }
        }

        fetchJobStatus()
      }
    } else {
      setAllMilestonesCompleted(false)
    }
  }, [milestones, remainingAmount])

  const fetchMilestones = async () => {
    try {
      setLoading(true)

      if (!chatId) {
        console.error("Chat ID is missing, cannot fetch milestones")
        return
      }

      const { data, error } = await supabase
        .from("milestones")
        .select("*")
        .eq("chat_id", chatId)
        .order("due_date", { ascending: true })

      if (error) throw error

      // Process milestones to ensure payment proof URLs are valid
      const processedMilestones =
        data?.map((milestone) => {
          // Ensure all milestone properties have default values if null
          const processedMilestone = {
            ...milestone,
            title: milestone.title || "Untitled Milestone",
            description: milestone.description || "",
            amount: milestone.amount || 0,
            status: milestone.status || "pending",
            payment_method: milestone.payment_method || null,
          }

          if (processedMilestone.payment_proof_url) {
            // Add a cache-busting parameter to force reload
            processedMilestone.payment_proof_url = `${processedMilestone.payment_proof_url}?t=${new Date().getTime()}`
          }
          return processedMilestone
        }) || []

      setMilestones(processedMilestones)
    } catch (error) {
      console.error("Error fetching milestones:", error)
      Alert.alert("Error", "Failed to load milestones")
    } finally {
      setLoading(false)
    }
  }

  // New function to fetch reviews
  const fetchReviews = async () => {
    try {
      if (!jobId || !proposalId) {
        console.log("Job ID or Proposal ID missing, cannot fetch reviews")
        return
      }

      const { data, error } = await supabase
        .from("job_reviews")
        .select("*")
        .eq("job_id", jobId)
        .eq("proposal_id", proposalId)
        .order("created_at", { ascending: false })

      if (error) throw error

      setReviews(data || [])

      // Check if the current user has already submitted a review
      if (data && data.length > 0) {
        const userReview = data.find(
          (review) =>
            (isJobOwner && review.reviewer_type === "client") || (!isJobOwner && review.reviewer_type === "freelancer"),
        )
        setHasSubmittedReview(!!userReview)
      } else {
        setHasSubmittedReview(false)
      }
    } catch (error) {
      console.error("Error fetching reviews:", error)
    }
  }

  // New function to handle review submission
  const handleReviewSubmitted = (txHash) => {
    fetchReviews()
    setHasSubmittedReview(true)

    // Add system message to chat
    supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        content: `${isJobOwner ? "Client" : "Freelancer"} submitted a blockchain-verified review for this job`,
        is_system: true,
        created_at: new Date().toISOString(),
      })
      .then(() => {
        if (onMilestoneAdded) {
          onMilestoneAdded()
        }
      })
  }

  // New function to view review details
  const handleViewReview = (review) => {
    setSelectedReview(review)
    setShowReviewDetailModal(true)
  }

  const addMilestone = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Please enter a title for the milestone")
      return
    }

    const amountValue = Number.parseFloat(amount)
    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert("Error", "Please enter a valid amount")
      return
    }

    // Check if milestone amount exceeds remaining amount
    if (amountValue > remainingAmount) {
      Alert.alert(
        "Error",
        `Milestone amount exceeds remaining budget of ${proposal?.currency || "$"}${remainingAmount.toFixed(2)}`,
      )
      return
    }

    try {
      setAdding(true)

      // Get the agreement ID
      const { data: agreementData, error: agreementError } = await supabase
        .from("proposal_agreements")
        .select("id")
        .eq("proposal_id", proposalId)
        .eq("chat_id", chatId)
        .single()

      if (agreementError) throw agreementError

      const newMilestone = {
        chat_id: chatId,
        proposal_id: proposalId,
        job_id: jobId,
        agreement_id: agreementData.id,
        title,
        description,
        amount: amountValue,
        due_date: dueDate.toISOString(),
        status: "pending", // Initial status - waiting for freelancer to accept
      }

      const { error } = await supabase.from("milestones").insert(newMilestone)

      if (error) throw error

      // Add system message to chat
      await supabase.from("messages").insert({
        chat_id: chatId,
        content: `A new milestone "${title}" worth ${proposal?.currency || "$"}${amountValue.toFixed(2)} was added by the job poster`,
        is_system: true,
        created_at: new Date(),
      })

      setTitle("")
      setDescription("")
      setAmount("")
      setDueDate(new Date())
      setShowAddMilestoneModal(false)

      fetchMilestones()

      if (onMilestoneAdded) {
        onMilestoneAdded()
      }

      // Show next steps guidance
      showNextSteps("Milestone Created", "Your milestone has been created successfully. Here's what happens next:", [
        "The freelancer will review and accept the milestone",
        "Once accepted, they'll work on completing the milestone",
        "After completion, you'll be notified to release payment",
      ])
    } catch (error) {
      console.error("Error adding milestone:", error)
      Alert.alert("Error", "Failed to add milestone")
    } finally {
      setAdding(false)
    }
  }

  const submitTimesheet = async () => {
    try {
      if (!hoursWorked || Number.parseFloat(hoursWorked) <= 0) {
        Alert.alert("Error", "Please enter valid hours")
        return
      }

      setAdding(true)

      // Calculate the date range for this week
      const today = new Date()
      const startDate = getStartOfWeek(today)
      const endDate = getEndOfWeek(today)

      const hours = Number.parseFloat(hoursWorked)
      const hourlyRate = Number.parseFloat(agreement?.hourly_rate || proposal?.rate || 0)
      const amountValue = hours * hourlyRate

      // Get the agreement ID
      let agreementId = agreement?.id

      if (!agreementId) {
        const { data: agreementData, error: agreementError } = await supabase
          .from("proposal_agreements")
          .select("id")
          .eq("proposal_id", proposalId)
          .eq("chat_id", chatId)
          .single()

        if (agreementError) throw agreementError
        agreementId = agreementData.id
      }

      const newMilestone = {
        chat_id: chatId,
        proposal_id: proposalId,
        job_id: jobId,
        agreement_id: agreementId,
        title: `Week of ${format(startDate, "MMM d")} - ${format(endDate, "MMM d")}`,
        description: timesheetDescription || `${hours} hours at ${proposal?.currency || "$"}${hourlyRate}/hour`,
        amount: amountValue,
        due_date: endDate.toISOString(),
        status: "completed", // For hourly, we skip the acceptance step
        completed_at: new Date().toISOString(),
      }

      const { error } = await supabase.from("milestones").insert(newMilestone)

      if (error) throw error

      // Add system message to chat
      await supabase.from("messages").insert({
        chat_id: chatId,
        content: `New timesheet added: ${hours} hours at ${proposal?.currency || "$"}${hourlyRate}/hour for a total of ${proposal?.currency || "$"}${amountValue.toFixed(2)}`,
        is_system: true,
        created_at: new Date(),
      })

      setShowTimesheetModal(false)
      setHoursWorked("")
      setTimesheetDescription("")
      fetchMilestones()

      if (onMilestoneAdded) {
        onMilestoneAdded()
      }

      // Show next steps guidance
      showNextSteps(
        "Timesheet Submitted",
        "Your timesheet has been submitted successfully. Here's what happens next:",
        [
          "The client will review your timesheet",
          "Once approved, they'll release payment",
          "You'll be notified when payment is released",
        ],
      )
    } catch (error) {
      console.error("Error adding timesheet:", error)
      Alert.alert("Error", "Failed to add timesheet")
    } finally {
      setAdding(false)
    }
  }

  const updateMilestoneStatus = async (id, newStatus) => {
    try {
      setUpdating(true)

      const milestone = milestones.find((m) => m.id === id)
      if (!milestone) {
        console.error("Milestone not found:", id)
        return
      }

      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }

      // Add timestamp for the specific status
      switch (newStatus) {
        case "accepted":
          updateData.accepted_at = new Date().toISOString()
          break
        case "completed":
          updateData.completed_at = new Date().toISOString()
          break
        case "payment_released":
          updateData.payment_released_at = new Date().toISOString()
          // If this is a Stripe payment, mark it as such
          if (milestone.payment_method === "stripe") {
            updateData.payment_method = "stripe"
          }
          break
        case "payment_received":
          updateData.payment_received_at = new Date().toISOString()
          break
      }

      const { error } = await supabase.from("milestones").update(updateData).eq("id", id)

      if (error) throw error

      // Add system message to chat with appropriate message based on status
      let statusMessage = ""
      const milestoneTitle = milestone.title || "Unknown milestone"

      switch (newStatus) {
        case "accepted":
          statusMessage = `Milestone "${milestoneTitle}" was accepted by the freelancer`
          break
        case "completed":
          statusMessage = `Milestone "${milestoneTitle}" was marked as completed by the freelancer`
          break
        case "payment_released":
          statusMessage = `Payment for milestone "${milestoneTitle}" was released by the job poster`
          break
        case "payment_received":
          statusMessage = `Payment for milestone "${milestoneTitle}" was confirmed as received by the freelancer`
          break
        default:
          statusMessage = `Milestone "${milestoneTitle}" status was updated to ${newStatus}`
      }

      await supabase.from("messages").insert({
        chat_id: chatId,
        content: statusMessage,
        is_system: true,
        created_at: new Date(),
      })

      fetchMilestones()

      // Show appropriate next steps based on the new status
      if (newStatus === "accepted") {
        showNextSteps("Milestone Accepted", "You've accepted this milestone. Here's what happens next:", [
          "Complete the work as described in the milestone",
          "Once finished, mark the milestone as completed",
          "The client will review and release payment",
        ])
      } else if (newStatus === "completed") {
        showNextSteps("Milestone Completed", "You've marked this milestone as completed. Here's what happens next:", [
          "The client will review your work",
          "Once satisfied, they'll release payment",
          "You'll be notified to confirm payment receipt",
        ])
      } else if (newStatus === "payment_released") {
        showNextSteps("Payment Released", "Payment has been released. Here's what happens next:", [
          "Check your payment method for the funds",
          "Once received, confirm payment receipt",
          "The milestone will be marked as fully completed",
        ])
      } else if (newStatus === "payment_received") {
        showNextSteps("Payment Received", "You've confirmed payment receipt. The milestone is now complete!", [
          "The milestone is now fully completed",
          "You can continue with other milestones",
          "Or discuss next steps with the client",
        ])
      }
    } catch (error) {
      console.error("Error updating milestone:", error)
      Alert.alert("Error", "Failed to update milestone status")
    } finally {
      setUpdating(false)
      setSelectedMilestoneId(null)
    }
  }

  const selectImageForPaymentProof = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant permission to access your media library")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16], // Changed from [4, 3] to [9, 16] for better screenshot handling
        quality: 0.8,
        base64: true,
      })

      if (result.canceled) return

      // Set the selected image for preview
      setSelectedImage({
        uri: result.assets[0].uri,
        base64: result.assets[0].base64,
        fileExt: result.assets[0].uri.split(".").pop(),
      })

      // Show the image preview modal
      setShowImagePreviewModal(true)
    } catch (error) {
      console.error("Error selecting image:", error)
      Alert.alert("Error", "Failed to select image")
    }
  }

  const uploadPaymentProof = async () => {
    if (!selectedImage || !milestoneToPayFor || !milestoneToPayFor.id) {
      Alert.alert("Error", "No image selected or milestone not specified")
      return
    }

    try {
      setUploadingProof(true)
      setShowImagePreviewModal(false)

      // Generate a unique file name with timestamp and milestone ID
      const fileName = `payment-proof-${milestoneToPayFor.id}-${Date.now()}.${selectedImage.fileExt}`
      const filePath = `${fileName}` // Don't include payment-proofs/ in the path

      console.log(`Uploading payment proof to ${filePath}`)

      // Upload directly using base64 - don't add the data:image prefix
      const base64Data = selectedImage.base64

      // Upload using the same method as your chat service
      const { error } = await supabase.storage.from("payment-proofs").upload(filePath, decode(base64Data), {
        contentType: `image/${selectedImage.fileExt}`,
        upsert: true,
      })

      if (error) {
        console.error("Error uploading payment proof:", error)
        Alert.alert("Error", "Failed to upload payment proof")
        return
      }

      // Get the public URL
      const { data: publicUrlData } = supabase.storage.from("payment-proofs").getPublicUrl(filePath)

      if (!publicUrlData || !publicUrlData.publicUrl) {
        throw new Error("Failed to get public URL for uploaded file")
      }

      const publicUrl = publicUrlData.publicUrl
      console.log("Public URL:", publicUrl)

      // Update the milestone with the payment proof URL
      const { error: updateError } = await supabase
        .from("milestones")
        .update({
          payment_proof_url: publicUrl,
          status: "payment_released",
          payment_method: "manual", // Explicitly set payment method to manual
          payment_released_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", milestoneToPayFor.id)

      if (updateError) {
        console.error("Error updating milestone with payment proof:", updateError)
        Alert.alert("Error", "Failed to update milestone with payment proof")
        return
      }

      // Add system message
      const milestoneTitle = milestoneToPayFor.title || "Unknown milestone"
      await supabase.from("messages").insert({
        chat_id: chatId,
        content: `Payment proof for milestone "${milestoneTitle}" was uploaded by the job poster`,
        is_system: true,
        created_at: new Date(),
      })

      Alert.alert("Success", "Payment proof uploaded successfully")
      fetchMilestones()
      setShowPaymentProofModal(false)
      setSelectedImage(null)

      // Show next steps guidance
      showNextSteps(
        "Payment Proof Uploaded",
        "Your payment proof has been uploaded successfully. Here's what happens next:",
        [
          "The freelancer will review the payment proof",
          "Once they confirm receipt, the milestone will be marked as complete",
          "You can continue with other milestones or discuss next steps",
        ],
      )
    } catch (error) {
      console.error("Error in uploadPaymentProof:", error)
      Alert.alert("Error", "An error occurred while uploading payment proof")
    } finally {
      setUploadingProof(false)
    }
  }

  const viewPaymentProof = (imageUrl) => {
    if (!imageUrl) {
      Alert.alert("Error", "No payment proof available")
      return
    }

    setFullScreenImage(imageUrl)
    setShowFullScreenImageModal(true)
  }

  const showNextSteps = (title, description, steps) => {
    setNextStepsInfo({
      title,
      description,
      steps,
    })
    setShowNextStepsModal(true)
  }

  const completeJob = async () => {
    try {
      if (!jobId) {
        Alert.alert("Error", "Job ID is missing")
        return
      }

      // Update job status to completed
      const { error: jobUpdateError } = await supabase
        .from("jobs")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)

      if (jobUpdateError) {
        throw jobUpdateError
      }

      // Delete other pending proposals for this job
      const { error: proposalDeleteError } = await supabase
        .from("proposals")
        .delete()
        .eq("job_id", jobId)
        .not("id", "eq", proposalId)

      if (proposalDeleteError) {
        console.warn("Error deleting other proposals:", proposalDeleteError)
      }

      // Add system message to the chat
      await supabase.from("messages").insert({
        chat_id: chatId,
        content: "🎉 The job has been marked as completed! Thank you for using Madadgar.",
        is_system: true,
        created_at: new Date().toISOString(),
        sender_id: chatId, // Using chatId as sender for system message
      })

      setJobCompleted(true)

      // Show completion message
      showNextSteps("Job Completed", "Congratulations! This job has been successfully completed.", [
        "All milestones have been completed and paid",
        "The job is now marked as complete in your history",
        "Other proposals for this job have been removed",
        "You can now leave a review for your experience",
      ])
    } catch (error) {
      console.error("Error completing job:", error)
      Alert.alert("Error", "Failed to complete the job")
    }
  }

  const getStatusInfo = (status) => {
    switch (status) {
      case "accepted":
        return {
          color: "bg-blue-100 text-blue-700",
          icon: <Check color="#1D4ED8" size={16} />,
          label: "Accepted",
        }
      case "completed":
        return {
          color: "bg-yellow-100 text-yellow-700",
          icon: <FileCheck color="#A16207" size={16} />,
          label: "Work Completed", // Changed from "Completed" to "Work Completed"
        }
      case "payment_released":
        return {
          color: "bg-purple-100 text-purple-700",
          icon: <CreditCard color="#7E22CE" size={16} />,
          label: "Payment Released",
        }
      case "payment_received":
        return {
          color: "bg-green-100 text-green-700",
          icon: <CheckCircle color="#15803D" size={16} />,
          label: "Payment Received",
        }
      default:
        return {
          color: "bg-gray-100 text-gray-700",
          icon: <Clock color="#4B5563" size={16} />,
          label: "Pending",
        }
    }
  }

  const renderMilestone = (milestone) => {
    const statusInfo = getStatusInfo(milestone.status)

    return (
      <View key={milestone.id} className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="font-pbold text-gray-800 text-lg">{milestone.title}</Text>
          <View className={`px-2 py-1 rounded-full flex-row items-center ${statusInfo.color.split(" ")[0]}`}>
            {statusInfo.icon}
            <Text className={`ml-1 text-xs font-pmedium ${statusInfo.color.split(" ")[1]}`}>{statusInfo.label}</Text>
          </View>
        </View>

        {milestone.description ? <Text className="text-gray-600 mb-3">{milestone.description}</Text> : null}

        <View className="flex-row justify-between mb-3">
          <View className="flex-row items-center">
            <DollarSign size={16} color="#0D9F70" />
            <Text className="text-gray-800 font-pmedium ml-1">
              {proposal?.currency || "$"}
              {Number.parseFloat(milestone.amount).toFixed(2)}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Calendar size={16} color="#0D9F70" />
            <Text className="text-gray-600 ml-1">Due: {format(new Date(milestone.due_date), "MMM d, yyyy")}</Text>
          </View>
        </View>

        {/* Payment proof section - with special handling for Stripe payments */}
        {milestone.status === "payment_released" && (
          <View className="mb-3 border border-gray-200 rounded-lg p-3 bg-gray-50">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-gray-700 font-pmedium">Payment Status:</Text>
            </View>

            {milestone.payment_method === "stripe" ? (
              // Stripe payment display
              <View className="bg-purple-50 p-3 rounded-lg flex-row items-center">
                <CreditCard size={20} color="#7E22CE" />
                <View className="ml-2">
                  <Text className="text-gray-800 font-pmedium">Paid with Stripe</Text>
                  {milestone.stripe_payment_id && (
                    <Text className="text-xs text-gray-500">
                      Transaction ID: {milestone.stripe_payment_id.slice(0, 10)}...
                    </Text>
                  )}
                  {milestone.payment_released_at && (
                    <Text className="text-xs text-gray-500">
                      {format(new Date(milestone.payment_released_at), "MMM d, yyyy · h:mm a")}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              // Manual payment with proof
              <>
                {milestone.payment_proof_url ? (
                  <TouchableOpacity
                    onPress={() => viewPaymentProof(milestone.payment_proof_url)}
                    className="relative"
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: milestone.payment_proof_url }}
                      style={{ width: "100%", height: 150, borderRadius: 8 }}
                      resizeMode="cover"
                      onError={(e) => {
                        console.error("Error loading image:", e.nativeEvent.error)
                      }}
                    />
                    <View className="absolute bottom-2 right-2 bg-black/50 rounded-full p-1">
                      <Eye size={16} color="#fff" />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View className="items-center justify-center bg-gray-200 h-20 rounded-lg">
                    <ImageIcon size={24} color="#9CA3AF" />
                    <Text className="text-gray-500 text-xs mt-1">Payment proof not available</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Action buttons based on role and status */}
        <View className="flex-row mt-2 flex-wrap" style={{ zIndex: 5 }}>
          {/* Freelancer actions */}
          {!isJobOwner && milestone.status === "pending" && (
            <TouchableOpacity
              className="bg-[#0D9F70] py-3 rounded-full w-full mb-2 flex-row justify-center items-center"
              onPress={() => updateMilestoneStatus(milestone.id, "accepted")}
              disabled={updating || selectedMilestoneId === milestone.id}
              style={{
                elevation: 2,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 1.5,
              }}
            >
              <Check size={18} color="#fff" />
              <Text className="ml-2 text-white font-pmedium">Accept Milestone</Text>
            </TouchableOpacity>
          )}

          {!isJobOwner && milestone.status === "accepted" && (
            <TouchableOpacity
              className="bg-[#F59E0B] py-3 rounded-full w-full mb-2 flex-row justify-center items-center"
              onPress={() => updateMilestoneStatus(milestone.id, "completed")}
              disabled={updating || selectedMilestoneId === milestone.id}
              style={{
                elevation: 2,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 1.5,
              }}
            >
              <FileCheck size={18} color="#fff" />
              <Text className="ml-2 text-white font-pmedium">Mark Work as Completed</Text>
            </TouchableOpacity>
          )}

          {!isJobOwner && milestone.status === "payment_released" && (
            <TouchableOpacity
              className="bg-[#10B981] py-3 rounded-full w-full mb-2 flex-row justify-center items-center"
              onPress={() => updateMilestoneStatus(milestone.id, "payment_received")}
              disabled={updating || selectedMilestoneId === milestone.id}
              style={{
                elevation: 2,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 1.5,
              }}
            >
              <CheckCircle size={18} color="#fff" />
              <Text className="ml-2 text-white font-pmedium">Confirm Payment Received</Text>
            </TouchableOpacity>
          )}

          {/* Job owner actions */}
          {isJobOwner && milestone.status === "completed" && (
            <View className="w-full">
              {/* Upload Proof Button */}
              <TouchableOpacity
                className="bg-[#0D9F70] py-3 rounded-full w-full mb-2 flex-row justify-center items-center"
                onPress={() => {
                  setMilestoneToPayFor(milestone)
                  setShowPaymentProofModal(true)
                }}
                disabled={updating || uploadingProof || selectedMilestoneId === milestone.id}
                style={{
                  elevation: 2,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 1.5,
                }}
              >
                <Upload size={18} color="#fff" />
                <Text className="ml-2 text-white font-pmedium">Upload Proof</Text>
              </TouchableOpacity>

              {/* Add Stripe payment option */}
              <StripePaymentHandler
                milestone={milestone}
                chatId={chatId}
                onPaymentComplete={() => {
                  // Show a message that payment is being processed
                  showNextSteps("Payment Processing", "Your payment is being processed. Here's what happens next:", [
                    "Stripe will process your payment",
                    "Once confirmed, the milestone will be automatically updated",
                    "The freelancer will be notified of the payment",
                  ])
                }}
              />
            </View>
          )}

          {updating && selectedMilestoneId === milestone.id && (
            <View className="px-4 py-2">
              <ActivityIndicator size="small" color="#0D9F70" />
            </View>
          )}
        </View>
      </View>
    )
  }

  const renderMilestoneStatusFlow = () => {
    return (
      <View className="bg-gray-50 p-3 rounded-lg mb-4 mt-2">
        <Text className="text-gray-700 font-pbold mb-2">Milestone Workflow:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pb-2">
          <View className="flex-row items-center">
            <View className="items-center mr-3">
              <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
                <Plus size={16} color="#4B5563" />
              </View>
              <Text className="text-xs text-gray-600 mt-1 text-center">Created</Text>
              <Text className="text-xs text-gray-500 text-center">(Job Poster)</Text>
            </View>

            <View className="h-0.5 bg-gray-300 w-8" />

            <View className="items-center mr-3">
              <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
                <Check size={16} color="#4B5563" />
              </View>
              <Text className="text-xs text-gray-600 mt-1 text-center">Accepted</Text>
              <Text className="text-xs text-gray-500 text-center">(Freelancer)</Text>
            </View>

            <View className="h-0.5 bg-gray-300 w-8" />

            <View className="items-center mr-3">
              <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
                <FileCheck size={16} color="#4B5563" />
              </View>
              <Text className="text-xs text-gray-600 mt-1 text-center">Work Completed</Text>
              <Text className="text-xs text-gray-500 text-center">(Freelancer)</Text>
            </View>

            <View className="h-0.5 bg-gray-300 w-8" />

            <View className="items-center mr-3">
              <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
                <CreditCard size={16} color="#4B5563" />
              </View>
              <Text className="text-xs text-gray-600 mt-1 text-center">Payment Released</Text>
              <Text className="text-xs text-gray-500 text-center">(Job Poster)</Text>
            </View>

            <View className="h-0.5 bg-gray-300 w-8" />

            <View className="items-center">
              <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
                <CheckCircle size={16} color="#4B5563" />
              </View>
              <Text className="text-xs text-gray-600 mt-1 text-center">Payment Received</Text>
              <Text className="text-xs text-gray-500 text-center">(Freelancer)</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    )
  }

  // Add Milestone Modal
  const renderAddMilestoneModal = () => {
    return (
      <Modal visible={showAddMilestoneModal} animationType="fade" transparent={true}>
        <View className="flex-1 bg-black/50 justify-end">
          <Animated.View
            style={{
              transform: [{ translateY: showAddMilestoneModal ? 0 : 300 }],
              maxHeight: "80%",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: "white",
              overflow: "hidden",
            }}
          >
            <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />

            <View className="px-6 py-2 flex-row justify-between items-center">
              <Text className="text-xl font-pbold text-gray-800">Create New Milestone</Text>
              <TouchableOpacity
                onPress={() => setShowAddMilestoneModal(false)}
                className="p-2 rounded-full bg-gray-100"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Milestone title"
                className="bg-gray-100 p-3 rounded-lg mb-3 mt-3"
              />

              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Description (optional)"
                multiline
                numberOfLines={3}
                className="bg-gray-100 p-3 rounded-lg mb-3 min-h-[80px] text-gray-800"
              />

              <View className="mb-3">
                <Text className="text-gray-700 font-pmedium mb-1">Amount</Text>
                <View className="flex-row items-center bg-gray-100 rounded-lg">
                  <Text className="text-gray-700 text-lg ml-3 mr-2">{proposal?.currency || "$"}</Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    className="flex-1 p-3 text-gray-800"
                  />
                </View>

                {/* Show remaining budget info */}
                <Text className="text-xs text-gray-500 mt-1">
                  {remainingAmount > 0
                    ? `Remaining budget: ${proposal?.currency || "$"}${previewRemainingAmount.toFixed(2)}`
                    : "No remaining budget!"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-gray-100 p-3 rounded-lg mb-3 flex-row items-center"
              >
                <Calendar size={18} color="#4B5563" />
                <Text className="ml-2 text-gray-700">{format(dueDate, "MMMM d, yyyy")}</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false)
                    if (selectedDate) {
                      setDueDate(selectedDate)
                    }
                  }}
                />
              )}

              <View className="flex-row mt-4 mb-8">
                <TouchableOpacity
                  className="flex-1 bg-gray-200 py-3 rounded-full mr-2 items-center"
                  onPress={() => setShowAddMilestoneModal(false)}
                >
                  <Text className="font-pmedium text-gray-700">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 bg-[#0D9F70] py-3 rounded-full items-center"
                  onPress={addMilestone}
                  disabled={adding}
                >
                  {adding ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="font-pmedium text-white">Add Milestone</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    )
  }

  // Timesheet Modal
  const renderTimesheetModal = () => {
    return (
      <Modal visible={showTimesheetModal} animationType="fade" transparent={true}>
        <View className="flex-1 bg-black/50 justify-end">
          <Animated.View
            style={{
              transform: [{ translateY: showTimesheetModal ? 0 : 300 }],
              maxHeight: "80%",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: "white",
              overflow: "hidden",
            }}
          >
            <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />

            <View className="px-6 py-2 flex-row justify-between items-center">
              <Text className="text-xl font-pbold text-gray-800">Submit Timesheet</Text>
              <TouchableOpacity
                onPress={() => setShowTimesheetModal(false)}
                className="p-2 rounded-full bg-gray-100"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
              {/* Calculate current week */}
              <View className="bg-gray-100 p-3 rounded-lg mb-3 flex-row items-center mt-3">
                <Calendar size={18} color="#4B5563" />
                <Text className="ml-2 text-gray-700">
                  Week of {format(getStartOfWeek(new Date()), "MMM d")} -{" "}
                  {format(getEndOfWeek(new Date()), "MMM d, yyyy")}
                </Text>
              </View>

              {/* Hours worked input */}
              <View className="mb-3">
                <Text className="text-gray-700 mb-1">Hours worked</Text>
                <View className="flex-row items-center">
                  <TextInput
                    value={hoursWorked}
                    onChangeText={setHoursWorked}
                    placeholder="Enter hours"
                    keyboardType="decimal-pad"
                    className="flex-1 bg-gray-100 p-3 rounded-lg text-gray-800"
                  />
                </View>
              </View>

              {/* Calculated amount - non-editable */}
              <View className="mb-3">
                <Text className="text-gray-700 mb-1">Amount</Text>
                <View className="bg-gray-100 p-3 rounded-lg">
                  <Text className="text-gray-800">
                    {proposal?.currency || "$"}
                    {(Number.parseFloat(hoursWorked || "0") * Number.parseFloat(agreement?.hourly_rate || "0")).toFixed(
                      2,
                    )}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-1">
                    {hoursWorked || "0"} hours × {proposal?.currency || "$"}
                    {Number.parseFloat(agreement?.hourly_rate || "0").toFixed(2)}/hour
                  </Text>
                </View>
              </View>

              {/* Description */}
              <TextInput
                value={timesheetDescription}
                onChangeText={setTimesheetDescription}
                placeholder="Description (optional)"
                multiline
                numberOfLines={3}
                className="bg-gray-100 p-3 rounded-lg mb-3 min-h-[80px] text-gray-800"
              />

              <View className="flex-row mt-4 mb-8">
                <TouchableOpacity
                  className="flex-1 bg-gray-200 py-3 rounded-full mr-2 items-center"
                  onPress={() => {
                    setShowTimesheetModal(false)
                    setHoursWorked("")
                    setTimesheetDescription("")
                  }}
                >
                  <Text className="font-pmedium text-gray-700">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 bg-[#0D9F70] py-3 rounded-full items-center"
                  onPress={submitTimesheet}
                  disabled={adding || !hoursWorked || Number.parseFloat(hoursWorked) <= 0}
                >
                  {adding ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="font-pmedium text-white">Submit Timesheet</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    )
  }

  // Payment Proof Modal
  const renderPaymentProofModal = () => {
    return (
      <Modal visible={showPaymentProofModal} animationType="fade" transparent={true}>
        <View className="flex-1 bg-black/50 justify-end">
          <Animated.View
            style={{
              transform: [{ translateY: showPaymentProofModal ? 0 : 300 }],
              maxHeight: "70%",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: "white",
              overflow: "hidden",
            }}
          >
            <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />

            <View className="px-6 py-2 flex-row justify-between items-center">
              <Text className="text-xl font-pbold text-gray-800">Upload Payment Proof</Text>
              <TouchableOpacity
                onPress={() => setShowPaymentProofModal(false)}
                className="p-2 rounded-full bg-gray-100"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
              {milestoneToPayFor && (
                <View className="mb-4 mt-2">
                  <Text className="text-gray-700 font-pbold mb-2">Milestone Details:</Text>
                  <View className="bg-gray-50 p-3 rounded-lg">
                    <Text className="font-pmedium text-gray-800">{milestoneToPayFor.title}</Text>
                    <Text className="text-gray-600 text-sm mt-1">{milestoneToPayFor.description}</Text>
                    <View className="flex-row items-center mt-2">
                      <DollarSign size={16} color="#0D9F70" />
                      <Text className="text-gray-800 font-pmedium ml-1">
                        {proposal?.currency || "$"}
                        {Number.parseFloat(milestoneToPayFor.amount).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <View className="bg-gray-50 p-4 rounded-lg mb-4">
                <View className="flex-row items-start">
                  <AlertCircle size={20} color="#0D9F70" />
                  <View className="ml-2 flex-1">
                    <Text className="text-gray-800 font-pmedium">Payment Instructions</Text>
                    <Text className="text-gray-600 text-sm mt-1">1. Make the payment using your preferred method</Text>
                    <Text className="text-gray-600 text-sm">
                      2. Take a screenshot or photo of the payment confirmation
                    </Text>
                    <Text className="text-gray-600 text-sm">3. Upload the proof using the button below</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                className="bg-[#0D9F70] py-4 rounded-full flex-row justify-center items-center mt-2"
                onPress={selectImageForPaymentProof}
                disabled={uploadingProof}
              >
                {uploadingProof ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Upload size={20} color="#fff" />
                    <Text className="ml-2 text-white font-pmedium">Select Payment Proof</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity className="mt-3 py-3 items-center mb-8" onPress={() => setShowPaymentProofModal(false)}>
                <Text className="text-gray-500">Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    )
  }

  // Image Preview Modal
  const renderImagePreviewModal = () => {
    return (
      <Modal visible={showImagePreviewModal} animationType="fade" transparent={true}>
        <View className="flex-1 bg-black/70 justify-center items-center">
          <View className="bg-white rounded-xl w-11/12 max-w-md overflow-hidden">
            <View className="p-4 border-b border-gray-100">
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-800 text-lg font-pbold">Preview Payment Proof</Text>
                <TouchableOpacity onPress={() => setShowImagePreviewModal(false)}>
                  <X size={24} color="#4B5563" />
                </TouchableOpacity>
              </View>
            </View>

            <View className="p-4">
              {selectedImage && (
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={{ width: "100%", height: 400, borderRadius: 8 }}
                  resizeMode="contain"
                />
              )}

              <View className="flex-row mt-4">
                <TouchableOpacity
                  className="flex-1 bg-gray-200 py-3 rounded-full mr-2 items-center"
                  onPress={() => {
                    setShowImagePreviewModal(false)
                    setSelectedImage(null)
                  }}
                >
                  <Text className="font-pmedium text-gray-700">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 bg-[#0D9F70] py-3 rounded-full items-center"
                  onPress={uploadPaymentProof}
                  disabled={uploadingProof}
                >
                  {uploadingProof ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="font-pmedium text-white">Upload Proof</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    )
  }

  // Full Screen Image Modal
  const renderFullScreenImageModal = () => {
    return (
      <Modal visible={showFullScreenImageModal} animationType="fade" transparent={true}>
        <View className="flex-1 bg-black/90 justify-center items-center">
          <View className="absolute top-10 right-5 z-10">
            <TouchableOpacity
              onPress={() => setShowFullScreenImageModal(false)}
              className="bg-black/50 p-2 rounded-full"
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {fullScreenImage && (
            <View className="w-full h-full justify-center items-center">
              <Image source={{ uri: fullScreenImage }} style={{ width: "95%", height: "80%" }} resizeMode="contain" />

              <TouchableOpacity
                className="mt-4 bg-white/20 px-4 py-2 rounded-full flex-row items-center"
                onPress={() => Linking.openURL(fullScreenImage)}
              >
                <ExternalLink size={16} color="#fff" />
                <Text className="ml-2 text-white">Open in Browser</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    )
  }

  // Next Steps Modal
  const renderNextStepsModal = () => {
    return (
      <Modal visible={showNextStepsModal} animationType="fade" transparent={true}>
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-xl m-5 w-11/12 max-w-md">
            <View className="p-5 border-b border-gray-100">
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-800 text-xl font-pbold">{nextStepsInfo.title}</Text>
                <TouchableOpacity onPress={() => setShowNextStepsModal(false)}>
                  <X size={24} color="#4B5563" />
                </TouchableOpacity>
              </View>
            </View>

            <View className="p-5">
              <Text className="text-gray-700 mb-4">{nextStepsInfo.description}</Text>

              {nextStepsInfo.steps.map((step, index) => (
                <View key={index} className="flex-row mb-3">
                  <View className="w-6 h-6 rounded-full bg-[#0D9F70] items-center justify-center mr-3 mt-0.5">
                    <Text className="text-white font-pbold">{index + 1}</Text>
                  </View>
                  <Text className="text-gray-700 flex-1">{step}</Text>
                </View>
              ))}

              <TouchableOpacity
                className="bg-[#0D9F70] py-3 rounded-lg items-center mt-4"
                onPress={() => setShowNextStepsModal(false)}
              >
                <Text className="text-white font-pmedium">Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    )
  }

  // Payment Method Selection Modal
  const renderPaymentMethodModal = () => {
    return (
      <Modal visible={showPaymentMethodModal} animationType="fade" transparent={true}>
        <View className="flex-1 bg-black/50 justify-end">
          <Animated.View
            style={{
              transform: [{ translateY: showPaymentMethodModal ? 0 : 300 }],
              maxHeight: "80%",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: "white",
              overflow: "hidden",
            }}
          >
            <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />

            <View className="px-6 py-2 flex-row justify-between items-center">
              <Text className="text-xl font-pbold text-gray-800">Payment Options</Text>
              <TouchableOpacity
                onPress={() => setShowPaymentMethodModal(false)}
                className="p-2 rounded-full bg-gray-100"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
              {milestoneToPayFor && (
                <View className="mb-4 mt-2">
                  <Text className="text-gray-700 font-pbold mb-2">Milestone Details:</Text>
                  <View className="bg-gray-50 p-3 rounded-lg">
                    <Text className="font-pmedium text-gray-800">{milestoneToPayFor.title}</Text>
                    <Text className="text-gray-600 text-sm mt-1">{milestoneToPayFor.description}</Text>
                    <View className="flex-row items-center mt-2">
                      <DollarSign size={16} color="#0D9F70" />
                      <Text className="text-gray-800 font-pmedium ml-1">
                        {proposal?.currency || "$"}
                        {Number.parseFloat(milestoneToPayFor.amount).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <PaymentMethodSelector
                milestone={milestoneToPayFor}
                chatId={chatId}
                onSelectManualPayment={() => {
                  setShowPaymentMethodModal(false)
                  setShowPaymentProofModal(true)
                }}
                onPaymentComplete={(method) => {
                  if (method === "stripe") {
                    // The actual payment will be handled by the StripePaymentHandler
                    // Just close this modal
                    setShowPaymentMethodModal(false)
                  }
                }}
              />

              {milestoneToPayFor && (
                <View className="mt-4 mb-8">
                  <Text className="text-gray-700 font-pbold mb-2">Pay with Stripe:</Text>
                  <StripePaymentHandler
                    milestone={milestoneToPayFor}
                    chatId={chatId}
                    onPaymentComplete={() => {
                      setShowPaymentMethodModal(false)
                      // The webhook will handle the status update
                    }}
                    currency={proposal?.currency || "$"}
                  />
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    )
  }

  // Review Modal
  const renderReviewModal = () => {
    return (
      <ReviewModal
        isVisible={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        chatId={chatId}
        jobId={jobId}
        proposalId={proposalId}
        isJobOwner={isJobOwner}
        freelancerId={chat?.proposal_owner_id}
        clientId={chat?.job_owner_id}
        onReviewSubmitted={handleReviewSubmitted}
      />
    )
  }

  // Review Detail Modal
  const renderReviewDetailModal = () => {
    return (
      <ReviewDetailModal
        isVisible={showReviewDetailModal}
        onClose={() => setShowReviewDetailModal(false)}
        review={selectedReview}
      />
    )
  }

  return (
    <Modal visible={isVisible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <Animated.View
          style={{
            transform: [{ translateY }],
            height: "90%",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: "white",
            overflow: "hidden",
          }}
        >
          <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />

          {/* Header */}
          <View className="px-6 py-2 flex-row justify-between items-center">
            <Text className="text-xl font-pbold text-gray-800">
              {agreement?.is_hourly ? "Time & Payments" : "Payment Milestones"}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="p-2 rounded-full bg-gray-100"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Scrollable content area */}
          <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
            {/* Enhanced Budget info */}
            <View className="bg-gray-50 p-4 rounded-xl my-4">
              {/* Total Budget Section */}
              <View className="mb-3">
                <Text className="text-gray-700 font-pbold mb-1">Total Budget:</Text>
                <View className="bg-white p-3 rounded-lg">
                  <View className="flex-row justify-between">
                    <Text className="text-gray-800 font-pbold text-lg">
                      {proposal?.currency || "$"}
                      {totalAmount.toFixed(2)}
                    </Text>
                  </View>

                  {/* Show calculation for hourly projects */}
                  {agreement?.is_hourly && (
                    <View className="mt-1 pt-1 border-t border-gray-100">
                      <Text className="text-sm text-gray-600">
                        {proposal?.currency || "$"}
                        {Number.parseFloat(agreement.hourly_rate).toFixed(2)}/hr ×{" "}
                        {Number.parseFloat(agreement.total_hours)} hours
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Progress Section */}
              <View className="flex-row mb-2">
                {/* Allocated Amount */}
                <View className="flex-1 mr-2">
                  <Text className="text-gray-700 mb-1">Allocated</Text>
                  <View className="bg-white p-2 rounded-lg">
                    <Text className="text-gray-800 font-pmedium">
                      {proposal?.currency || "$"}
                      {(totalAmount - remainingAmount).toFixed(2)}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {totalAmount > 0 ? Math.round(((totalAmount - remainingAmount) / totalAmount) * 100) : 0}% of
                      budget
                    </Text>
                  </View>
                </View>

                {/* Remaining Amount */}
                <View className="flex-1">
                  <Text className="text-gray-700 mb-1">Remaining</Text>
                  <View className="bg-white p-2 rounded-lg">
                    <Text className="text-green-600 font-pmedium">
                      {proposal?.currency || "$"}
                      {remainingAmount.toFixed(2)}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {totalAmount > 0 ? Math.round((remainingAmount / totalAmount) * 100) : 0}% of budget
                    </Text>
                  </View>
                </View>
              </View>

              {/* Visual progress bar */}
              <View className="h-2 bg-gray-200 rounded-full mt-1">
                <View
                  className="h-2 bg-[#0D9F70] rounded-full"
                  style={{
                    width: `${totalAmount > 0 ? Math.min(100, Math.round(((totalAmount - remainingAmount) / totalAmount) * 100)) : 0}%`,
                  }}
                />
              </View>

              {/* Additional status message based on budget allocation and completion */}
              {remainingAmount <= 0 && (
                <View className="mt-2 pt-2 border-t border-gray-100">
                  <Text
                    className={`text-sm ${allMilestonesCompleted ? "text-green-600" : "text-blue-600"} font-pmedium`}
                  >
                    {jobCompleted
                      ? "🎉 Job is completed! All milestones finished successfully."
                      : allMilestonesCompleted
                        ? "All milestones completed! Job can be marked as complete."
                        : "Budget fully allocated. Complete all milestones to finish job."}
                  </Text>
                </View>
              )}
            </View>

            {/* Reviews section - show if job is completed */}
            {jobCompleted && (
              <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
                <Text className="font-pbold text-gray-800 text-lg mb-3">Job Reviews</Text>

                {reviews.length > 0 ? (
                  <View>
                    {reviews.map((review) => (
                      <TouchableOpacity key={review.id} onPress={() => handleViewReview(review)} className="mb-3">
                        <ReviewBadge
                          rating={review.rating}
                          transactionHash={review.blockchain_tx_hash}
                          verified={review.blockchain_verified}
                          onPress={() => handleViewReview(review)}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View className="bg-gray-50 p-3 rounded-lg">
                    <Text className="text-gray-500 text-center">No reviews yet</Text>
                  </View>
                )}

                {/* Add review button if user hasn't submitted one yet */}
                {!hasSubmittedReview && (
                  <TouchableOpacity
                    className="bg-[#0D9F70] py-3 rounded-full flex-row justify-center items-center mt-3"
                    onPress={() => setShowReviewModal(true)}
                  >
                    <Star size={18} color="#fff" />
                    <Text className="ml-2 text-white font-pmedium">
                      {isJobOwner ? "Review Freelancer" : "Review Client"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Show milestone status flow diagram */}
            {renderMilestoneStatusFlow()}

            {loading ? (
              <View className="py-10 items-center">
                <ActivityIndicator size="large" color="#0D9F70" />
              </View>
            ) : (
              <>
                {milestones.length === 0 ? (
                  <View className="py-5 items-center">
                    <Text className="text-gray-500 text-center">
                      No {agreement?.is_hourly ? "timesheets" : "milestones"} yet.
                      {isJobOwner && !agreement?.is_hourly
                        ? " Create milestones to structure payments for this job."
                        : ""}
                      {!isJobOwner && agreement?.is_hourly ? " Submit timesheets to bill for your hours." : ""}
                    </Text>
                  </View>
                ) : (
                  milestones.map(renderMilestone)
                )}
              </>
            )}

            {/* Add extra padding at the bottom to ensure content is scrollable past the action buttons */}
            <View className="h-24" />
          </ScrollView>

          {/* Fixed action buttons at the bottom */}
          <View className="p-5 border-t border-gray-100">
            {agreement?.is_hourly
              ? // For hourly projects - timesheet button for freelancer
                !isJobOwner && (
                  <TouchableOpacity
                    className="bg-[#0D9F70] py-3 rounded-full flex-row justify-center items-center"
                    onPress={() => setShowTimesheetModal(true)}
                    disabled={adding}
                  >
                    {adding ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Plus size={18} color="#fff" />
                        <Text className="ml-2 text-white font-pmedium">Submit Timesheet</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )
              : // For fixed price projects - milestone button for job owner
                isJobOwner && (
                  <TouchableOpacity
                    className={`py-3 rounded-full flex-row justify-center items-center ${
                      remainingAmount > 0 ? "bg-[#0D9F70]" : "bg-gray-300"
                    }`}
                    onPress={() => remainingAmount > 0 && setShowAddMilestoneModal(true)}
                    disabled={remainingAmount <= 0}
                  >
                    <Plus size={18} color={remainingAmount > 0 ? "#fff" : "#888"} />
                    <Text className={`ml-2 font-pmedium ${remainingAmount > 0 ? "text-white" : "text-gray-500"}`}>
                      {remainingAmount > 0 ? "Add Milestone" : "Budget Fully Allocated"}
                    </Text>
                  </TouchableOpacity>
                )}

            {/* Show Complete Job button when all milestones are completed */}
            {isJobOwner && !agreement?.is_hourly && remainingAmount <= 0 && allMilestonesCompleted && !jobCompleted && (
              <TouchableOpacity
                className="bg-[#10B981] py-3 rounded-full flex-row justify-center items-center mt-3"
                onPress={completeJob}
              >
                <CheckCircle size={18} color="#fff" />
                <Text className="ml-2 text-white font-pmedium">Mark Job as Complete</Text>
              </TouchableOpacity>
            )}

            {/* Show job completed message */}
            {jobCompleted && !hasSubmittedReview && (
              <TouchableOpacity
                className="bg-[#0D9F70] py-3 rounded-full flex-row justify-center items-center mt-3"
                onPress={() => setShowReviewModal(true)}
              >
                <Star size={18} color="#fff" />
                <Text className="ml-2 text-white font-pmedium">
                  {isJobOwner ? "Review Freelancer" : "Review Client"}
                </Text>
              </TouchableOpacity>
            )}

            {jobCompleted && hasSubmittedReview && (
              <View className="bg-green-50 p-3 rounded-lg flex-row items-center mt-3">
                <CheckCircle size={18} color="#15803D" />
                <Text className="ml-2 text-green-800 font-pmedium">Job successfully completed!</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </View>

      {/* Render all modals */}
      {renderAddMilestoneModal()}
      {renderTimesheetModal()}
      {renderPaymentProofModal()}
      {renderPaymentMethodModal()}
      {renderImagePreviewModal()}
      {renderFullScreenImageModal()}
      {renderNextStepsModal()}
      {renderReviewModal()}
      {renderReviewDetailModal()}
    </Modal>
  )
}
