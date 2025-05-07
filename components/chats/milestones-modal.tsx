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
} from "lucide-react-native"
import DateTimePicker from "@react-native-community/datetimepicker"
import { format } from "date-fns"
import * as ImagePicker from "expo-image-picker"
import { decode } from "base64-arraybuffer"

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

  const fetchMilestones = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from("milestones")
        .select("*")
        .eq("chat_id", chatId)
        .order("due_date", { ascending: true })

      if (error) throw error

      // Process milestones to ensure payment proof URLs are valid
      const processedMilestones =
        data?.map((milestone) => {
          if (milestone.payment_proof_url) {
            // Add a cache-busting parameter to force reload
            milestone.payment_proof_url = `${milestone.payment_proof_url}?t=${new Date().getTime()}`
          }
          return milestone
        }) || []

      setMilestones(processedMilestones)
    } catch (error) {
      console.error("Error fetching milestones:", error)
      Alert.alert("Error", "Failed to load milestones")
    } finally {
      setLoading(false)
    }
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
      if (!milestone) return

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
          break
        case "payment_received":
          updateData.payment_received_at = new Date().toISOString()
          break
      }

      const { error } = await supabase.from("milestones").update(updateData).eq("id", id)

      if (error) throw error

      // Add system message to chat with appropriate message based on status
      let statusMessage = ""
      switch (newStatus) {
        case "accepted":
          statusMessage = `Milestone "${milestone.title}" was accepted by the freelancer`
          break
        case "completed":
          statusMessage = `Milestone "${milestone.title}" was marked as completed by the freelancer`
          break
        case "payment_released":
          statusMessage = `Payment for milestone "${milestone.title}" was released by the job poster`
          break
        case "payment_received":
          statusMessage = `Payment for milestone "${milestone.title}" was confirmed as received by the freelancer`
          break
        default:
          statusMessage = `Milestone "${milestone.title}" status was updated to ${newStatus}`
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
          "Once satisfied, they'll upload payment proof",
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
    if (!selectedImage || !milestoneToPayFor) {
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
      await supabase.from("messages").insert({
        chat_id: chatId,
        content: `Payment proof for milestone "${milestoneToPayFor.title}" was uploaded by the job poster`,
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

        {/* Payment proof section - improved with better error handling and UI */}
        {milestone.status === "payment_released" && (
          <View className="mb-3 border border-gray-200 rounded-lg p-3 bg-gray-50">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-gray-700 font-pmedium">Payment Proof:</Text>

              {milestone.payment_proof_url ? (
                <TouchableOpacity
                  className="bg-purple-100 px-2 py-1 rounded-full flex-row items-center"
                  onPress={() => viewPaymentProof(milestone.payment_proof_url)}
                >
                  <Eye size={14} color="#7E22CE" />
                  <Text className="ml-1 text-xs text-purple-700">View Proof</Text>
                </TouchableOpacity>
              ) : null}
            </View>

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
                    // Attempt to refresh the URL
                    const refreshedUrl = milestone.payment_proof_url + "?t=" + new Date().getTime()
                    // You could set a state here to update the URL
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
          </View>
        )}

        {/* Action buttons based on role and status */}
        <View className="flex-row mt-2 flex-wrap">
          {/* Freelancer actions */}
          {!isJobOwner && milestone.status === "pending" && (
            <TouchableOpacity
              className="bg-blue-500 px-4 py-2 rounded-full mr-2 mb-2"
              onPress={() => updateMilestoneStatus(milestone.id, "accepted")}
              disabled={updating || selectedMilestoneId === milestone.id}
            >
              <Text className="text-white font-pmedium">Accept Milestone</Text>
            </TouchableOpacity>
          )}

          {!isJobOwner && milestone.status === "accepted" && (
            <TouchableOpacity
              className="bg-yellow-500 px-4 py-2 rounded-full mr-2 mb-2"
              onPress={() => updateMilestoneStatus(milestone.id, "completed")}
              disabled={updating || selectedMilestoneId === milestone.id}
            >
              <Text className="text-white font-pmedium">Mark Work as Completed</Text>
            </TouchableOpacity>
          )}

          {!isJobOwner && milestone.status === "payment_released" && (
            <TouchableOpacity
              className="bg-green-500 px-4 py-2 rounded-full mr-2 mb-2"
              onPress={() => updateMilestoneStatus(milestone.id, "payment_received")}
              disabled={updating || selectedMilestoneId === milestone.id}
            >
              <Text className="text-white font-pmedium">Confirm Payment Received</Text>
            </TouchableOpacity>
          )}

          {/* Job owner actions */}
          {isJobOwner && milestone.status === "completed" && (
            <TouchableOpacity
              className="bg-purple-500 px-4 py-2 rounded-full mr-2 mb-2"
              onPress={() => {
                setMilestoneToPayFor(milestone)
                setShowPaymentProofModal(true)
              }}
              disabled={updating || uploadingProof || selectedMilestoneId === milestone.id}
            >
              <View className="flex-row items-center">
                <Upload size={16} color="#fff" className="mr-1" />
                <Text className="text-white font-pmedium">Upload Payment Proof</Text>
              </View>
            </TouchableOpacity>
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
                className="bg-[#0D9F70] py-4 rounded-lg flex-row justify-center items-center mt-2"
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
            </View>

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
                    className="bg-[#0D9F70] py-3 rounded-full flex-row justify-center items-center"
                    onPress={() => setShowAddMilestoneModal(true)}
                  >
                    <Plus size={18} color="#fff" />
                    <Text className="ml-2 text-white font-pmedium">Add Milestone</Text>
                  </TouchableOpacity>
                )}
          </View>
        </Animated.View>
      </View>

      {/* Render all modals */}
      {renderAddMilestoneModal()}
      {renderTimesheetModal()}
      {renderPaymentProofModal()}
      {renderImagePreviewModal()}
      {renderFullScreenImageModal()}
      {renderNextStepsModal()}
    </Modal>
  )
}
