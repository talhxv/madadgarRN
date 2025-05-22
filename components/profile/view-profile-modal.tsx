"use client"

import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, ScrollView, Animated } from "react-native"
import { BlurView } from "expo-blur"
import { supabase } from "@/lib/supabase"
import { X, User, Briefcase, GraduationCap, Calendar, Phone, Banknote } from "lucide-react-native"
import { format } from "date-fns"
import { Linking } from "react-native"

interface ViewProfileModalProps {
  isVisible: boolean
  onClose: () => void
  userId: string
}

export default function ViewProfileModal({ isVisible, onClose, userId }: ViewProfileModalProps) {
  const [profile, setProfile] = useState<any>(null)
  const [extendedProfile, setExtendedProfile] = useState<any>(null)
  const [educations, setEducations] = useState([])
  const [experiences, setExperiences] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalAnimation] = useState(new Animated.Value(0))

  useEffect(() => {
    if (isVisible && userId) {
      fetchUserProfile()
    }
  }, [isVisible, userId])

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

  const formatPhoneNumber = (phoneNumber: string | null) => {
    if (!phoneNumber) return null
    return `+92 ${phoneNumber.slice(2)}`
  }

  const handleContactPress = (phoneNumber: string | null) => {
    if (!phoneNumber) return
    Linking.openURL(`tel:${phoneNumber}`)
  }

  const translateY = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [800, 0],
  })

  if (!isVisible) return null

  return (
    <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={onClose}>
      <View className="flex-1">
        <BlurView intensity={20} className="absolute top-0 left-0 right-0 bottom-0" tint="dark" />

        <TouchableOpacity className="absolute top-0 left-0 right-0 bottom-0" activeOpacity={1} onPress={onClose} />

        <Animated.View
          className="flex-1 bg-white rounded-t-3xl overflow-hidden mt-12"
          style={{ transform: [{ translateY }] }}
        >
          <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />

          <View className="flex-row justify-between items-center px-5 pb-2">
            <Text className="text-xl font-pbold text-gray-800">Profile</Text>
            <TouchableOpacity
              onPress={onClose}
              className="p-2 rounded-full bg-gray-100"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View className="flex-1 justify-center items-center p-5">
              <ActivityIndicator size="large" color="#0D9F70" />
              <Text className="text-gray-600 mt-4">Loading profile...</Text>
            </View>
          ) : (
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {/* Profile Header */}
              <View className="bg-[#0D9F70] px-5 pt-5 pb-8 rounded-b-3xl">
                <View className="items-center">
                  <View className="w-24 h-24 bg-white rounded-full overflow-hidden shadow-md">
                    <View className="w-full h-full bg-gray-100 items-center justify-center">
                      <Text className="text-2xl text-gray-400 font-pregular">{profile?.full_name?.[0] || "U"}</Text>
                    </View>
                  </View>

                  <Text className="text-white font-psemibold text-lg mt-2">{profile?.full_name || "User"}</Text>
                  <Text className="text-white/80 font-pregular">{extendedProfile?.profession || "Professional"}</Text>

                  <View className="flex-row justify-around w-full mt-4">
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
                  </View>
                </View>
              </View>

              <View className="px-5 py-6">
                {/* Contact Buttons */}
                {profile?.phone_number && (
                  <TouchableOpacity
                    className="bg-white border border-[#0D9F70] py-3 rounded-xl flex-row justify-center items-center shadow-sm mb-6"
                    onPress={() => handleContactPress(profile.phone_number)}
                  >
                    <Phone size={20} color="#0D9F70" className="mr-2" />
                    <Text className="text-[#0D9F70] font-pmedium">Call {formatPhoneNumber(profile.phone_number)}</Text>
                  </TouchableOpacity>
                )}

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
                          <View
                            key={index}
                            className="bg-gray-100 rounded-full px-3 py-1.5 mr-2 mb-2 border border-gray-200"
                          >
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
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}
