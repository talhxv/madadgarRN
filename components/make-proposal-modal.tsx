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
import { X, Upload, AlertCircle, Check } from "lucide-react-native"
import { supabase } from "@/lib/supabase"
import * as ImagePicker from "expo-image-picker"
import { createChatForProposal } from "@/lib/chat-service";

type Job = {
  id: string
  title: string
  payment_type: "hourly" | "project"
  amount: number
  currency: string
}

interface MakeProposalModalProps {
  job: Job | null
  isVisible: boolean
  onClose: () => void
  userId: string
}

export const MakeProposalModal = ({ job, isVisible, onClose, userId }: MakeProposalModalProps) => {
  const [proposalText, setProposalText] = useState("")
  const [rate, setRate] = useState("")
  const [hasDoneBefore, setHasDoneBefore] = useState(false)
  const [portfolioImages, setPortfolioImages] = useState<{ uri: string; name: string; type: string }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentType, setPaymentType] = useState<"hourly" | "project">("hourly")
  const [modalAnimation] = useState(new Animated.Value(0))

  useEffect(() => {
    if (job) {
      setPaymentType(job.payment_type)
    }
  }, [job])

  useEffect(() => {
    if (isVisible) {
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

  const isExceedingBudget = job ? Number(rate) > job.amount : false

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
    if (!job || !proposalText || !rate) {
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
          user_id: userId,
          proposal_text: proposalText,
          rate: Number.parseFloat(rate),
          payment_type: paymentType,
          has_done_before: hasDoneBefore,
          portfolio_images: imageUrls,
          status: "pending",
          currency: job.currency,
        })
        .select("id")
        .single();

      if (error) throw error;
      
      if (!proposal || !proposal.id) {
        console.error("Proposal created but no ID returned");
        throw new Error("Proposal created but no ID returned");
      }

      console.log("Proposal created successfully:", proposal);

      // Create a chat for this proposal
      try {
        console.log("Creating chat for proposal:", {
          proposalId: proposal.id,
          jobId: job.id,
          jobOwnerId: job.user_id,
          proposalOwnerId: userId
        });

        const chatResult = await createChatForProposal(
          job.id, 
          proposal.id, 
          job.user_id, 
          userId
        );
        
        console.log("Chat creation result:", chatResult);
        
        Alert.alert(
          "Success", 
          "Your proposal has been submitted successfully!", 
          [{ text: "OK", onPress: onClose }]
        );
      } catch (chatError) {
        console.error("Error creating chat:", chatError);
        // Still show success for proposal, but mention chat issue
        Alert.alert(
          "Proposal Submitted", 
          "Your proposal was submitted, but there was an issue setting up the chat. You may need to refresh the app.",
          [{ text: "OK", onPress: onClose }]
        );
      }

      // Reset form and close modal
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
            <Text className="text-xl font-pbold text-gray-800">Make an Offer</Text>
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
              <Text className="text-sm font-pmedium text-gray-700 mb-2">Payment Type</Text>
              <View className="flex-row">
                <TouchableOpacity
                  className={`flex-row items-center mr-6 p-2 rounded-lg ${
                    paymentType === "hourly" ? "bg-[#E7F7F1]" : "bg-transparent"
                  }`}
                  onPress={() => {}}
                  disabled={job?.payment_type !== "hourly"}
                  style={job?.payment_type !== "hourly" ? { opacity: 0.5 } : {}}
                >
                  <View
                    className={`w-5 h-5 rounded-full mr-2 items-center justify-center ${
                      paymentType === "hourly" ? "bg-[#0D9F70]" : "border border-gray-300"
                    }`}
                  >
                    {paymentType === "hourly" && <Check size={12} color="#fff" />}
                  </View>
                  <Text className={`font-pmedium ${paymentType === "hourly" ? "text-[#0D9F70]" : "text-gray-700"}`}>
                    Hourly Rate
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-row items-center p-2 rounded-lg ${
                    paymentType === "project" ? "bg-[#E7F7F1]" : "bg-transparent"
                  }`}
                  onPress={() => {}}
                  disabled={job?.payment_type !== "project"}
                  style={job?.payment_type !== "project" ? { opacity: 0.5 } : {}}
                >
                  <View
                    className={`w-5 h-5 rounded-full mr-2 items-center justify-center ${
                      paymentType === "project" ? "bg-[#0D9F70]" : "border border-gray-300"
                    }`}
                  >
                    {paymentType === "project" && <Check size={12} color="#fff" />}
                  </View>
                  <Text className={`font-pmedium ${paymentType === "project" ? "text-[#0D9F70]" : "text-gray-700"}`}>
                    Project Rate
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm font-pmedium text-gray-700 mb-2">
                {paymentType === "hourly" ? "Hourly Rate" : "Project Rate"} ({job.currency})
              </Text>
              <TextInput
                placeholder={`Enter your ${paymentType === "hourly" ? "hourly" : "project"} rate`}
                className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-gray-800"
                keyboardType="numeric"
                value={rate}
                onChangeText={setRate}
              />

              {isExceedingBudget && (
                <View className="flex-row items-center mt-2">
                  <AlertCircle size={16} color="#f59e0b" />
                  <Text className="text-amber-600 text-sm ml-1">
                    Your rate exceeds the client's budget ({job.currency} {job.amount})
                  </Text>
                </View>
              )}
            </View>

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
                isSubmitting || !proposalText || !rate ? "bg-gray-300" : "bg-[#0D9F70]"
              }`}
              onPress={handleSubmit}
              disabled={isSubmitting || !proposalText || !rate}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-white font-pbold">Send Proposal</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}
