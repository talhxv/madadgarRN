"use client"

import { useState, useEffect } from "react"
import {
    View,
    Text,
    TouchableOpacity,
    ImageBackground,
    Platform,
    KeyboardAvoidingView,
    TextInput,
    Alert,
    Image,
} from "react-native"
import { StatusBar } from "expo-status-bar"
import { router } from "expo-router"
import { supabase } from "@/supabaseClient"
import * as ImagePicker from "expo-image-picker"
import { BlurView } from "expo-blur"
import { uploadToS3, compareFaces } from "@/lib/aws-config"
import DateTimePicker from "@react-native-community/datetimepicker"

interface Profile {
    name: string
    dob: Date
    nicNumber: string
}

// Add this function above your component
const isValidPakistaniNIC = (nic: string) => {
    // Regex for 5 digits, dash, 7 digits, dash, 1 digit
    return /^\d{5}-\d{7}-\d{1}$/.test(nic)
}

export default function CreateProfileScreen() {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [nicImage, setNicImage] = useState<string | null>(null)
    const [selfieImage, setSelfieImage] = useState<string | null>(null)
    const [dateInput, setDateInput] = useState("")
    const [sessionData, setSessionData] = useState<any>(null)
    const [verificationError, setVerificationError] = useState<string | null>(null)
    const [showDatePicker, setShowDatePicker] = useState(false)

    const [profile, setProfile] = useState<Profile>({
        name: "",
        dob: new Date(),
        nicNumber: "",
    });

    useEffect(() => {
        getSession()
    }, [])

    const getSession = async () => {
        const {
            data: { session },
            error,
        } = await supabase.auth.getSession()
        if (error) {
            console.error("Session Error:", error)
            router.replace("/")
            return
        }
        setSessionData(session)
    }

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false)
        if (selectedDate) {
            setProfile({ ...profile, dob: selectedDate })
            const month = String(selectedDate.getMonth() + 1).padStart(2, "0")
            const day = String(selectedDate.getDate()).padStart(2, "0")
            const year = selectedDate.getFullYear()
            setDateInput(`${month}/${day}/${year}`)
        }
    }

    const pickImage = async (type: "nic" | "selfie") => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: type === "selfie" ? [1, 1] : [4, 3],
                quality: 0.7,
            })

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const selectedAsset = result.assets[0]
                if (type === "nic") {
                    setNicImage(selectedAsset.uri)
                } else {
                    setSelfieImage(selectedAsset.uri)
                }
                setVerificationError(null)
            }
        } catch (error) {
            console.error("Image picker error:", error)
            Alert.alert("Error", "Failed to pick image. Please try again.")
        }
    }

    const handleCreateProfile = async () => {
        try {
            setLoading(true)
            setError(null)

            if (!sessionData?.user) throw new Error("No authenticated user found")
            if (!nicImage || !selfieImage) throw new Error("Both photos are required")

            const nicFileName = `nic-${sessionData.user.id}-${Date.now()}.jpg`
            const selfieFileName = `selfie-${sessionData.user.id}-${Date.now()}.jpg`

            // Upload images to S3
            const [nicUrl, selfieUrl] = await Promise.all([
                uploadToS3(nicImage, nicFileName),
                uploadToS3(selfieImage, selfieFileName),
            ])

            // Compare faces using Rekognition
            try {
                const compareResult = await compareFaces(nicImage, selfieImage)
                const similarity = compareResult.FaceMatches?.[0]?.Similarity || 0
                const isVerified = similarity >= 50

                if (!isVerified) {
                    setVerificationError("Face verification failed. Please ensure photos are clear and try again.")
                    setStep(3) // Stay on the photo step
                    return
                }

                const phoneNumber = sessionData.user.phone?.replace("+", "") || ""

                // Create profile in Supabase
                const { error: profileError } = await supabase.from("profiles").insert([
                    {
                        user_id: sessionData.user.id,
                        full_name: profile.name,
                        phone_number: phoneNumber,
                        dob: profile.dob.toISOString().split("T")[0],
                        nic_number: profile.nicNumber,
                        is_verified: isVerified,
                    },
                ])

                if (profileError) throw profileError

                // Create verification record
                const { error: verificationError } = await supabase.from("user_verifications").insert([
                    {
                        user_id: sessionData.user.id,
                        nic_image_url: nicUrl.Location,
                        selfie_image_url: selfieUrl.Location,
                        verification_score: similarity,
                        is_verified: isVerified,
                        verified_at: new Date().toISOString(),
                    },
                ])

                if (verificationError) throw verificationError

                setStep(4) // Move to success step
            } catch (error: any) {
                if (error.name === "InvalidParameterException") {
                    setVerificationError("No face detected in one or both images. Please try again with clear photos.")
                    setStep(3) // Stay on the photo step
                    return
                }
                throw error
            }
        } catch (error: any) {
            console.error("Profile Creation Error:", error)
            setError(error.message || "An unknown error occurred")
            Alert.alert("Error", error.message)
        } finally {
            setLoading(false)
        }
    }

    const renderProgressDots = () => (
        <View className="flex-row justify-center space-x-3 mb-2">
            {[1, 2, 3, 4].map((dotStep) => (
                <View key={dotStep} className={`w-3 h-3 mr-3 rounded-full ${step >= dotStep ? "bg-[#0D9F6F]" : "bg-gray-300"}`} />
            ))}
        </View>
    )

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <View>
                        <View className="mb-4">
                            <Text className="text-gray-700 mb-2 font-psemibold">Full Name</Text>
                            <TextInput
                                className="bg-white/80 rounded-xl px-4 py-6"
                                placeholder="Enter your full name"
                                value={profile.name}
                                onChangeText={(value) => setProfile({ ...profile, name: value })}
                            />
                        </View>

                        <TouchableOpacity
                            className="bg-[#0D9F6F] rounded-xl py-4 mt-6"
                            onPress={() => (profile.name ? setStep(2) : Alert.alert("Required", "Please enter your full name"))}
                        >
                            <Text className="text-white text-center font-psemibold text-lg">Next</Text>
                        </TouchableOpacity>
                    </View>
                )

            case 2:
                return (
                    <View>
                        <View className="mb-4">
                            <Text className="text-gray-700 mb-2 font-psemibold">Date of Birth</Text>
                            <TouchableOpacity
                                className="bg-white/80 rounded-xl px-4 py-3"
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text className={`text-base ${dateInput ? "text-black" : "text-gray-400"}`}>
                                    {dateInput || "MM/DD/YYYY"}
                                </Text>
                            </TouchableOpacity>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={profile.dob || new Date()}
                                    mode="date"
                                    display={Platform.OS === "ios" ? "spinner" : "default"}
                                    onChange={handleDateChange}
                                    maximumDate={new Date()}
                                />
                            )}
                        </View>
                        <View className="mb-4">
                            <Text className="text-gray-700 mb-2 font-psemibold">NIC Number</Text>
                            <TextInput
                                className="bg-white/80 rounded-xl px-4 py-3"
                                placeholder="Enter your NIC number"
                                value={profile.nicNumber}
                                onChangeText={(value) => {
                                    // Remove all non-digits
                                    let digits = value.replace(/\D/g, "")
                                    // Limit to 13 digits
                                    digits = digits.slice(0, 13)
                                    // Auto-insert dashes: 5 digits, dash, 7 digits, dash, 1 digit
                                    let formatted = digits
                                    if (digits.length > 5) {
                                        formatted = digits.slice(0, 5) + "-" + digits.slice(5)
                                    }
                                    if (digits.length > 12) {
                                        formatted = formatted.slice(0, 13) + "-" + formatted.slice(13)
                                    }
                                    setProfile({ ...profile, nicNumber: formatted })
                                }}
                                keyboardType="numeric"
                                maxLength={15}
                            />
                        </View>
                        <View className="flex-row justify-between space-x-4 mt-6">
                            <TouchableOpacity
                                className="flex-1 bg-[#0D9F6F] rounded-xl py-4"
                                onPress={() => {
                                    if (!dateInput || !profile.nicNumber) {
                                        Alert.alert("Required", "Please fill in all fields")
                                        return
                                    }
                                    if (!isValidPakistaniNIC(profile.nicNumber)) {
                                        Alert.alert("Invalid NIC", "Please enter a valid Pakistani NIC number (e.g. 12345-1234567-1)")
                                        return
                                    }
                                    setStep(3)
                                }}
                            >
                                <Text className="text-white text-center font-psemibold text-lg">Next</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )

            case 3:
                return (
                    <View className="flex-1">
                        {verificationError && (
                            <View className="bg-red-100 p-4 rounded-xl mb-4">
                                <Text className="text-red-600 font-psemibold">{verificationError}</Text>
                            </View>
                        )}

                        <View className="flex-row justify-between mb-4">
                            <View className="w-[48%]">
                                <Text className="text-gray-700 mb-2 font-psemibold">NIC Photo</Text>
                                <TouchableOpacity
                                    className="bg-white/80 rounded-xl p-2 items-center justify-center h-[120px]"
                                    onPress={() => pickImage("nic")}
                                >
                                    {nicImage ? (
                                        <Image
                                            source={{ uri: nicImage }}
                                            style={{ width: '100%', height: '100%', borderRadius: 10 }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <Text className="text-gray-500">Upload NIC Photo</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View className="w-[48%]">
                                <Text className="text-gray-700 mb-2 font-psemibold">Selfie Photo</Text>
                                <TouchableOpacity
                                    className="bg-white/80 rounded-xl p-2 items-center justify-center h-[120px]"
                                    onPress={() => pickImage("selfie")}
                                >
                                    {selfieImage ? (
                                        <Image
                                            source={{ uri: selfieImage }}
                                            style={{ width: '100%', height: '100%', borderRadius: 10 }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <Text className="text-gray-500">Upload Selfie Photo</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                  <TouchableOpacity
    className={`rounded-xl py-8 mt-36 ${loading || !nicImage || !selfieImage ? "bg-gray-300" : "bg-[#0D9F6F]"}`}
    onPress={handleCreateProfile}
    disabled={loading || !nicImage || !selfieImage}
>
    <Text className={`text-center font-psemibold text-lg ${loading || !nicImage || !selfieImage ? "text-gray-700" : "text-white"}`}>
        {loading ? "Verifying..." : "Verify & Create"}
    </Text>
</TouchableOpacity>
                    </View>
                )

            case 4:
                return (
                    <View>
                        <TouchableOpacity
                            className="bg-[#0D9F6F] rounded-xl py-4 mt-6"
                            onPress={() => router.replace("/(tabs)/Home")}
                        >
                            <Text className="text-white text-center font-psemibold text-lg">Proceed to Home</Text>
                        </TouchableOpacity>
                    </View>
                )
        }
    }

    return (
        <View style={{ flex: 1 }}>
            <StatusBar style="dark" />
            <ImageBackground
                source={require("@/assets/images/lol.png")}
                style={{ position: "absolute", width: "100%", height: "100%" }}
                resizeMode="cover"
            />
            <BlurView intensity={60} style={{ flex: 1 }}>
                {step > 1 && (
                    <TouchableOpacity className="absolute top-12 left-4 z-10" onPress={() => setStep(step - 1)}>
                        <Image source={require("@/assets/images/arrow-left.png")} style={{ width: 24, height: 24 }} />
                    </TouchableOpacity>
                )}
                <View className="flex-1">
                    {/* Top Section */}
                    <View className=" items-center pt-28 mt-20 mb-8">
                        <Image
                            source={require("@/assets/images/logoblack.png")}
                            style={{ width: 80, height: 80 }}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Content Section */}
                    <View className="flex-1 px-6 pt-4">
                        {/* Title Section - Moved further down */}
                        <View className="mb-8 mt-auto">
                            {renderProgressDots()}
                            <View className="mt-4">
                                {step === 1 && (
                                    <>
                                        <Text className="text-2xl font-pbold text-gray-800">Create your Profile</Text>
                                        <Text className="text-base text-gray-600 font-pregular">
                                            We will need some personal details from you.
                                        </Text>
                                    </>
                                )}
                                {step === 2 && (
                                    <>
                                        <Text className="text-2xl font-pbold text-gray-800">Personal Details</Text>
                                        <Text className="text-base text-gray-600 font-pregular">Your date of birth and NIC number</Text>
                                    </>
                                )}
                                {step === 3 && (
                                    <>
                                        <Text className="text-2xl font-pbold text-gray-800">Verify Identity</Text>
                                        <Text className="text-base text-gray-600 font-pregular">
                                            Upload your NIC and a selfie for verification
                                        </Text>
                                    </>
                                )}
                                {step === 4 && (
                                    <>
                                        <Text className="text-2xl font-pbold text-gray-800">Profile Created!</Text>
                                        <Text className="text-base text-gray-600 font-pregular mt-2 text-center">
                                            Your profile has been created and verified successfully.
                                        </Text>
                                    </>
                                )}
                            </View>
                        </View>

                        {/* Form Section - Moved upwards */}
                        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="mb-auto">
                            {renderStep()}
                        </KeyboardAvoidingView>
                    </View>
                </View>
            </BlurView>
        </View>
    )
}

