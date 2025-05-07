"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native"
import { X, Upload, AlertCircle, Check, Info, MapPin } from "lucide-react-native"
import { supabase } from "@/lib/supabase"
import * as ImagePicker from "expo-image-picker"
import { createChatForProposal } from "@/lib/chat-service"

type OfflineJob = {
  id: string
  title: string
  amount: number
  currency: string
  user_id: string
  location?: string
  professional_certification_required?: boolean // <-- add this
}

interface MakeOfflineProposalModalProps {
  job: OfflineJob | null
  isVisible: boolean
  onClose: () => void
  userId: string
}

export const MakeOfflineProposalModal = ({ job, isVisible, onClose, userId }: MakeOfflineProposalModalProps) => {
  const [proposalText, setProposalText] = useState("")
  const [estimatedCost, setEstimatedCost] = useState("")
  const [hasDoneBefore, setHasDoneBefore] = useState(false)
  const [portfolioImages, setPortfolioImages] = useState<{ uri: string; name: string; type: string }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modalAnimation] = useState(new Animated.Value(0))
  const [minimumVisitFee, setMinimumVisitFee] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [userProfile, setUserProfile] = useState<{ minimum_visit_fee: number | null } | null>(null)

  useEffect(() => {
    if (isVisible) {
      fetchUserProfile()

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
  }, [isVisible])

  const fetchUserProfile = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("extended_profiles")
        .select("minimum_visit_fee")
        .eq("user_id", userId)
        .single()

      if (error) throw error

      if (data) {
        setUserProfile(data)
        setMinimumVisitFee(data.minimum_visit_fee)
      }
    } catch (error) {
      console.error("Error fetching user profile:", error)
      Alert.alert(
        "Profile Error",
        "Could not load your minimum visit fee. Please make sure you've set it in your profile.",
        [{ text: "OK" }],
      )
    } finally {
      setIsLoading(false)
    }
  }

  const isExceedingBudget = job ? Number(estimatedCost) > job.amount : false
  const isCertificationRequired = job?.professional_certification_required

  const getTotalAmount = () => {
    const baseRate = Number(estimatedCost) || 0
    if (minimumVisitFee) {
      return baseRate + minimumVisitFee
    }
    return baseRate
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
      const filePath = `proposals/${userId}/${image.name}`

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

  const handleSubmit = async () => {
    if (!job || !proposalText || !estimatedCost) {
      Alert.alert("Missing information", "Please fill in all required fields")
      return
    }

    if (isCertificationRequired && portfolioImages.length === 0) {
      Alert.alert(
        "Certification Required",
        "You must attach your certification as an image to apply for this job."
      )
      return
    }

    if (!minimumVisitFee) {
      Alert.alert(
        "Missing Minimum Visit Fee",
        "You need to set a minimum visit fee in your profile before submitting offline job proposals.",
        [{ text: "OK" }],
      )
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
          }
        }
      }

      // Calculate the total amount
      const totalAmount = getTotalAmount()

      // Insert into offline_proposals table
      const { data: proposal, error } = await supabase
        .from("offline_proposals")
        .insert({
          offline_job_id: job.id,
          user_id: userId,
          proposal_text: proposalText,
          rate: totalAmount,
          payment_type: "project",
          has_done_before: hasDoneBefore,
          portfolio_images: imageUrls,
          status: "pending",
          currency: job.currency,
          minimum_visit_fee: minimumVisitFee,
          estimated_cost: Number(estimatedCost),
          total_amount: totalAmount,
        })
        .select("id")
        .single()

      if (error) throw error

      if (!proposal || !proposal.id) {
        console.error("Proposal created but no ID returned")
        throw new Error("Proposal created but no ID returned")
      }

      // Optionally: create chat, etc.
      try {
        const chatResult = await createChatForProposal(
          job.id,            // offlineJobId (the id from offline_jobs)
          proposal.id,       // offlineProposalId (the id from offline_proposals)
          "offline",         // jobType
          job.user_id,       // jobOwnerId
          userId             // proposalOwnerId
        );
        console.log("Chat creation result:", chatResult)
        Alert.alert("Success", "Your offline proposal has been submitted successfully!", [
          { text: "OK", onPress: onClose },
        ])
      } catch (chatError) {
        console.error("Error creating chat:", chatError)
        Alert.alert(
          "Proposal Submitted",
          "Your proposal was submitted, but there was an issue setting up the chat. You may need to refresh the app.",
          [{ text: "OK", onPress: onClose }],
        )
      }

      // Reset form and close modal
      setProposalText("")
      setEstimatedCost("")
      setHasDoneBefore(false)
      setPortfolioImages([])
    } catch (error) {
      console.error("Error submitting offline proposal:", error)
      Alert.alert("Error", "Failed to submit your proposal. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!job) return null

  const translateY = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  })

  return (
    <Modal animationType="fade" transparent={true} visible={isVisible} onRequestClose={onClose}>
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
            <Text className="text-xl font-pbold text-gray-800">Make an Offline Offer</Text>
            <TouchableOpacity
              onPress={onClose}
              className="p-2 rounded-full bg-gray-100"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
            <View className="mb-4 mt-4">
              <Text className="text-sm font-pmedium text-gray-500 mb-1">Job</Text>
              <Text className="font-pbold text-gray-800">{job.title}</Text>
              <View className="mt-1 flex-row items-center">
                <View className="px-2 py-1 bg-blue-50 rounded-md self-start">
                  <Text className="text-xs font-pmedium text-blue-600">Offline Job</Text>
                </View>
                {job.location && (
                  <View className="flex-row items-center ml-2">
                    <MapPin size={14} color="#666" />
                    <Text className="text-xs text-gray-600 ml-1">{job.location}</Text>
                  </View>
                )}
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-pmedium text-gray-700 mb-2">Proposal Details</Text>
              <TextInput
                placeholder="Describe how you would approach this job..."
                className="bg-gray-50 rounded-xl p-4 min-h-[120px] text-gray-800 border border-gray-200"
                multiline
                textAlignVertical="top"
                value={proposalText}
                onChangeText={setProposalText}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-pmedium text-gray-700 mb-2">Estimated Costs ({job.currency})</Text>
              <TextInput
                placeholder="Enter your estimated costs"
                className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-gray-800"
                keyboardType="numeric"
                value={estimatedCost}
                onChangeText={setEstimatedCost}
              />

              {isExceedingBudget && (
                <View className="flex-row items-center mt-2">
                  <AlertCircle size={16} color="#f59e0b" />
                  <Text className="text-amber-600 text-sm ml-1">
                    Your estimate exceeds the client's budget ({job.currency} {job.amount})
                  </Text>
                </View>
              )}
            </View>

            {isLoading ? (
              <View className="mb-4 p-4 items-center">
                <ActivityIndicator color="#0D9F70" size="small" />
                <Text className="text-gray-600 mt-2">Loading your profile...</Text>
              </View>
            ) : minimumVisitFee !== null ? (
              <View className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <View className="flex-row items-center mb-2">
                  <Info size={16} color="#0D9F70" />
                  <Text className="text-gray-700 font-pmedium ml-2">Minimum Visit Fee</Text>
                </View>
                <Text className="text-gray-600 text-sm">
                  A minimum visit fee of {job.currency} {minimumVisitFee} will be added to your proposal.
                </Text>
                <View className="mt-3 pt-3 border-t border-gray-200">
                  <View className="flex-row justify-between">
                    <Text className="text-gray-600">Estimated Costs:</Text>
                    <Text className="text-gray-600">
                      {job.currency} {Number(estimatedCost) || 0}
                    </Text>
                  </View>
                  <View className="flex-row justify-between mt-1">
                    <Text className="text-gray-600">Minimum Visit Fee:</Text>
                    <Text className="text-gray-600">
                      {job.currency} {minimumVisitFee}
                    </Text>
                  </View>
                  <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
                    <Text className="font-pbold text-gray-800">Total:</Text>
                    <Text className="font-pbold text-gray-800">
                      {job.currency} {getTotalAmount()}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <View className="flex-row items-center">
                  <AlertCircle size={16} color="#f59e0b" />
                  <Text className="text-amber-700 font-pmedium ml-2">Missing Minimum Visit Fee</Text>
                </View>
                <Text className="text-amber-600 text-sm mt-1">
                  You need to set a minimum visit fee in your profile before submitting offline job proposals.
                </Text>
              </View>
            )}

            {isCertificationRequired && (
              <View className="mb-2 p-3 bg-blue-50 rounded-xl border border-blue-200 flex-row items-center">
                <Info size={16} color="#0D9F70" />
                <Text className="ml-2 text-blue-800 font-pmedium">
                  Attach your professional certification in the images (mandatory)
                </Text>
              </View>
            )}

            <View className="mb-4">
              <TouchableOpacity className="flex-row items-center" onPress={() => setHasDoneBefore(!hasDoneBefore)}>
                <View
                  className={`w-5 h-5 rounded mr-2 items-center justify-center ${
                    hasDoneBefore ? "bg-[#0D9F70]" : "border border-gray-300"
                  }`}
                >
                  {hasDoneBefore && <Check size={12} color="#fff" />}
                </View>
                <Text className="font-pmedium text-gray-700">I have done this type of job before</Text>
              </TouchableOpacity>
            </View>

            <View className="mb-6">
              <Text className="text-sm font-pmedium text-gray-700 mb-2">
                Portfolio Images {portfolioImages.length > 0 && `(${portfolioImages.length}/3)`}
              </Text>
              <View className="flex-row flex-wrap">
                {portfolioImages.map((image, index) => (
                  <View key={index} className="relative w-24 h-24 mr-2 mb-2 rounded-xl overflow-hidden">
                    <Image source={{ uri: image.uri }} className="w-full h-full" />
                    <TouchableOpacity
                      className="absolute top-1 right-1 bg-black/50 rounded-full p-1"
                      onPress={() => removeImage(index)}
                    >
                      <X size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}

                {portfolioImages.length < 3 && (
                  <TouchableOpacity
                    className="w-24 h-24 border border-dashed border-gray-300 rounded-xl items-center justify-center mr-2 mb-2"
                    onPress={pickImage}
                  >
                    <Upload size={20} color="#0D9F70" />
                    <Text className="text-xs text-[#0D9F70] mt-1 font-pmedium">Add Image</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text className="text-xs text-gray-500 mt-1">Upload up to 3 images to showcase your previous work</Text>
            </View>

            <View className="h-24" />
          </ScrollView>

          <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4">
            <TouchableOpacity
              className={`py-3.5 rounded-xl w-full items-center ${
                isSubmitting || !proposalText || !estimatedCost || minimumVisitFee === null
                  ? "bg-gray-300"
                  : "bg-[#0D9F70]"
              }`}
              onPress={handleSubmit}
              disabled={isSubmitting || !proposalText || !estimatedCost || minimumVisitFee === null}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-white font-pbold">Send Offline Proposal</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}
