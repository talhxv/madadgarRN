"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  Modal,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import * as FileSystem from "expo-file-system"
import { supabase } from "@/lib/supabase"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useNavigation } from "@react-navigation/native"
import "react-native-get-random-values"
import { v4 as uuidv4 } from "uuid"
import DateTimePicker from "@react-native-community/datetimepicker"
import LocationPicker from "@/components/LocationPicker"
import OfflineJobLocationPicker from "@/components/OfflineJobLocationPicker"
import * as ExpoLocation from "expo-location"
import { useAuth } from "@/contexts/AuthContext"

// Define types for your data structures
type Category = {
  id: string
  name: string
  type: string
  popularity_score: number
}

type LocationType = {
  id: string
  address: string
  updated_at: string
}

type OfflineJobDetails = {
  title: string
  description: string
  images: string[]
  availability_type: "specific_dates" | "flexible" | "asap"
  preferred_start_date: Date | null
  preferred_end_date: Date | null
  expected_budget: string
  currency: string
  professional_certification_required: boolean
  user_id: string
  location_id: string | null
  location_address: string
  location_details: string
  category_id: string | null
}

const OfflineJobCreationScreen: React.FC = () => {
  const { user } = useAuth() // <-- Use this user everywhere
  const params = useLocalSearchParams()
  const router = useRouter()
  const [step, setStep] = useState<number>(1)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [topCategories, setTopCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [locations, setLocations] = useState<LocationType[]>([])
  const [selectedLocation, setSelectedLocation] = useState<LocationType | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false)
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false)
  const [datePickerMode, setDatePickerMode] = useState<"start" | "end">("start")
  const [pickedMapLocation, setPickedMapLocation] = useState<any>(null)
  const navigation = useNavigation()

  // Job details state
  const [jobDetails, setJobDetails] = useState<OfflineJobDetails>({
    title: "",
    description: "",
    images: [],
    availability_type: "specific_dates",
    preferred_start_date: null,
    preferred_end_date: null,
    expected_budget: "",
    currency: "PKR",
    professional_certification_required: false,
    user_id: user.id,
    location_id: null,
    location_address: "",
    location_details: "",
    category_id: null,
  })

  // Handle back navigation
  const handleBack = () => {
    if (navigation) {
      navigation.goBack()
    } else {
      router.back()
    }
  }

  // Navigate to a specific step
  const navigateToStep = (targetStep: number) => {
    if (
      targetStep > step &&
      targetStep !== step + 1 &&
      !(step === 2 && targetStep === 2.5) &&
      !(step === 3 && targetStep === 3.5)
    ) {
      return
    }

    // Validation for moving to next steps
    if (targetStep > 1 && !selectedCategory) {
      alert("Please select a category first")
      return
    }

    if (targetStep > 2 && (!jobDetails.title || !jobDetails.description)) {
      alert("Please complete the description section first")
      return
    }

    if (targetStep > 2.5 && jobDetails.images.length === 0) {
      alert("Please add at least one photo for the offline job")
      return
    }

    // Allow going back to any previous step
    if (targetStep <= step) {
      setStep(targetStep)
      return
    }

    // Normal progression
    setStep(targetStep)
  }

  // Fetch categories from Supabase backend
  const fetchCategories = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from("job_categories")
        .select("*")
        .order("popularity_score", { ascending: false })

      if (error) throw error

      setCategories(data || [])

      // Get top categories with highest popularity scores
      const offlineCategories = data.filter((cat) => cat.type === "offline" || cat.type === "both")
      setTopCategories(offlineCategories.slice(0, 4))
    } catch (error) {
      console.error("Error fetching categories:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch user's saved locations
  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (error) throw error

      setLocations(data || [])
      // Set default to the latest location if available
      if (data.length > 0) {
        setSelectedLocation(data[0])
        setJobDetails({
          ...jobDetails,
          location_id: data[0].id,
          location_address: data[0].address,
        })
      }
    } catch (error) {
      console.error("Error fetching locations:", error)
    }
  }

  // Handle adding a new location
  const handleAddNewLocation = async (coordinates) => {
    try {
      setSubmitting(true)

      // Get address from coordinates using reverse geocoding
      const { latitude, longitude } = coordinates
      const addressResponse = await ExpoLocation.reverseGeocodeAsync({
        latitude,
        longitude,
      })

      let formattedAddress = "Unknown location"

      if (addressResponse && addressResponse.length > 0) {
        const address = addressResponse[0]
        const addressParts = [
          address.name,
          address.street,
          address.district,
          address.city,
          address.region,
          address.country,
        ].filter(Boolean)

        formattedAddress = addressParts.join(", ")
      }

      // Save the new location to the database
      const { data, error } = await supabase
        .from("locations")
        .insert([
          {
            user_id: user.id,
            geom: `POINT(${longitude} ${latitude})`,
            address: formattedAddress,
            accuracy: 10,
          },
        ])
        .select()

      if (error) throw error

      const newLocation = data[0]

      // Update locations list
      setLocations([newLocation, ...locations])

      // Update selected location
      setSelectedLocation(newLocation)

      // Update job details with the new location
      setJobDetails({
        ...jobDetails,
        location_id: newLocation.id,
        location_address: newLocation.address,
      })

      // Close the modal and show confirmation
      setShowLocationPicker(false)
      Alert.alert("New Location Added", "Your new location has been added successfully.")
    } catch (error) {
      console.error("Error adding new location:", error)
      Alert.alert("Error", "Failed to add new location. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Request location permissions
  const requestLocationPermission = async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync()
    return status === "granted"
  }

  useEffect(() => {
    fetchCategories()
    fetchLocations()
  }, [])

  const handleNext = () => {
    console.log("handleNext called, current step:", step)
    console.log("Selected category:", selectedCategory?.name)

    if (step === 1) {
      if (!selectedCategory) {
        alert("Please select a category")
        return
      }
      console.log("Moving to step 2")
      setStep(2)
      return
    }

    if (step === 2 && (!jobDetails.title || !jobDetails.description)) {
      alert("Please enter job title and description")
      return
    }

    if (step === 2) {
      setStep(2.5) // Go to photos sub-step
      return
    }

    if (step === 2.5 && jobDetails.images.length === 0) {
      alert("Please add at least one photo for the offline job")
      return
    }

    if (step === 2.5) {
      setStep(3) // Go to location step
      return
    }

    if (step === 3) {
      if (!selectedLocation) {
        alert("Please select a location")
        return
      }
      setStep(3.5) // Go to availability step
      return
    }

    if (step === 3.5) {
      if (
        jobDetails.availability_type === "specific_dates" &&
        (!jobDetails.preferred_start_date || !jobDetails.preferred_end_date)
      ) {
        alert("Please select both start and end dates")
        return
      }
      setStep(4) // Go to review step
      return
    }

    if (step === 4) {
      handleSubmitJob()
      return
    }
  }

  const handleCategorySelect = (category: Category) => {
    console.log("Category selected:", category.name) // Add logging for debugging
    setSelectedCategory(category)
    setJobDetails({ ...jobDetails, category_id: category.id })
  }

  const pickImages = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (permissionResult.granted === false) {
      alert("Permission to access camera roll is required!")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4], // Changed from [4, 3] to [3, 4] for more vertical photos
      quality: 1,
    })

    if (!result.canceled) {
      const newImages = [...jobDetails.images]
      if (newImages.length < 5) {
        newImages.push(result.assets[0].uri)
        setJobDetails({ ...jobDetails, images: newImages })
      } else {
        alert("Maximum 5 images allowed")
      }
    }
  }

  const removeImage = (index: number) => {
    const newImages = [...jobDetails.images]
    newImages.splice(index, 1)
    setJobDetails({ ...jobDetails, images: newImages })
  }

  const handleLocationSelect = (location) => {
    setSelectedLocation(location)
    setJobDetails({
      ...jobDetails,
      location_id: location.id,
      location_address: location.address,
    })
    setShowLocationPicker(false)
  }

  const confirmLocationSelection = () => {
    if (selectedLocation) {
      // Make sure the jobDetails state is updated with the selected location
      setJobDetails({
        ...jobDetails,
        location_id: selectedLocation.id,
        location_address: selectedLocation.address,
      })

      // Close the modal
      setShowLocationPicker(false)

      // Add a confirmation message
      Alert.alert("Location Selected", "Location has been updated successfully.")
    } else {
      Alert.alert("No Location Selected", "Please select a location before confirming.")
    }
  }

  const handleDateSelect = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false)
    }

    if (selectedDate) {
      if (datePickerMode === "start") {
        setJobDetails({ ...jobDetails, preferred_start_date: selectedDate })
      } else {
        setJobDetails({ ...jobDetails, preferred_end_date: selectedDate })
      }
    }
  }

  const handleSubmitJob = async () => {
    try {
      setSubmitting(true)

      if (!user) {
        alert("You must be logged in to create a job")
        return
      }

      if (!selectedLocation) {
        alert("Please select a location")
        setSubmitting(false)
        return
      }

      // 1. First upload images to storage
      const imageUrls = await uploadImages()

      if (imageUrls.length === 0) {
        alert("Failed to upload images. Please try again.")
        setSubmitting(false)
        return
      }

      // 2. Insert job data into database
      const { data, error } = await supabase
        .from("offline_jobs")
        .insert([
          {
            user_id: user.id,
            category_id: selectedCategory?.id,
            title: jobDetails.title,
            description: jobDetails.description,
            images: imageUrls,
            availability_type: jobDetails.availability_type,
            preferred_start_date: jobDetails.preferred_start_date,
            preferred_end_date: jobDetails.preferred_end_date,
            expected_budget: jobDetails.expected_budget ? Number.parseFloat(jobDetails.expected_budget) : null,
            currency: jobDetails.currency,
            professional_certification_required: jobDetails.professional_certification_required,
            location_id: selectedLocation.id,
            location_address: selectedLocation.address,
            location_details: jobDetails.location_details,
            status: "open", // Initial status
          },
        ])
        .select()

      if (error) throw error

      // 3. Navigate to success page
      router.push({
        pathname: "/job-success",
        params: { jobId: data[0].id, jobType: "offline" },
      })
    } catch (error) {
      console.error("Error creating job:", error)
      alert(`Failed to create job: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const uploadImages = async (): Promise<string[]> => {
    try {
      // Early return if no images to upload
      if (jobDetails.images.length === 0) return []

      const uploadedImageUrls: string[] = []

      for (let i = 0; i < jobDetails.images.length; i++) {
        const image = jobDetails.images[i]
        setUploadProgress((i / jobDetails.images.length) * 100)

        // Create a unique file name
        const fileExt = image.split(".").pop()
        const fileName = `${user.id}/${uuidv4()}.${fileExt}`
        const filePath = `${fileName}`

        // Read the file as base64
        const fileInfo = await FileSystem.getInfoAsync(image)
        if (!fileInfo.exists) {
          console.error("File doesn't exist")
          continue
        }

        const base64 = await FileSystem.readAsStringAsync(image, {
          encoding: FileSystem.EncodingType.Base64,
        })

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage.from("job_photos").upload(filePath, decode(base64), {
          contentType: "image/jpeg",
          upsert: false,
        })

        if (error) {
          console.error("Error uploading image:", error)
          continue
        }

        // Get the public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("job_photos").getPublicUrl(filePath)

        uploadedImageUrls.push(publicUrl)
      }

      setUploadProgress(100)
      return uploadedImageUrls
    } catch (error) {
      console.error("Error uploading images:", error)
      Alert.alert("Error", "Could not upload images")
      return []
    }
  }

  // Helper function to decode base64
  const decode = (base64: string): Uint8Array => {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  }

  const filteredCategories = searchQuery
    ? categories.filter(
        (cat) =>
          cat.name.toLowerCase().includes(searchQuery.toLowerCase()) && (cat.type === "offline" || cat.type === "both"),
      )
    : []

  // Custom progress step component
  const ProgressStep = ({
    number,
    title,
    active,
    stepNumber,
  }: { number: number; title: string; active: boolean; stepNumber: number }) => (
    <TouchableOpacity className="items-center" onPress={() => navigateToStep(stepNumber)} activeOpacity={0.7}>
      <View
        className={`rounded-full h-8 w-8 items-center justify-center ${active ? "bg-[#00684A]" : "border-2 border-gray-400"}`}
      >
        <Text className={active ? "text-white font-bold" : "text-gray-400 font-bold"}>{number}</Text>
      </View>
      <Text
        className={active ? "text-[#00684A] font-pitalic text-xs mt-1" : "text-gray-400 text-xs font-pregular mt-1"}
      >
        {title}
      </Text>
    </TouchableOpacity>
  )

  const renderJobDetailsStep = () => (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView className="flex-1 px-6">
        {/* Sub-step indicators */}
        <View className="flex-row justify-center mt-2 mb-4">
          <TouchableOpacity className="mx-1" onPress={() => setStep(2)} activeOpacity={0.7}>
            <View className={`h-2 w-2 rounded-full ${step === 2 ? "bg-[#00684A]" : "bg-gray-300"}`} />
          </TouchableOpacity>
          <TouchableOpacity className="mx-1" onPress={() => navigateToStep(2.5)} activeOpacity={0.7}>
            <View className={`h-2 w-2 rounded-full ${step === 2.5 ? "bg-[#00684A]" : "bg-gray-300"}`} />
          </TouchableOpacity>
        </View>

        {/* Job Title */}
        <View className="mt-2">
          <Text className="text-lg font-psemibold mb-1">Job Title</Text>
          <Text className="text-gray-500 font-pmediumitalic mb-2">Create a clear, specific title</Text>
          <TextInput
            className="bg-gray-100 rounded-lg p-3 text-gray-600"
            placeholder="e.g. Plumbing Repair in Kitchen"
            value={jobDetails.title}
            onChangeText={(text) => setJobDetails({ ...jobDetails, title: text })}
          />
        </View>

        {/* Job Description */}
        <View className="mt-6">
          <Text className="text-lg font-psemibold mb-1">Job Description</Text>
          <Text className="text-gray-500 font-pmediumitalic mb-2">Describe the job requirements in detail</Text>
          <TextInput
            className="bg-gray-100 rounded-lg p-3 text-gray-600 h-32"
            placeholder="Describe your job requirements, expectations, and any specific details..."
            multiline
            textAlignVertical="top"
            value={jobDetails.description}
            onChangeText={(text) => setJobDetails({ ...jobDetails, description: text })}
          />
        </View>
      </ScrollView>

      {/* Next Button */}
      <View className="mx-6 mt-auto mb-8">
        <TouchableOpacity className="bg-[#0D9F6F] rounded-lg p-4 items-center" onPress={handleNext}>
          <Text className="text-white font-psemibold text-lg">Next</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )

  const renderPhotosStep = () => (
    <View className="flex-1 px-6">
      {/* Sub-step indicators */}
      <View className="flex-row justify-center mt-2 mb-4">
        <TouchableOpacity className="mx-1" onPress={() => navigateToStep(2)} activeOpacity={0.7}>
          <View className={`h-2 w-2 rounded-full ${step === 2 ? "bg-[#00684A]" : "bg-gray-300"}`} />
        </TouchableOpacity>
        <TouchableOpacity className="mx-1" onPress={() => navigateToStep(2.5)} activeOpacity={0.7}>
          <View className={`h-2 w-2 rounded-full ${step === 2.5 ? "bg-[#00684A]" : "bg-gray-300"}`} />
        </TouchableOpacity>
      </View>

      <View className="mt-2">
        <Text className="text-2xl font-bold mb-1">Add photos</Text>
        <Text className="text-gray-500 text-lg mb-6">Photos are required for offline jobs</Text>

        {/* Image preview grid */}
        {jobDetails.images.length > 0 ? (
          <View className="flex-row flex-wrap">
            {jobDetails.images.map((img, index) => (
              <View key={index} className="w-1/3 p-1 relative">
                <Image source={{ uri: img }} className="w-full h-24 rounded-md" />
                <TouchableOpacity
                  className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1"
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close" size={18} color="white" />
                </TouchableOpacity>
              </View>
            ))}

            {jobDetails.images.length < 5 && (
              <TouchableOpacity
                className="w-1/3 h-24 bg-gray-100 rounded-md p-1 items-center justify-center"
                onPress={pickImages}
              >
                <Ionicons name="add" size={30} color="gray" />
                <Text className="text-gray-500 text-xs">Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            className="border-2 border-[#0D9F6F] border-dashed rounded-xl p-10 items-center justify-center"
            style={{ borderColor: "#0D9F6F" }}
            onPress={pickImages}
          >
            <View className="bg-gray-200 rounded-full p-4 mb-4">
              <Ionicons name="arrow-up" size={24} color="#666" />
            </View>
            <Text className="text-[#0D9F6F] text-lg font-pmedium mb-2">Tap to upload photo</Text>
            <Text className="text-gray-500 text-sm">JPG or PNG (Max 1200x800px)</Text>
          </TouchableOpacity>
        )}

        {/* Upload Progress Indicator */}
        {uploadProgress > 0 && (
          <View className="mt-4">
            <Text className="text-center mb-2">Uploading: {Math.round(uploadProgress)}%</Text>
            <View
              style={{
                height: 10,
                backgroundColor: "#e0e0e0",
                borderRadius: 5,
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${uploadProgress}%`,
                  backgroundColor: "#0D9F6F",
                  borderRadius: 5,
                }}
              />
            </View>
          </View>
        )}
      </View>

      {/* Next Button */}
      <View className="mx-6 mt-auto mb-8">
        <TouchableOpacity
          className={`rounded-lg p-4 items-center ${jobDetails.images.length > 0 ? "bg-[#0D9F6F]" : "bg-gray-400"}`}
          onPress={handleNext}
          disabled={jobDetails.images.length === 0}
        >
          <Text className="text-white font-psemibold text-lg">Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderLocationStep = () => (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView className="flex-1 px-6">
        {/* Sub-step indicators */}
        <View className="flex-row justify-center mt-2 mb-4">
          <TouchableOpacity className="mx-1" activeOpacity={0.7}>
            <View className="h-2 w-2 rounded-full bg-[#00684A]" />
          </TouchableOpacity>
          <TouchableOpacity className="mx-1" activeOpacity={0.7}>
            <View className="h-2 w-2 rounded-full bg-gray-300" />
          </TouchableOpacity>
        </View>

        {/* Location Selection */}
        <View className="mt-2">
          <Text className="text-lg font-psemibold mb-1">Job Location</Text>
          <Text className="text-gray-500 font-pmediumitalic mb-2">Select where the job will take place</Text>

          <TouchableOpacity
            className="bg-gray-100 rounded-lg p-3 flex-row items-center justify-between"
            onPress={() => setShowLocationPicker(true)}
          >
            <Text className="text-gray-600">{selectedLocation ? selectedLocation.address : "Select a location"}</Text>
            <Ionicons name="location" size={20} color="#00684A" />
          </TouchableOpacity>
        </View>

        {/* Location Details */}
        <View className="mt-6">
          <Text className="text-lg font-psemibold mb-1">Location Details</Text>
          <Text className="text-gray-500 font-pmediumitalic mb-2">Add specific details about the location</Text>
          <TextInput
            className="bg-gray-100 rounded-lg p-3 text-gray-600 h-20"
            placeholder="E.g., Apartment number, floor, landmark, etc."
            multiline
            textAlignVertical="top"
            value={jobDetails.location_details}
            onChangeText={(text) => setJobDetails({ ...jobDetails, location_details: text })}
          />
        </View>

        {/* Budget */}
        <View className="mt-6">
          <Text className="text-lg font-psemibold mb-1">Expected Budget</Text>
          <View className="flex-row items-center">
            <TextInput
              className="bg-gray-100 rounded-lg p-3 text-gray-600 flex-1"
              placeholder="0.00"
              keyboardType="numeric"
              value={jobDetails.expected_budget}
              onChangeText={(text) => setJobDetails({ ...jobDetails, expected_budget: text })}
            />
            <View className="ml-2 bg-gray-100 rounded-lg p-3 w-24">
              <Text className="text-gray-600 text-center">PKR</Text>
            </View>
          </View>
        </View>

        {/* Professional Certification */}
        <View className="mt-6">
          <Text className="text-lg font-psemibold mb-1">Professional Certification</Text>
          <TouchableOpacity
            className="flex-row items-center mt-2"
            onPress={() =>
              setJobDetails({
                ...jobDetails,
                professional_certification_required: !jobDetails.professional_certification_required,
              })
            }
          >
            <View
              className={`w-6 h-6 rounded-md border ${jobDetails.professional_certification_required ? "bg-[#00684A] border-[#00684A]" : "border-gray-400"} mr-2 items-center justify-center`}
            >
              {jobDetails.professional_certification_required && <Ionicons name="checkmark" size={16} color="white" />}
            </View>
            <Text className="text-gray-700">Require professional certification</Text>
          </TouchableOpacity>
          <Text className="text-gray-500 text-xs mt-2 ml-8">
            Note: Requiring professional certification may take longer to find qualified professionals as fewer users
            have verified certifications.
          </Text>
        </View>

        {/* Next Button */}
        <View className="mt-6 mb-8">
          <TouchableOpacity
            className={`bg-[#0D9F6F] rounded-lg p-4 items-center ${!selectedLocation ? "opacity-50" : ""}`}
            onPress={handleNext}
            disabled={!selectedLocation}
          >
            <Text className="text-white font-psemibold text-lg">Next</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center p-4 border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text className="flex-1 text-center text-lg font-psemibold">Select Location</Text>
            <View style={{ width: 24 }} />
          </View>
          {/* Map Picker */}
          <OfflineJobLocationPicker
            onLocationChange={setPickedMapLocation}
            initialLocation={pickedMapLocation}
          />
          {/* Confirm Button */}
          <View style={{ padding: 16, borderTopWidth: 1, borderColor: "#eee", backgroundColor: "#fff" }}>
            <TouchableOpacity
              style={{
                backgroundColor: pickedMapLocation ? "#0D9F6F" : "#ccc",
                borderRadius: 8,
                paddingVertical: 14,
                alignItems: "center",
              }}
              onPress={async () => {
                if (!pickedMapLocation) {
                  Alert.alert("No Location Picked", "Please pick a location on the map.");
                  return;
                }
                try {
                  const authUser = await supabase.auth.getUser();
                  console.log("Auth user:", authUser);
                  console.log("user.id:", user.id);
                  console.log("pickedMapLocation:", pickedMapLocation);
                  const { data, error } = await supabase
                    .from("locations")
                    .insert([{
                      user_id: user.id,
                      address: pickedMapLocation.address,
                      geom: `POINT(${pickedMapLocation.longitude} ${pickedMapLocation.latitude})`,
                      accuracy: 10,
                    }])
                    .select();
                  if (error) {
                    console.error("Supabase location insert error:", error);
                    Alert.alert("Error", error.message || "Could not save location.");
                    return;
                  }
                  const newLocation = data[0];
                  setLocations([newLocation, ...locations]);
                  setSelectedLocation(newLocation);
                  setJobDetails({
                    ...jobDetails,
                    location_id: newLocation.id,
                    location_address: newLocation.address,
                  });
                  setShowLocationPicker(false);
                } catch (err) {
                  console.error("Unexpected error saving location:", err);
                  Alert.alert("Error", err.message || "Could not save location.");
                }
              }}
              disabled={!pickedMapLocation}
            >
              <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  )

  const renderAvailabilityStep = () => (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView className="flex-1 px-6">
        {/* Sub-step indicators */}
        <View className="flex-row justify-center mt-2 mb-4">
          <TouchableOpacity className="mx-1" activeOpacity={0.7}>
            <View className="h-2 w-2 rounded-full bg-gray-300" />
          </TouchableOpacity>
          <TouchableOpacity className="mx-1" activeOpacity={0.7}>
            <View className="h-2 w-2 rounded-full bg-[#00684A]" />
          </TouchableOpacity>
        </View>

        {/* Availability Type */}
        <View className="mt-2">
          <Text className="text-lg font-psemibold mb-2">Availability Type</Text>
          <View className="flex-row flex-wrap">
            <TouchableOpacity
              className={`mr-2 mb-2 px-4 py-2 rounded-full ${jobDetails.availability_type === "specific_dates" ? "bg-[#00684A]" : "bg-gray-200"}`}
              onPress={() => setJobDetails({ ...jobDetails, availability_type: "specific_dates" })}
            >
              <Text className={jobDetails.availability_type === "specific_dates" ? "text-white" : "text-gray-700"}>
                Specific Dates
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`mr-2 mb-2 px-4 py-2 rounded-full ${jobDetails.availability_type === "flexible" ? "bg-[#00684A]" : "bg-gray-200"}`}
              onPress={() => setJobDetails({ ...jobDetails, availability_type: "flexible" })}
            >
              <Text className={jobDetails.availability_type === "flexible" ? "text-white" : "text-gray-700"}>
                Flexible
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`mr-2 mb-2 px-4 py-2 rounded-full ${jobDetails.availability_type === "asap" ? "bg-[#00684A]" : "bg-gray-200"}`}
              onPress={() => setJobDetails({ ...jobDetails, availability_type: "asap" })}
            >
              <Text className={jobDetails.availability_type === "asap" ? "text-white" : "text-gray-700"}>
                As Soon As Possible
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Selection - Only show if specific_dates is selected */}
        {jobDetails.availability_type === "specific_dates" && (
          <View className="mt-6">
            <Text className="text-lg font-psemibold mb-2">Preferred Dates</Text>

            {/* Start Date */}
            <View className="mb-4">
              <Text className="text-gray-500 mb-1">Start Date</Text>
              <TouchableOpacity
                className="bg-gray-100 rounded-lg p-4 flex-row items-center justify-between border border-gray-200"
                onPress={() => {
                  setDatePickerMode("start")
                  setShowDatePicker(true)
                }}
              >
                <View className="flex-row items-center">
                  <Ionicons name="calendar-outline" size={20} color="#00684A" style={{ marginRight: 10 }} />
                  <Text className={jobDetails.preferred_start_date ? "text-gray-800 font-pmedium" : "text-gray-400"}>
                    {jobDetails.preferred_start_date
                      ? jobDetails.preferred_start_date.toLocaleDateString()
                      : "Select start date"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#00684A" />
              </TouchableOpacity>
            </View>

            {/* End Date */}
            <View className="mb-4">
              <Text className="text-gray-500 mb-1">End Date</Text>
              <TouchableOpacity
                className={`bg-gray-100 rounded-lg p-4 flex-row items-center justify-between border ${!jobDetails.preferred_start_date ? "border-gray-200 opacity-50" : "border-gray-200"}`}
                onPress={() => {
                  if (jobDetails.preferred_start_date) {
                    setDatePickerMode("end")
                    setShowDatePicker(true)
                  } else {
                    alert("Please select a start date first")
                  }
                }}
                disabled={!jobDetails.preferred_start_date}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={jobDetails.preferred_start_date ? "#00684A" : "#999"}
                    style={{ marginRight: 10 }}
                  />
                  <Text className={jobDetails.preferred_end_date ? "text-gray-800 font-pmedium" : "text-gray-400"}>
                    {jobDetails.preferred_end_date
                      ? jobDetails.preferred_end_date.toLocaleDateString()
                      : "Select end date"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color={jobDetails.preferred_start_date ? "#00684A" : "#999"} />
              </TouchableOpacity>
              {!jobDetails.preferred_start_date && (
                <Text className="text-xs text-gray-500 mt-1 ml-1">Please select a start date first</Text>
              )}
            </View>

            {/* Selected Date Range Summary - only show when both dates are selected */}
            {jobDetails.preferred_start_date && jobDetails.preferred_end_date && (
              <View className="bg-[#E6F7F1] p-3 rounded-lg mb-4">
                <Text className="text-[#00684A] font-pmedium">
                  Job will be available from {jobDetails.preferred_start_date.toLocaleDateString()} to{" "}
                  {jobDetails.preferred_end_date.toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Date Picker Modal */}
        {showDatePicker && Platform.OS === "ios" && (
          <DateTimePicker
            value={
              datePickerMode === "start"
                ? jobDetails.preferred_start_date || new Date()
                : jobDetails.preferred_end_date || new Date()
            }
            mode="date"
            display="spinner"
            onChange={handleDateSelect}
            minimumDate={
              datePickerMode === "end" && jobDetails.preferred_start_date ? jobDetails.preferred_start_date : new Date()
            }
            textColor="#00684A"
            accentColor="#00684A"
            style={{ backgroundColor: "white" }}
          />
        )}

        {showDatePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={
              datePickerMode === "start"
                ? jobDetails.preferred_start_date || new Date()
                : jobDetails.preferred_end_date || new Date()
            }
            mode="date"
            display="default"
            onChange={handleDateSelect}
            minimumDate={
              datePickerMode === "end" && jobDetails.preferred_start_date ? jobDetails.preferred_start_date : new Date()
            }
            themeVariant="light"
            accentColor="#00684A"
          />
        )}
      </ScrollView>

      {/* Next Button - Positioned at the bottom consistently with other screens */}
      <View className="mx-6 mt-auto mb-8">
        <TouchableOpacity
          className={`rounded-lg p-4 items-center ${
            jobDetails.availability_type !== "specific_dates" ||
            (jobDetails.preferred_start_date && jobDetails.preferred_end_date)
              ? "bg-[#0D9F6F]"
              : "bg-gray-400"
          }`}
          onPress={handleNext}
          disabled={
            jobDetails.availability_type === "specific_dates" &&
            (!jobDetails.preferred_start_date || !jobDetails.preferred_end_date)
          }
        >
          <Text className="text-white font-psemibold text-lg">Next</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )

  const renderReviewStep = () => (
    <View className="flex-1">
      <ScrollView className="flex-1 px-6">
        <View className="mt-6">
          <Text className="text-2xl font-psemibold mb-4">Review Job Details</Text>

          {/* Category */}
          <View className="mb-4">
            <Text className="text-gray-500 font-pmedium mb-1">Category</Text>
            <Text className="text-lg font-semibold">{selectedCategory?.name || "Not selected"}</Text>
          </View>

          {/* Title */}
          <View className="mb-4">
            <Text className="text-gray-500 font-pmedium mb-1">Job Title</Text>
            <Text className="text-lg font-semibold">{jobDetails.title}</Text>
          </View>

          {/* Description */}
          <View className="mb-4">
            <Text className="text-gray-500 font-pmedium mb-1">Description</Text>
            <Text className="text-base">{jobDetails.description}</Text>
          </View>

          {/* Images */}
          {jobDetails.images.length > 0 && (
            <View className="mb-4">
              <Text className="text-gray-500 font-pmedium mb-2">Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {jobDetails.images.map((uri, index) => (
                  <Image key={index} source={{ uri }} className="w-20 h-20 rounded-md mr-2" />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Location */}
          <View className="mb-4">
            <Text className="text-gray-500 font-pmedium mb-1">Location</Text>
            <Text className="text-lg font-semibold">
              {selectedLocation ? selectedLocation.address : "Not selected"}
            </Text>
            {jobDetails.location_details && <Text className="text-base mt-1">{jobDetails.location_details}</Text>}
          </View>

          {/* Budget */}
          {jobDetails.expected_budget && (
            <View className="mb-4">
              <Text className="text-gray-500 font-pmedium mb-1">Expected Budget</Text>
              <Text className="text-lg font-semibold">
                {jobDetails.expected_budget} {jobDetails.currency}
              </Text>
            </View>
          )}

          {/* Availability */}
          <View className="mb-4">
            <Text className="text-gray-500 font-pmedium mb-1">Availability</Text>
            <Text className="text-lg font-semibold capitalize">{jobDetails.availability_type.replace(/_/g, " ")}</Text>
            {jobDetails.availability_type === "specific_dates" &&
              jobDetails.preferred_start_date &&
              jobDetails.preferred_end_date && (
                <Text className="text-base mt-1">
                  From {jobDetails.preferred_start_date.toLocaleDateString()} to{" "}
                  {jobDetails.preferred_end_date.toLocaleDateString()}
                </Text>
              )}
          </View>

          {/* Professional Certification */}
          <View className="mb-4">
            <Text className="text-gray-500 font-pmedium mb-1">Professional Certification</Text>
            <Text className="text-lg font-semibold">
              {jobDetails.professional_certification_required ? "Required" : "Not Required"}
            </Text>
          </View>

          {/* Add some padding at the bottom to ensure content doesn't get hidden behind the button */}
          <View className="h-20" />
        </View>
      </ScrollView>

      {/* Submit Button - Now outside the ScrollView */}
      <View className="px-6 absolute bottom-8 left-0 right-0 bg-white">
        <TouchableOpacity
          className="bg-[#0D9F6F] rounded-lg p-4 items-center"
          onPress={handleNext}
          disabled={submitting}
        >
          <Text className="text-white font-psemibold text-lg">{submitting ? "Submitting..." : "Post Job"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View className="flex-1 px-6">
            <Text className="text-lg font-psemibold mb-4">Select a Category</Text>
            <TextInput
              className="bg-gray-100 rounded-lg p-3 text-gray-600 mb-4"
              placeholder="Search categories..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <FlatList
              data={searchQuery ? filteredCategories : topCategories}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className={`p-4 mb-2 rounded-lg ${selectedCategory?.id === item.id ? "bg-[#00684A]" : "bg-gray-100"}`}
                  onPress={() => handleCategorySelect(item)}
                >
                  <Text className={`font-pmedium ${selectedCategory?.id === item.id ? "text-white" : "text-gray-600"}`}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <View className="mt-auto mb-8">
              <TouchableOpacity
                className={`rounded-lg p-4 items-center ${selectedCategory ? "bg-[#0D9F6F]" : "bg-gray-400"}`}
                onPress={() => selectedCategory && handleNext()}
              >
                <Text className="text-white font-psemibold text-lg">Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      case 2:
        return renderJobDetailsStep()
      case 2.5:
        return renderPhotosStep()
      case 3:
        return renderLocationStep()
      case 3.5:
        return renderAvailabilityStep()
      case 4:
        return renderReviewStep()
      default:
        return null
    }
  }

  const getCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission()

    if (!hasPermission) {
      Alert.alert("Permission Required", "Location permission is required to use this feature.", [{ text: "OK" }])
      return null
    }

    try {
      const location = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      })
      return location.coords
    } catch (error) {
      console.error("Error getting current location:", error)
      Alert.alert("Error", "Could not get your current location.")
      return null
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="light-content" />

      {/* Custom Header with Back Button */}
      <View className="bg-[#0D9F6F] pt-7 pb-6 rounded-b-[40px]">
        <View className="flex-row items-center px-6 pt-2">
          <TouchableOpacity onPress={handleBack} className="p-2">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-white text-xl font-psemibold mr-10">Offline Job Creation</Text>
        </View>
      </View>

      <View className="flex-1">
        {/* Progress Steps */}
        <View className="flex-row justify-between px-6 mt-3 mb-3">
          <ProgressStep number={1} title="Category" active={step === 1} stepNumber={1} />
          <ProgressStep number={2} title="Description" active={step === 2 || step === 2.5} stepNumber={2} />
          <ProgressStep number={3} title="Details" active={step === 3 || step === 3.5} stepNumber={3} />
          <ProgressStep number={4} title="Review" active={step === 4} stepNumber={4} />
        </View>

        {/* Step Content */}
        {renderStepContent()}
      </View>
    </SafeAreaView>
  )
}

export default OfflineJobCreationScreen
