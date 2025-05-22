"use client"

import { useEffect, useState } from "react"
import { View, Text, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Animated } from "react-native"
import { X, User, GraduationCap, Briefcase, Star, Flag, Calendar, MapPin, ExternalLink } from "lucide-react-native"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"

interface UserProfileModalProps {
  isVisible: boolean
  onClose: () => void
  userId: string | null
  chatId: string | null
  onReport?: () => void
}

export const UserProfileModal = ({ isVisible, onClose, userId, chatId, onReport }: UserProfileModalProps) => {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [extendedProfile, setExtendedProfile] = useState<any>(null)
  const [education, setEducation] = useState<any[]>([])
  const [experience, setExperience] = useState<any[]>([])
  const [ratings, setRatings] = useState<any[]>([])
  const [averageRating, setAverageRating] = useState<number | null>(null)
  const [animation] = useState(new Animated.Value(0))

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
    if (isVisible && userId) {
      fetchUserData()
    }
  }, [isVisible, userId])

  const fetchUserData = async () => {
    if (!userId) return

    setLoading(true)
    try {
      const [profileResponse, extendedProfileResponse, educationResponse, experienceResponse, ratingsResponse] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("user_id", userId).single(),
          supabase.from("extended_profiles").select("*").eq("user_id", userId).single(),
          supabase.from("user_education").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
          supabase.from("user_experience").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
          supabase.from("job_reviews").select("*").eq("reviewee_id", userId).order("created_at", { ascending: false }),
        ])

      if (profileResponse.data) setProfile(profileResponse.data)
      if (extendedProfileResponse.data) setExtendedProfile(extendedProfileResponse.data)
      if (educationResponse.data) setEducation(educationResponse.data)
      if (experienceResponse.data) setExperience(experienceResponse.data)

      if (ratingsResponse.data && ratingsResponse.data.length > 0) {
        setRatings(ratingsResponse.data)

        const totalRating = ratingsResponse.data.reduce((sum, review) => sum + review.rating, 0)
        setAverageRating(totalRating / ratingsResponse.data.length)
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleReport = () => {
    onClose()
    if (onReport) onReport()
  }

  if (!isVisible) return null

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <Animated.View
          style={{
            transform: [{ translateY }],
            maxHeight: "90%",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: "white",
            overflow: "hidden",
            width: "100%",
            alignSelf: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />
          <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
            <Text className="text-xl font-pbold text-gray-800">Profile</Text>
            <View className="flex-row">
              <TouchableOpacity
                onPress={handleReport}
                className="mr-2 p-2 rounded-full bg-red-50"
                accessibilityLabel="Report user"
              >
                <Flag size={20} color="#EF4444" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                className="p-2 rounded-full bg-gray-100"
                accessibilityLabel="Close modal"
              >
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View className="p-8 items-center">
              <ActivityIndicator size="large" color="#0D9F70" />
              <Text className="mt-4 text-gray-500">Loading profile...</Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: "80%", paddingHorizontal: 16 }}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="p-6 items-center border-b border-gray-100">
                <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-3">
                  <Text className="text-2xl text-gray-400 font-pregular">{profile?.full_name?.[0] || "U"}</Text>
                </View>
                <Text className="text-xl font-pbold text-gray-800">{profile?.full_name || "User"}</Text>
                <Text className="text-gray-500 mb-2">{extendedProfile?.profession || "Professional"}</Text>

                {averageRating !== null && (
                  <View className="flex-row items-center bg-yellow-50 px-3 py-1 rounded-full">
                    <Star size={16} color="#F59E0B" />
                    <Text className="ml-1 text-yellow-700 font-pmedium">
                      {averageRating.toFixed(1)} ({ratings.length} reviews)
                    </Text>
                  </View>
                )}
              </View>

              {extendedProfile?.bio && (
                <View className="p-6 border-b border-gray-100">
                  <View className="flex-row items-center mb-3">
                    <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                      <User size={16} color="#0D9F70" />
                    </View>
                    <Text className="text-lg font-pbold text-gray-800">About</Text>
                  </View>
                  <Text className="text-gray-700">{extendedProfile.bio}</Text>
                </View>
              )}

              {extendedProfile?.skills && extendedProfile.skills.length > 0 && (
                <View className="p-6 border-b border-gray-100">
                  <View className="flex-row items-center mb-3">
                    <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                      <Briefcase size={16} color="#0D9F70" />
                    </View>
                    <Text className="text-lg font-pbold text-gray-800">Skills</Text>
                  </View>
                  <View className="flex-row flex-wrap">
                    {extendedProfile.skills.map((skill, index) => (
                      <View key={index} className="bg-gray-100 rounded-full px-3 py-1 mr-2 mb-2">
                        <Text className="text-gray-700">{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View className="p-6 border-b border-gray-100">
                <View className="flex-row items-center mb-3">
                  <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                    <GraduationCap size={16} color="#0D9F70" />
                  </View>
                  <Text className="text-lg font-pbold text-gray-800">Education</Text>
                </View>
                {education && education.length > 0 ? (
                  education.map((edu, index) => (
                    <View key={index} className="mb-4">
                      <Text className="font-pmedium text-gray-800">{edu.institution_name || "Institution N/A"}</Text>
                      <Text className="text-gray-700">
                        {(edu.degree || "Degree N/A") + " in " + (edu.field_of_study || "Field N/A")}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <Calendar size={14} color="#6B7280" />
                        <Text className="text-gray-500 text-sm ml-1">
                          {edu.start_date ? format(new Date(edu.start_date), "MMM yyyy") : "Start N/A"} -
                          {edu.is_current
                            ? " Present"
                            : edu.end_date
                            ? ` ${format(new Date(edu.end_date), "MMM yyyy")}`
                            : " End N/A"}
                        </Text>
                      </View>
                      {edu.description && <Text className="text-gray-600 mt-1">{edu.description}</Text>}
                    </View>
                  ))
                ) : (
                  <Text className="text-gray-500 italic">No education data available.</Text>
                )}
              </View>

              <View className="p-6 border-b border-gray-100">
                <View className="flex-row items-center mb-3">
                  <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                    <Briefcase size={16} color="#0D9F70" />
                  </View>
                  <Text className="text-lg font-pbold text-gray-800">Experience</Text>
                </View>
                {experience && experience.length > 0 ? (
                  experience.map((exp, index) => (
                    <View key={index} className="mb-4">
                      <Text className="font-pmedium text-gray-800">{exp.position || "Position N/A"}</Text>
                      <Text className="text-gray-700">{exp.company_name || "Company N/A"}</Text>
                      <View className="flex-row items-center mt-1">
                        <Calendar size={14} color="#6B7280" />
                        <Text className="text-gray-500 text-sm ml-1">
                          {exp.start_date ? format(new Date(exp.start_date), "MMM yyyy") : "Start N/A"} -
                          {exp.is_current
                            ? " Present"
                            : exp.end_date
                            ? ` ${format(new Date(exp.end_date), "MMM yyyy")}`
                            : " End N/A"}
                        </Text>
                      </View>
                      {exp.location && (
                        <View className="flex-row items-center mt-1">
                          <MapPin size={14} color="#6B7280" />
                          <Text className="text-gray-500 text-sm ml-1">
                            {exp.location} {exp.is_remote && "(Remote)"}
                          </Text>
                        </View>
                      )}
                      {exp.description && <Text className="text-gray-600 mt-1">{exp.description}</Text>}
                    </View>
                  ))
                ) : (
                  <Text className="text-gray-500 italic">No experience data available.</Text>
                )}
              </View>

              {ratings.length > 0 && (
                <View className="p-6">
                  <View className="flex-row items-center mb-3">
                    <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                      <Star size={16} color="#0D9F70" />
                    </View>
                    <Text className="text-lg font-pbold text-gray-800">Reviews</Text>
                  </View>
                  {ratings.slice(0, 3).map((review, index) => (
                    <View key={index} className="mb-4 p-3 bg-gray-50 rounded-xl">
                      <View className="flex-row items-center mb-2">
                        <View className="flex-row">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={16}
                              color={i < review.rating ? "#F59E0B" : "#D1D5DB"}
                              fill={i < review.rating ? "#F59E0B" : "none"}
                            />
                          ))}
                        </View>
                        <Text className="ml-2 text-gray-500 text-sm">
                          {format(new Date(review.created_at), "MMM d, yyyy")}
                        </Text>
                      </View>
                      <Text className="text-gray-700">{review.review_text}</Text>
                      {review.blockchain_verified && (
                        <TouchableOpacity
                          className="flex-row items-center mt-2"
                          onPress={() => Linking.openURL(`https://etherscan.io/tx/${review.blockchain_tx_hash}`)}
                        >
                          <ExternalLink size={14} color="#0D9F70" />
                          <Text className="text-[#0D9F70] text-sm ml-1">Blockchain Verified</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  {ratings.length > 3 && (
                    <Text className="text-center text-[#0D9F70] font-pmedium">
                      +{ratings.length - 3} more reviews
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}
