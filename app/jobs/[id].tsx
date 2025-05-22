"use client"

import { useEffect, useState } from "react"
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, Modal, Animated, Alert } from "react-native"
import { Star, X } from "lucide-react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import * as ImagePicker from "expo-image-picker"
import { createChatForProposal } from "@/lib/chat-service"

interface JobDetails {
  id: string
  title: string
  description: string
  amount: number
  currency: string
  created_at: string
  updated_at: string
  status: string
  location_address: string | null
  category_name: string | null
  client_name: string
  client_id: string
  payment_type: string
  time_required: number
  time_unit: string
  skill_level: string
  images: string[]
  rating: number | null
  review_text: string | null
  review_date: string | null
  hasProposal?: boolean
  proposalId?: string
}

export default function JobDetails() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useLocalSearchParams()
  const jobId = params.id as string
  const [job, setJob] = useState<JobDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProposalModal, setShowProposalModal] = useState(false)
  const [modalAnimation] = useState(new Animated.Value(0))
  const [proposalText, setProposalText] = useState("")
  const [rate, setRate] = useState("")
  const [hasDoneBefore, setHasDoneBefore] = useState(false)
  const [portfolioImages, setPortfolioImages] = useState<{ uri: string; name: string; type: string }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentType, setPaymentType] = useState<"hourly" | "project">("hourly")
  const [deletingProposal, setDeletingProposal] = useState(false)
  const [proposalCount, setProposalCount] = useState(0)

  useEffect(() => {
    if (!jobId) return

    const fetchJobDetails = async () => {
      try {
        setLoading(true)

        // Fetch the job details
        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select(`
            id, 
            title, 
            description, 
            amount, 
            currency, 
            created_at, 
            updated_at,
            status,
            location_address,
            payment_type,
            time_required,
            time_unit,
            skill_level,
            images,
            category:category_id(name),
            user_id
          `)
          .eq("id", jobId)
          .single()

        if (jobError) throw jobError
        if (!jobData) {
          setError("Job not found")
          return
        }

        // Set payment type based on job
        setPaymentType(jobData.payment_type)

        // Get client name
        const { data: clientProfile, error: clientError } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("user_id", jobData.user_id)
          .single()

        if (clientError) throw clientError

        // Get review for this job if the current user is the reviewee
        const { data: reviewData, error: reviewError } = await supabase
          .from("job_reviews")
          .select("rating, review_text, created_at")
          .eq("job_id", jobId)
          .eq("reviewee_id", user?.id)
          .maybeSingle()

        if (reviewError) throw reviewError

        // Check if user has already made a proposal for this job
        let hasProposal = false
        let proposalId = undefined

        if (user) {
          const { data: proposalData, error: proposalError } = await supabase
            .from("proposals")
            .select("id")
            .eq("job_id", jobId)
            .eq("user_id", user.id)
            .maybeSingle()

          if (!proposalError && proposalData) {
            hasProposal = true
            proposalId = proposalData.id
          }
        }

        // Get proposal count for this job
        const { count, error: countError } = await supabase
          .from("proposals")
          .select("*", { count: "exact", head: true })
          .eq("job_id", jobId)

        if (!countError) {
          setProposalCount(count || 0)
        }

        // Combine all the data
        setJob({
          id: jobData.id,
          title: jobData.title,
          description: jobData.description,
          amount: jobData.amount,
          currency: jobData.currency,
          created_at: jobData.created_at,
          updated_at: jobData.updated_at,
          status: jobData.status,
          location_address: jobData.location_address,
          category_name: jobData.category?.name || null,
          client_name: clientProfile?.full_name || "Unknown Client",
          client_id: jobData.user_id,
          payment_type: jobData.payment_type,
          time_required: jobData.time_required,
          time_unit: jobData.time_unit,
          skill_level: jobData.skill_level,
          images: jobData.images || [],
          rating: reviewData?.rating || null,
          review_text: reviewData?.review_text || null,
          review_date: reviewData?.created_at || null,
          hasProposal,
          proposalId,
        })
      } catch (err) {
        console.error("Error fetching job details:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch job details")
      } finally {
        setLoading(false)
      }
    }

    fetchJobDetails()
  }, [jobId]) // Removed user?.id from dependency array

  useEffect(() => {
    if (showProposalModal) {
      Animated.spring(modalAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 7,
      }).start()
    } else {
      Animated.timing(modalAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [showProposalModal])

  const renderStars = (rating: number | null) => {
    if (rating === null) return null

    return (
      <View className="flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} size={16} color="#FFB800" fill={star <= rating ? "#FFB800" : "transparent"} />
        ))}
      </View>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-[#0D9F70] text-white"
      case "in_progress":
        return "bg-amber-500 text-white"
      case "completed":
        return "bg-blue-500 text-white"
      case "cancelled":
        return "bg-red-500 text-white"
      default:
        return "bg-gray-500 text-white"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "open":
        return "Open"
      case "in_progress":
        return "In Progress"
      case "completed":
        return "Completed"
      case "cancelled":
        return "Cancelled"
      default:
        return status.replace("_", " ")
    }
  }

  const getSkillLevelText = (level: string) => {
    switch (level) {
      case "amateur":
        return "Amateur"
      case "intermediate":
        return "Intermediate"
      case "professional":
        return "Professional"
      default:
        return level
    }
  }

  const renderSkillStars = (level: string) => {
    let count = 1
    if (level === "intermediate") count = 2
    if (level === "professional") count = 3
    return (
      <View style={{ flexDirection: "row", alignItems: "center", marginRight: 4 }}>
        {[...Array(count)].map((_, i) => (
          <Star key={i} size={14} color="#0D9F70" fill="#0D9F70" strokeWidth={1.5} style={{ marginRight: 1 }} />
        ))}
      </View>
    )
  }

  const pickImage = async () => {
    if (portfolioImages.length >= 3) {
      Alert.alert("Maximum images", "You can only upload up to 3 images")
      return
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0]
        const uri = asset.uri
        const fileExtension = uri.split(".").pop() || "jpg"
        const fileName = `image_${Date.now()}.${fileExtension}`

        setPortfolioImages([
          ...portfolioImages,
          {
            uri,
            name: fileName,
            type: `image/${fileExtension}`,
          },
        ])
      }
    } catch (error) {
      console.error("Error picking image:", error)
      Alert.alert("Error", "Failed to pick image. Please try again.")
    }
  }

  const removeImage = (index: number) => {
    const newImages = [...portfolioImages]
    newImages.splice(index, 1)
    setPortfolioImages(newImages)
  }

  // This function creates a signed URL for direct upload
  const getSignedUrl = async (filePath: string, fileType: string) => {
    try {
      const { data, error } = await supabase.storage.from("portfolio").createSignedUploadUrl(filePath, {
        contentType: fileType,
      })

      if (error) throw error
      return data
    } catch (error) {
      console.error("Error getting signed URL:", error)
      throw error
    }
  }

  // This function uploads the image using fetch directly
  const uploadImageWithSignedUrl = async (image: { uri: string; name: string; type: string }) => {
    try {
      const filePath = `proposals/${user?.id}/${image.name}`

      // Get a signed URL for upload
      const { signedUrl, path } = await getSignedUrl(filePath, image.type)

      // Use fetch to upload the file directly
      const response = await fetch(image.uri)
      const blob = await response.blob()

      await fetch(signedUrl, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": image.type,
        },
      })

      // Get the public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("portfolio").getPublicUrl(path)

      return publicUrl
    } catch (error) {
      console.error("Error uploading image:", error)
      throw error
    }
  }

  const handleSubmitProposal = async () => {
    if (!job || !proposalText || !rate || !user) {
      Alert.alert("Missing information", "Please fill in all required fields")
      return
    }

    setIsSubmitting(true)

    try {
      // Upload images to Supabase Storage if there are any
      const imageUrls: string[] = []

      if (portfolioImages.length > 0) {
        for (const image of portfolioImages) {
          try {
            const publicUrl = await uploadImageWithSignedUrl(image)
            imageUrls.push(publicUrl)
          } catch (uploadError) {
            console.error("Error uploading image:", uploadError)
            // Continue with other images even if one fails
          }
        }
      }

      // Insert proposal into database
      const { data: proposal, error } = await supabase
        .from("proposals")
        .insert({
          job_id: job.id,
          user_id: user.id,
          proposal_text: proposalText,
          rate: Number.parseFloat(rate),
          payment_type: paymentType,
          has_done_before: hasDoneBefore,
          portfolio_images: imageUrls,
          status: "pending",
          currency: job.currency,
        })
        .select("id")
        .single()

      if (error) throw error

      if (!proposal || !proposal.id) {
        console.error("Proposal created but no ID returned")
        throw new Error("Proposal created but no ID returned")
      }

      console.log("Proposal created successfully:", proposal)

      // Create a chat for this proposal
      try {
        console.log("Creating chat for proposal:", {
          proposalId: proposal.id,
          jobId: job.id,
          jobType: "online", // Since we're in [id].tsx which is for online jobs
        })

        const chatResult = await createChatForProposal(
          job.id,
          proposal.id,
          "online", // Specify that this is an online job
          user.id, // Pass current user ID for logging
        )

        console.log("Chat creation result:", chatResult)

        Alert.alert("Success", "Your proposal has been submitted successfully!", [
          { text: "OK", onPress: () => setShowProposalModal(false) },
        ])
      } catch (chatError) {
        console.error("Error creating chat:", chatError)
        // Still show success for proposal, but mention chat issue
        Alert.alert(
          "Proposal Submitted",
          "Your proposal was submitted, but there was an issue setting up the chat. You may need to refresh the app.",
          [{ text: "OK", onPress: () => setShowProposalModal(false) }],
        )
      }

      // Reset form
      setProposalText("")
      setRate("")
      setHasDoneBefore(false)
      setPortfolioImages([])
    } catch (error) {
      console.error("Error submitting proposal:", error)
      Alert.alert("Error", "Failed to submit your proposal. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteProposal = async () => {
    if (!job || !job.proposalId || !user) {
      return
    }

    Alert.alert("Delete Proposal", "Are you sure you want to delete your proposal for this job?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingProposal(true)

            // 1. Fetch the proposal to get portfolio_images
            const { data: proposal, error: fetchError } = await supabase
              .from("proposals")
              .select("portfolio_images")
              .eq("id", job.proposalId)
              .eq("user_id", user.id)
              .single()

            if (fetchError) throw fetchError

            // 2. Delete images from storage if any
            if (proposal?.portfolio_images && proposal.portfolio_images.length > 0) {
              // Extract storage paths from public URLs
              const paths = proposal.portfolio_images
                .map((url: string) => {
                  const match = url.match(/portfolio\/(.+)$/)
                  return match ? match[1] : null
                })
                .filter(Boolean)

              if (paths.length > 0) {
                const { error: removeError } = await supabase.storage.from("portfolio").remove(paths)
                if (removeError) {
                  console.warn("Some images could not be deleted from storage:", removeError)
                }
              }
            }

            // 3. Delete the proposal row
            const { error } = await supabase.from("proposals").delete().eq("id", job.proposalId).eq("user_id", user.id)

            if (error) throw error

            // Update the local state
            setJob({
              ...job,
              hasProposal: false,
              proposalId: undefined,
            })

            // Update proposal count
            setProposalCount(Math.max(0, proposalCount - 1))

            Alert.alert("Success", "Your proposal has been deleted successfully.")
          } catch (error) {
            console.error("Error deleting proposal or images:", error)
            Alert.alert("Error", "Failed to delete your proposal. Please try again.")
          } finally {
            setDeletingProposal(false)
          }
        },
      },
    ])
  }

  const ProposalModal = () => {
    if (!job) return null

    const translateY = modalAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [300, 0],
    })

    const isExceedingBudget = job ? Number(rate) > job.amount : false

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={showProposalModal}
        onRequestClose={() => setShowProposalModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <Animated.View
            style={{
              transform: [{ translateY }],
              maxHeight: "90%",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: "white",
              overflow: "hidden",
            }}
          >
            <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />

            <View className="flex-row justify-between items-center px-6 py-3 border-b border-gray-100">
              <Text className="text-xl font-bold text-gray-800">Make an Offer</Text>
              <TouchableOpacity
                onPress={() => setShowProposalModal(false)}
                className="p-2 rounded-full bg-gray-100"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
              <View className="mb-4 mt-4">
                <Text className="text-sm font-medium text-gray-500 mb-1">Job</Text>
                <Text className="font-bold text-gray-800">{job.title}</Text>
              </View>
              {/* Additional form fields and logic here */}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    )
  }

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#0D9F70" />
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-red-500 text-center">{error}</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-white">
      {/* Job details UI here */}
      <ProposalModal />
    </View>
  )
}
