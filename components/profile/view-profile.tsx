"use client"

import { useState, useEffect, useRef } from "react"
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Linking } from "react-native"
import { useRouter } from "expo-router"
import { supabase } from "@/supabaseClient"
import {
  ArrowLeft,
  Briefcase,
  GraduationCap,
  User,
  Calendar,
  MessageCircle,
  Phone,
  Banknote,
} from "lucide-react-native"
import { format } from "date-fns"

interface ViewProfileProps {
  userId: string
  onClose?: () => void
}

export default function ViewProfile({ userId, onClose }: ViewProfileProps) {
  const [profile, setProfile] = useState<any>(null)
  const [extendedProfile, setExtendedProfile] = useState<any>(null)
  const [educations, setEducations] = useState([])
  const [experiences, setExperiences] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

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

  useEffect(() => {
    fetchUserProfile()
  }, [userId])

  const fetchUserProfile = async () => {
    if (!userId) return

    setIsLoading(true)

    try {
      // Fetch all data in parallel
      const [
        { data: profileData, error: profileError },
        { data: extendedProfileData, error: extendedProfileError },
        { data: educationData, error: eduError },
        { data: experienceData, error: expError },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).single(),
        supabase.from("extended_profiles").select("*").eq("user_id", userId).single(),
        supabase.from("user_education").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
        supabase.from("user_experience").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
      ])

      if (profileError) console.error("Error fetching profile:", profileError)
      if (extendedProfileError) console.error("Error fetching extended profile:", extendedProfileError)
      if (eduError) console.error("Error fetching education:", eduError)
      if (expError) console.error("Error fetching experience:", expError)

      setProfile(profileData || {})
      setExtendedProfile(extendedProfileData || {})
      setEducations(educationData || [])
      setExperiences(experienceData || [])
    } catch (error) {
      console.error("Error fetching user data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    if (onClose) {
      onClose()
    } else {
      router.back()
    }
  }

  const formatPhoneNumber = (phoneNumber: string | null) => {
    if (!phoneNumber) return null
    return `+92 ${phoneNumber.slice(2)}`
  }

  const handleContactPress = (phoneNumber: string | null) => {
    if (!phoneNumber) return
    Linking.openURL(`tel:${phoneNumber}`)
  }

  const handleMessagePress = () => {
    // Navigate to chat or open chat with this user
    // This would depend on your app's navigation structure
    router.push(`/chat?userId=${userId}`)
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50">
        {/* Loading header */}
        <View className="bg-[#0D9F70] h-40 rounded-b-[40px] shadow-md">
          <View className="px-4 flex-row mt-12 items-center">
            <TouchableOpacity onPress={handleBack} className="p-2">
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-psemibold ml-2">Profile</Text>
          </View>
        </View>

        {/* Loading content */}
        <View className="flex-1 justify-center items-center px-4 -mt-10">
          <View className="bg-white w-full rounded-3xl p-6 shadow-md items-center">
            <ActivityIndicator size="large" color="#0D9F70" />
            <Text className="text-gray-700 font-pmedium mt-4 text-center">Loading profile...</Text>
            <Text className="text-gray-500 text-sm mt-2 text-center">Please wait</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-gray-50">
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
          <TouchableOpacity onPress={handleBack} className="p-2 rounded-full">
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-psemibold ml-2">Profile</Text>
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
              <Text className="text-2xl text-gray-400 font-pregular">{profile?.full_name?.[0] || "U"}</Text>
            </View>
          </View>

          <Text className="text-white font-psemibold text-lg mt-2">{profile?.full_name || "User"}</Text>
          <Text className="text-white/80 font-pregular">{extendedProfile?.profession || "Professional"}</Text>
        </Animated.View>

        <Animated.View className="flex-row justify-around mt-2 px-4" style={{ opacity: infoOpacity }}>
          <View className="bg-white/10 px-4 py-2 rounded-xl">
            <View className="items-center">
              <Text className="text-white text-xs font-pregular">Hourly Fee</Text>
              <Text className="text-white font-psemibold">{extendedProfile?.hourly_fee || 0} PKR</Text>
            </View>
          </View>
          <View className="bg-white/10 px-4 py-2 rounded-xl">
            <View className="items-center">
              <Text className="text-white text-xs font-pregular">Minimum Visit Fee</Text>
              <Text className="text-white font-psemibold">{extendedProfile?.minimum_visit_fee || 0} PKR</Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingTop: 280, paddingBottom: 100 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 py-6">
          {/* Contact Buttons */}
          <View className="flex-row space-x-4 mb-6">
            <TouchableOpacity
              className="flex-1 bg-[#0D9F70] py-3 rounded-xl flex-row justify-center items-center shadow-sm"
              onPress={handleMessagePress}
            >
              <MessageCircle size={20} color="white" className="mr-2" />
              <Text className="text-white font-pmedium">Message</Text>
            </TouchableOpacity>

            {profile?.phone_number && (
              <TouchableOpacity
                className="flex-1 bg-white border border-[#0D9F70] py-3 rounded-xl flex-row justify-center items-center shadow-sm"
                onPress={() => handleContactPress(profile.phone_number)}
              >
                <Phone size={20} color="#0D9F70" className="mr-2" />
                <Text className="text-[#0D9F70] font-pmedium">Call</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bio Section */}
          <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden border border-gray-100">
            <View className="p-5">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                  <User size={16} color="#0D9F70" />
                </View>
                <Text className="text-gray-800 font-pbold text-lg">About</Text>
              </View>

              <Text className="text-gray-700 leading-relaxed">
                {extendedProfile?.bio || "This user hasn't added a bio yet."}
              </Text>
            </View>
          </View>

          {/* Skills Section */}
          {extendedProfile?.skills && extendedProfile.skills.length > 0 && (
            <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden border border-gray-100">
              <View className="p-5">
                <View className="flex-row items-center mb-4">
                  <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                    <Briefcase size={16} color="#0D9F70" />
                  </View>
                  <Text className="text-gray-800 font-pbold text-lg">Skills</Text>
                </View>

                <View className="flex-row flex-wrap">
                  {extendedProfile.skills.map((skill: string, index: number) => (
                    <View key={index} className="bg-gray-100 rounded-full px-3 py-1.5 mr-2 mb-2 border border-gray-200">
                      <Text className="text-gray-700 font-pmedium text-sm">{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Experience Section */}
          {experiences.length > 0 && (
            <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden border border-gray-100">
              <View className="p-5">
                <View className="flex-row items-center mb-4">
                  <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                    <Briefcase size={16} color="#0D9F70" />
                  </View>
                  <Text className="text-gray-800 font-pbold text-lg">Experience</Text>
                </View>

                {experiences.map((exp: any, index: number) => (
                  <View key={index} className={`${index > 0 ? "mt-5 pt-5 border-t border-gray-100" : ""}`}>
                    <Text className="text-gray-800 font-pmedium text-base">{exp.title}</Text>
                    <Text className="text-gray-600 text-sm">{exp.company}</Text>
                    <View className="flex-row items-center mt-1">
                      <Calendar size={14} color="#6B7280" className="mr-1" />
                      <Text className="text-gray-500 text-xs">
                        {format(new Date(exp.start_date), "MMM yyyy")} -{" "}
                        {exp.end_date ? format(new Date(exp.end_date), "MMM yyyy") : "Present"}
                      </Text>
                    </View>
                    {exp.description && <Text className="text-gray-700 mt-2">{exp.description}</Text>}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Education Section */}
          {educations.length > 0 && (
            <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden border border-gray-100">
              <View className="p-5">
                <View className="flex-row items-center mb-4">
                  <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                    <GraduationCap size={16} color="#0D9F70" />
                  </View>
                  <Text className="text-gray-800 font-pbold text-lg">Education</Text>
                </View>

                {educations.map((edu: any, index: number) => (
                  <View key={index} className={`${index > 0 ? "mt-5 pt-5 border-t border-gray-100" : ""}`}>
                    <Text className="text-gray-800 font-pmedium text-base">{edu.degree}</Text>
                    <Text className="text-gray-600 text-sm">{edu.institution}</Text>
                    <View className="flex-row items-center mt-1">
                      <Calendar size={14} color="#6B7280" className="mr-1" />
                      <Text className="text-gray-500 text-xs">
                        {format(new Date(edu.start_date), "MMM yyyy")} -{" "}
                        {edu.end_date ? format(new Date(edu.end_date), "MMM yyyy") : "Present"}
                      </Text>
                    </View>
                    {edu.description && <Text className="text-gray-700 mt-2">{edu.description}</Text>}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Rates Section */}
          <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden border border-gray-100">
            <View className="p-5">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                  <Banknote size={16} color="#0D9F70" />
                </View>
                <Text className="text-gray-800 font-pbold text-lg">Rates</Text>
              </View>

              <View className="flex-row justify-between items-center py-2">
                <Text className="text-gray-700 font-pmedium">Hourly Rate</Text>
                <Text className="text-gray-800 font-pbold">{extendedProfile?.hourly_fee || 0} PKR</Text>
              </View>

              <View className="flex-row justify-between items-center py-2 border-t border-gray-100">
                <Text className="text-gray-700 font-pmedium">Minimum Visit Fee</Text>
                <Text className="text-gray-800 font-pbold">{extendedProfile?.minimum_visit_fee || 0} PKR</Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  )
}
