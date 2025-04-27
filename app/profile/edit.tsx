"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { BlurView } from "expo-blur"
import { Pencil, ArrowLeft, X, Check, Briefcase, GraduationCap, User, Banknote } from "lucide-react-native"
import { supabase } from "@/supabaseClient"
import { useRouter } from "expo-router"
import SkillSelector from "@/components/SkillSelector"
import { EducationExperienceSection } from "@/components/Experience"
import { useAuth } from "@/contexts/AuthContext"

interface ProfileData {
  full_name: string | null
  phone_number: string | null
  bio: string | null
  profession: string | null
  hourly_fee: number | null
  minimum_visit_fee: number | null
  skills: string[] | null
}

export default function EditProfile() {
  const { user, profile: authProfile } = useAuth()
  const [profile, setProfile] = useState<ProfileData>({
    full_name: null,
    phone_number: null,
    bio: null,
    profession: null,
    hourly_fee: null,
    minimum_visit_fee: null,
    skills: [],
  })
  const [initialProfile, setInitialProfile] = useState<ProfileData | null>(null)
  const router = useRouter()
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingFee, setEditingFee] = useState<{ hourly_fee: number | null; minimum_visit_fee: number | null }>({
    hourly_fee: null,
    minimum_visit_fee: null,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [educations, setEducations] = useState([])
  const [experiences, setExperiences] = useState([])
  const [isEducationExperienceChanged, setIsEducationExperienceChanged] = useState(false)
  const [modalAnimation] = useState(new Animated.Value(0))

  // Animation for modal
  useEffect(() => {
    if (isModalVisible) {
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
  }, [isModalVisible])

  const formatPhoneNumber = (phoneNumber: string | null) => {
    if (!phoneNumber) return "+92 000 0000000"
    return `+92 ${phoneNumber.slice(2)}`
  }

  const scrollY = useRef(new Animated.Value(0)).current
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [260, 75],
    extrapolate: "clamp",
  })
  const headerPaddingTop = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [12, 8],
    extrapolate: "clamp",
  })
  const headerPaddingBottom = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [60, 8],
    extrapolate: "clamp",
  })
  const profileOpacity = scrollY.interpolate({
    inputRange: [0, 60, 100],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  })
  const profileTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 10],
    extrapolate: "clamp",
  })
  const borderRadius = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [40, 0],
    extrapolate: "clamp",
  })
  const infoOpacity = scrollY.interpolate({
    inputRange: [0, 80, 120],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  })

  const fetchAllUserData = async () => {
    if (!user) return

    setIsLoading(true)

    try {
      // Fetch all data in parallel
      const [
        { data: extendedProfileData, error: profileError },
        { data: educationData, error: eduError },
        { data: experienceData, error: expError },
      ] = await Promise.all([
        supabase.from("extended_profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("user_education").select("*").eq("user_id", user.id).order("start_date", { ascending: false }),
        supabase.from("user_experience").select("*").eq("user_id", user.id).order("start_date", { ascending: false }),
      ])

      if (profileError) console.error("Error fetching profile:", profileError)
      if (eduError) console.error("Error fetching education:", eduError)
      if (expError) console.error("Error fetching experience:", expError)

      // Set all state in one go
      const initialSkills = extendedProfileData?.skills || []
      const initialProfileData = {
        full_name: authProfile?.full_name || null,
        phone_number: authProfile?.phone_number || null,
        bio: extendedProfileData?.bio || null,
        profession: extendedProfileData?.profession || null,
        hourly_fee: extendedProfileData?.hourly_fee || null,
        minimum_visit_fee: extendedProfileData?.minimum_visit_fee || null,
        skills: initialSkills,
      }

      setProfile(initialProfileData)
      setInitialProfile(initialProfileData)
      setSelectedSkills(initialSkills)
      setEducations(educationData || [])
      setExperiences(experienceData || [])
    } catch (error) {
      console.error("Error fetching user data:", error)
      Alert.alert("Error", "Failed to load profile data. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAllUserData()
  }, [user, authProfile])

  const updateProfile = async () => {
    if (!user) return

    setIsSaving(true)

    try {
      const { data: existingProfile } = await supabase
        .from("extended_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single()

      let result

      if (existingProfile) {
        result = await supabase
          .from("extended_profiles")
          .update({
            bio: profile.bio,
            profession: profile.profession,
            hourly_fee: profile.hourly_fee,
            minimum_visit_fee: profile.minimum_visit_fee,
            skills: selectedSkills,
            updated_at: new Date(),
          })
          .eq("user_id", user.id)
      } else {
        result = await supabase.from("extended_profiles").insert({
          user_id: user.id,
          bio: profile.bio,
          profession: profile.profession,
          hourly_fee: profile.hourly_fee,
          minimum_visit_fee: profile.minimum_visit_fee,
          skills: selectedSkills,
          created_at: new Date(),
          updated_at: new Date(),
        })
      }

      if (result.error) {
        console.error("Update error:", result.error)
        Alert.alert("Error", result.error.message || "Failed to update profile")
        setIsSaving(false)
        return
      }

      const { data: verifyUpdate } = await supabase
        .from("extended_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single()

      console.log("Updated profile:", verifyUpdate)

      // Reset the flag after saving
      setIsEducationExperienceChanged(false)

      Alert.alert("Success", "Profile updated successfully")
      router.back()
    } catch (error: any) {
      console.error("Error:", error)
      Alert.alert("Error", error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const openModal = () => {
    setEditingFee({ hourly_fee: profile.hourly_fee, minimum_visit_fee: profile.minimum_visit_fee })
    setIsModalVisible(true)
  }

  const saveFees = () => {
    setProfile((prev) => ({
      ...prev,
      hourly_fee: editingFee.hourly_fee,
      minimum_visit_fee: editingFee.minimum_visit_fee,
    }))
    setIsModalVisible(false)
  }

  const isProfileChanged = () => {
    const isBasicInfoChanged = JSON.stringify(profile) !== JSON.stringify(initialProfile)
    const isSkillsChanged = JSON.stringify(selectedSkills) !== JSON.stringify(initialProfile?.skills || [])
    const isEducationExperienceChangedFlag = isEducationExperienceChanged

    return isBasicInfoChanged || isSkillsChanged || isEducationExperienceChangedFlag
  }

  // Loading screen
  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50">
        {/* Loading header */}
        <View className="bg-[#0D9F70] h-40 rounded-b-[40px] shadow-md">
          <View className="px-4 flex-row mt-12 items-center">
            <TouchableOpacity onPress={() => router.back()} className="p-2">
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-psemibold ml-2">Edit Profile</Text>
          </View>
        </View>

        {/* Loading content */}
        <View className="flex-1 justify-center items-center px-4 -mt-10">
          <View className="bg-white w-full rounded-3xl p-6 shadow-md items-center">
            <ActivityIndicator size="large" color="#0D9F70" />
            <Text className="text-gray-700 font-pmedium mt-4 text-center">Loading your profile...</Text>
            <Text className="text-gray-500 text-sm mt-2 text-center">Please wait while we fetch your information</Text>
          </View>

          {/* Skeleton loading UI */}
          <View className="w-full mt-8">
            <View className="h-6 bg-gray-200 rounded-md w-1/3 mb-4" />
            <View className="h-12 bg-gray-200 rounded-md w-full mb-6" />

            <View className="h-6 bg-gray-200 rounded-md w-1/3 mb-4" />
            <View className="h-24 bg-gray-200 rounded-md w-full mb-6" />

            <View className="h-6 bg-gray-200 rounded-md w-1/3 mb-4" />
            <View className="h-12 bg-gray-200 rounded-md w-full mb-6" />
          </View>
        </View>
      </View>
    )
  }

  const translateY = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  })

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-gray-50"
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <Animated.View
        className="bg-[#0D9F70] absolute left-0 right-0 top-0 z-10 shadow-md"
        style={{
          height: headerHeight,
          paddingTop: headerPaddingTop,
          paddingBottom: headerPaddingBottom,
          borderBottomLeftRadius: borderRadius,
          borderBottomRightRadius: borderRadius,
        }}
      >
        <View className="px-4 flex-row mt-6 items-center">
          <TouchableOpacity onPress={() => router.back()} className="p-2 rounded-full">
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-psemibold ml-2">Edit Profile</Text>
        </View>

        <Animated.View
          className="items-center mt-3"
          style={{
            opacity: profileOpacity,
            transform: [{ translateY: profileTranslateY }],
          }}
        >
          <View className="w-24 h-24 bg-white rounded-full overflow-hidden shadow-md">
            <View className="w-full h-full bg-gray-100 items-center justify-center">
              <Text className="text-2xl text-gray-400 font-pregular">{profile.full_name?.[0] || "U"}</Text>
            </View>
            <TouchableOpacity
              className="absolute bottom-0 right-0 bg-white p-2 rounded-full border border-gray-200 shadow-sm"
              onPress={() => Alert.alert("Coming soon", "Photo upload will be available in future updates")}
            >
              <Pencil size={16} color="#0D9F70" />
            </TouchableOpacity>
          </View>

          <Text className="text-white font-psemibold text-lg mt-2">{profile.full_name || "User Name"}</Text>
          <Text className="text-white/80 font-pregular">{formatPhoneNumber(profile.phone_number)}</Text>
        </Animated.View>

        <Animated.View className="flex-row justify-around mt-2 px-4" style={{ opacity: infoOpacity }}>
          <TouchableOpacity onPress={openModal} className="bg-white/10 px-4 py-2 rounded-xl">
            <View className="items-center">
              <Text className="text-white text-xs font-pregular">Hourly Fee</Text>
              <Text className="text-white font-psemibold">{profile.hourly_fee || 0} PKR</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={openModal} className="bg-white/10 px-4 py-2 rounded-xl">
            <View className="items-center">
              <Text className="text-white text-xs font-pregular">Minimum Visit Fee</Text>
              <Text className="text-white font-psemibold">{profile.minimum_visit_fee || 0} PKR</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingTop: 280, paddingBottom: 40 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 py-6">
          {/* Profile Section Card */}
          <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden border border-gray-100">
            <View className="p-5">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                  <User size={16} color="#0D9F70" />
                </View>
                <Text className="text-gray-800 font-pbold text-lg">Personal Info</Text>
              </View>

              <View className="mb-4">
                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Profession</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-800"
                  value={profile.profession || ""}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, profession: text }))}
                  placeholder="e.g. Web Developer, Designer, etc."
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View className="mb-4">
                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Bio</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-800 h-24"
                  value={profile.bio || ""}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, bio: text }))}
                  placeholder="Tell us about yourself..."
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
          </View>

          {/* Skills Section Card */}
          <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden border border-gray-100">
            <View className="p-5">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                  <Briefcase size={16} color="#0D9F70" />
                </View>
                <Text className="text-gray-800 font-pbold text-lg">Skills</Text>
              </View>

              <SkillSelector onSkillsChange={setSelectedSkills} initialSkills={profile.skills || []} />
            </View>
          </View>

          {/* Education & Experience Section Card */}
          <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden border border-gray-100">
            <View className="p-5">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                  <GraduationCap size={16} color="#0D9F70" />
                </View>
                <Text className="text-gray-800 font-pbold text-lg">Education & Experience</Text>
              </View>

              <EducationExperienceSection
                userId={user?.id!}
                educations={educations}
                experiences={experiences}
                fetchEducationAndExperience={() => fetchAllUserData()}
                setIsEducationExperienceChanged={setIsEducationExperienceChanged}
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            className={`py-4 rounded-xl items-center mb-8 shadow-sm ${
              isProfileChanged() ? "bg-[#0D9F70]" : "bg-gray-300"
            }`}
            onPress={updateProfile}
            disabled={!isProfileChanged() || isSaving}
          >
            {isSaving ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                <Text className="text-white font-psemibold text-lg">Saving...</Text>
              </View>
            ) : (
              <Text className="text-white font-psemibold text-lg">Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>

      {/* Fee Setting Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View className="flex-1 justify-end">
          <BlurView intensity={20} className="absolute top-0 left-0 right-0 bottom-0" tint="dark" />

          <Animated.View
            style={{
              transform: [{ translateY }],
              backgroundColor: "white",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
              maxHeight: "90%",
            }}
          >
            <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />

            <View className="px-6 pb-8">
              <View className="flex-row justify-between items-center mb-6">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                    <Banknote size={16} color="#0D9F70" />
                  </View>
                  <Text className="text-xl font-pbold text-gray-800">Set Your Fees</Text>
                </View>
                <TouchableOpacity onPress={() => setIsModalVisible(false)} className="p-2 rounded-full bg-gray-100">
                  <X size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View className="mb-5">
                <Text className="text-sm font-pmedium text-gray-600 mb-2">Hourly Fee</Text>
                <View className="relative">
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 text-gray-900 pr-12"
                    value={editingFee.hourly_fee?.toString() || ""}
                    onChangeText={(text) =>
                      setEditingFee((prev) => ({
                        ...prev,
                        hourly_fee: text ? Number(text) : null,
                      }))
                    }
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text className="absolute right-4 top-3.5 text-gray-500 text-base font-pregular">PKR</Text>
                </View>
              </View>

              <View className="mb-8">
                <Text className="text-sm font-pmedium text-gray-600 mb-2">Minimum Visit Fee</Text>
                <View className="relative">
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 text-gray-900 pr-12"
                    value={editingFee.minimum_visit_fee?.toString() || ""}
                    onChangeText={(text) =>
                      setEditingFee((prev) => ({
                        ...prev,
                        minimum_visit_fee: text ? Number(text) : null,
                      }))
                    }
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text className="absolute right-4 top-3.5 text-gray-500 text-base font-pregular">PKR</Text>
                </View>
              </View>

              <TouchableOpacity
                className="bg-[#0D9F70] py-4 rounded-xl shadow-sm flex-row items-center justify-center"
                onPress={saveFees}
                activeOpacity={0.8}
              >
                <Check size={20} color="white" className="mr-2" />
                <Text className="text-white text-lg font-psemibold">Save Changes</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}
