"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Animated,
  TextInput,
  RefreshControl,
} from "react-native"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import {
  X,
  Clock,
  DollarSign,
  MapPin,
  Award,
  Calendar,
  ArrowLeft,
  ChevronRight,
  Search,
  Briefcase,
  Star,
  Wrench,
  Banknote
} from "lucide-react-native"
import { useAuth } from "@/contexts/AuthContext" // Add this import

// Job type definition based on your schema
type Job = {
  id: string
  user_id: string
  title: string
  description: string
  payment_type: "hourly" | "project"
  amount: number
  currency: string
  time_required: number
  time_unit: string
  skill_level: "amateur" | "intermediate" | "professional"
  status: "open" | "in_progress" | "completed" | "cancelled"
  location_address: string | null
  images: string[]
  created_at: string
  updated_at: string
  category: { name: string } | null
  user_profile?: {
    id: string
    bio: string | null
    profession: string | null
    user: {
      full_name?: string
      phone_number?: string
      is_verified?: boolean
      avatar_url?: string
    } | null
  } | null
}

const ViewOnlineJobs = ({ navigation }) => {
  const { user: currentUser } = useAuth() // Add this line to get current user from AuthContext
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [modalAnimation] = useState(new Animated.Value(0))

  // Skeleton loading array
  const skeletonArray = Array(6).fill(0)

  useEffect(() => {
    fetchJobs()
  }, [])

  useEffect(() => {
    if (selectedJob) {
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
  }, [selectedJob])

  const fetchJobs = async () => {
    try {
      setLoading(true)
  
      // 1. Fetch jobs with category
      const { data: jobsData, error: jobsError } = await supabase
        .from("jobs")
        .select(`
          *,
          category:category_id(name)
        `)
        .eq("status", "open")
        .order("created_at", { ascending: false })
  
      if (jobsError) throw jobsError
      
      // Filter out current user's jobs right after fetching
      const filteredJobs = currentUser ? jobsData.filter(job => job.user_id !== currentUser.id) : jobsData
  
      // 2. Get all unique user IDs from the jobs
      const userIds = [...new Set(filteredJobs.map(job => job.user_id))]
      
      console.log("User IDs from jobs:", userIds)
      
      // 3. Fetch profiles for user information
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds)
  
      if (profilesError) throw profilesError
      console.log("Profiles fetched:", profilesData ? profilesData.length : 0)
      
      // 4. Fetch extended_profiles for additional information
      const { data: extendedProfilesData, error: extendedProfilesError } = await supabase
        .from("extended_profiles")
        .select("*")
        .in("user_id", userIds)
  
      if (extendedProfilesError) throw extendedProfilesError
      console.log("Extended profiles fetched:", extendedProfilesData ? extendedProfilesData.length : 0)
  
      // 5. Merge jobs with profile data - FIXED VERSION
      const jobsWithProfiles = filteredJobs.map(job => {
        const profile = profilesData?.find(p => p.user_id === job.user_id)
        const extendedProfile = extendedProfilesData?.find(ep => ep.user_id === job.user_id)
        
        console.log(`Job ${job.id}:`, {
          user_id: job.user_id,
          has_profile: !!profile,
          has_extended_profile: !!extendedProfile,
          profile_name: profile?.full_name || "NO NAME",
          extended_profession: extendedProfile?.profession || "NO PROFESSION"
        })
        
        return {
          ...job,
          user_profile: {
            id: extendedProfile?.id || null,
            bio: extendedProfile?.bio || null,
            profession: extendedProfile?.profession || null,
            user: profile ? {
              full_name: profile.full_name || null,
              phone_number: profile.phone_number || null,
              is_verified: profile.is_verified || false,
              avatar_url: null // To be added later
            } : null
          }
        }
      })
  
      setJobs(jobsWithProfiles)
    } catch (err) {
      console.error("Error fetching jobs:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch jobs")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchJobs()
  }

  const filteredJobs = jobs.filter(
    (job) =>
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.category?.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const getStatusColor = (status: Job["status"]) => {
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

  const getSkillLevelBadge = (level: Job["skill_level"]) => {
    switch (level) {
      case "amateur":
        return "bg-emerald-100 text-emerald-700"
      case "intermediate":
        return "bg-blue-100 text-blue-700"
      case "professional":
        return "bg-purple-100 text-purple-700"
      default:
        return "bg-gray-100 text-gray-600"
    }
  }

  const getSkillLevelIcon = (level: Job["skill_level"]) => {
          const starColor = "#0D9F70"; // Gold color for the stars
          const starSize = 12; // Adjust the size as needed
  
          const renderStars = (count: number) => (
              <View className="flex-row mt-1">
                  {Array.from({ length: count }).map((_, index) => (
                      <Star key={index} size={starSize} color={starColor} />
                  ))}
              </View>
          );
  
          switch (level) {
              case "amateur":
                  return renderStars(1);
              case "intermediate":
                  return renderStars(2);
              case "professional":
                  return renderStars(3);
              default:
                  return renderStars(1);
          }
      }

  const renderSkillStars = (level: "amateur" | "intermediate" | "professional") => {
    let count = 1
    if (level === "intermediate") count = 2
    if (level === "professional") count = 3
    return (
      <View style={{ flexDirection: "row", alignItems: "center", marginRight: 4 }}>
        {[...Array(count)].map((_, i) => (
          <Star
            key={i}
            size={14}
            color="#fff"
            fill="none"
            strokeWidth={1.5}
            style={{ marginRight: 1 }}
          />
        ))}
      </View>
    )
  }

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toFixed(0)}`
  }

  const getUserName = (job: Job) => {
    console.log("getUserName for job:", job.id, {
      has_user_profile: !!job.user_profile,
      has_user: !!job.user_profile?.user,
      has_name: !!job.user_profile?.user?.full_name,
      has_profession: !!job.user_profile?.profession
    })
    
    if (!job.user_profile) return "Unknown User"
    
    // Try to get name from user object
    if (job.user_profile.user && job.user_profile.user.full_name) {
      return job.user_profile.user.full_name
    }
    
    // Fall back to profession
    if (job.user_profile.profession) {
      return job.user_profile.profession
    }
    
    // Last resort
    return "Anonymous User"
  }

  const getUserInitials = (job: Job) => {
    // Try to get initials from user's full name first
    if (job.user_profile?.user?.full_name) {
      const fullName = job.user_profile.user.full_name
      const nameParts = fullName.split(" ")
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
      }
      return fullName.substring(0, 2).toUpperCase()
    }
    
    // Fall back to profession initials
    if (job.user_profile?.profession) {
      return job.user_profile.profession.substring(0, 2).toUpperCase()
    }
    
    return "??"
  }

  const getUserAvatar = (job: Job) => {
    if (!job.user_profile?.user?.avatar_url) return null
    return job.user_profile.user.avatar_url
  }

  const JobCard = ({ job }: { job: Job }) => (
    <TouchableOpacity
      className="bg-white rounded-2xl mb-4 overflow-hidden shadow-sm border border-gray-100"
      style={{ elevation: 2 }}
      onPress={() => setSelectedJob(job)}
      activeOpacity={0.7}
    >
      <View className="p-5">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-3">
            <Text className="text-lg font-pbold text-gray-800">{job.title}</Text>
          </View>
          <View className={`px-3 py-1.5 rounded-full ${getStatusColor(job.status)}`}>
            <Text className="text-xs text-white font-pmedium">
              {job.status === "open" ? "Open" : job.status.replace("_", " ")}
            </Text>
          </View>
        </View>

        {/* Skill level stars and label */}
        <View className="flex-row items-center mt-3">
          {job.skill_level && (
            <View className="flex-row items-center">
              {renderSkillStars(job.skill_level)}
              <Text className="text-white text-xs font-pmedium ml-1 capitalize">{job.skill_level}</Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center mt-3 flex-wrap">
          {job.category?.name && (
            <View className="bg-[#E7F7F1] px-3 py-1.5 rounded-full mr-2 mb-2">
              <Text className="text-sm font-pmedium text-[#0D9F70]">{job.category.name}</Text>
            </View>
          )}

          <View className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${getSkillLevelBadge(job.skill_level)}`}>
            <Text className="text-sm font-pmedium capitalize">
              {job.skill_level} {getSkillLevelIcon(job.skill_level)}
            </Text>
          </View>
        </View>

        <View className="h-px bg-gray-100 my-3" />

        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <Banknote size={16} color="#0D9F70" />
            <Text className="text-gray-800 font-pbold ml-1">
              {job.currency} {job.amount}
              <Text className="text-gray-500 font-pregular">
                {" "}
                • {job.payment_type === "hourly" ? "Hourly" : "Project"}
              </Text>
            </Text>
          </View>

          <View className="flex-row items-center">
            <Clock size={16} color="#0D9F70" />
            <Text className="text-gray-800 font-pmedium ml-1">
              {job.time_required} {job.time_unit}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center mt-3">
          {getUserAvatar(job) ? (
            <Image source={{ uri: getUserAvatar(job) }} className="w-6 h-6 rounded-full mr-2" />
          ) : (
            <View className="w-6 h-6 rounded-full bg-[#E7F7F1] items-center justify-center mr-2">
              <Text className="text-xs text-[#0D9F70] font-pbold">{getUserInitials(job)}</Text>
            </View>
          )}
          <Text className="text-gray-500 text-xs font-pregular">Posted by {getUserName(job)}</Text>
        </View>

        <View className="flex-row items-center justify-between mt-3">
          <Text className="text-gray-500 text-xs font-pregular">
            {format(new Date(job.created_at), "MMM dd, yyyy")}
          </Text>
          <View className="flex-row items-center">
            <Text className="text-[#0D9F70] font-pmedium mr-1">Details</Text>
            <ChevronRight size={16} color="#0D9F70" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )

  const JobSkeleton = () => (
    <View
      className="bg-white rounded-2xl mb-4 overflow-hidden shadow-sm border border-gray-100 p-5"
      style={{ elevation: 2 }}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3 h-5 bg-gray-200 rounded-md" />
        <View className="w-16 h-6 bg-gray-200 rounded-full" />
      </View>

      <View className="flex-row mt-3">
        <View className="w-24 h-7 bg-gray-200 rounded-full mr-2" />
        <View className="w-24 h-7 bg-gray-200 rounded-full" />
      </View>

      <View className="h-px bg-gray-100 my-3" />

      <View className="flex-row justify-between items-center">
        <View className="w-32 h-5 bg-gray-200 rounded-md" />
        <View className="w-24 h-5 bg-gray-200 rounded-md" />
      </View>

      <View className="flex-row items-center mt-3">
        <View className="w-6 h-6 rounded-full bg-gray-200 mr-2" />
        <View className="w-40 h-4 bg-gray-200 rounded-md" />
      </View>

      <View className="flex-row items-center justify-between mt-3">
        <View className="w-24 h-4 bg-gray-200 rounded-md" />
        <View className="w-20 h-4 bg-gray-200 rounded-md" />
      </View>
    </View>
  )

  const JobDetailModal = () => {
    if (!selectedJob) return null

    const translateY = modalAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [300, 0],
    })

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!selectedJob}
        onRequestClose={() => setSelectedJob(null)}
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

            <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
              <View className="flex-row justify-between items-center mb-4 pt-2">
                <Text className="text-2xl font-pbold text-gray-800 flex-1 mr-2">{selectedJob.title}</Text>
                <TouchableOpacity
                  onPress={() => setSelectedJob(null)}
                  className="p-2 rounded-full bg-gray-100"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View className="flex-row flex-wrap mb-5">
                <View className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${getStatusColor(selectedJob.status)}`}>
                  <Text className="text-sm text-white font-pmedium">
                    {selectedJob.status === "open" ? "Open" : selectedJob.status.replace("_", " ")}
                  </Text>
                </View>

                {selectedJob.category?.name && (
                  <View className="bg-[#E7F7F1] px-3 py-1.5 rounded-full mr-2 mb-2">
                    <Text className="text-sm font-pmedium text-[#0D9F70]">{selectedJob.category.name}</Text>
                  </View>
                )}

                <View className={`px-3 py-1.5 rounded-full mb-2 ${getSkillLevelBadge(selectedJob.skill_level)}`}>
                  <Text className="text-sm font-pmedium capitalize">
                    {selectedJob.skill_level} {getSkillLevelIcon(selectedJob.skill_level)}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center mb-4">
                {getUserAvatar(selectedJob) ? (
                  <Image source={{ uri: getUserAvatar(selectedJob) }} className="w-8 h-8 rounded-full mr-2" />
                ) : (
                  <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-2">
                    <Text className="text-sm text-[#0D9F70] font-pbold">{getUserInitials(selectedJob)}</Text>
                  </View>
                )}
                <Text className="text-gray-700 font-pmedium">Posted by {getUserName(selectedJob)}</Text>
              </View>

              {selectedJob.images && selectedJob.images.length > 0 && (
                <View className="mb-6">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-1">
                    {selectedJob.images.map((imageUrl, index) => (
                      <Image
                        key={index}
                        source={{ uri: imageUrl }}
                        className="w-32 h-32 rounded-2xl mr-3"
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              <View className="bg-gray-50 p-4 rounded-2xl mb-6">
                <Text className="text-[#0D9F70] mb-2 text-base font-pbold">Description</Text>
                <Text className="text-gray-700 font-pregular leading-5">{selectedJob.description}</Text>
              </View>

              <View className="bg-gray-50 p-4 rounded-2xl mb-6">
                <Text className="text-[#0D9F70] mb-3 text-base font-pbold">Job Details</Text>

                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <Banknote size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-500 text-xs font-pregular">Payment</Text>
                    <Text className="text-gray-800 font-pmedium">
                      {formatCurrency(selectedJob.amount, selectedJob.currency)} •{" "}
                      {selectedJob.payment_type === "hourly" ? "Hourly rate" : "Project budget"}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <Clock size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-500 text-xs font-pregular">Time Required</Text>
                    <Text className="text-gray-800 font-pmedium">
                      {selectedJob.time_required} {selectedJob.time_unit}
                    </Text>
                  </View>
                </View>

                {selectedJob.location_address && (
                  <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                      <MapPin size={18} color="#0D9F70" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-gray-500 text-xs font-pregular">Location</Text>
                      <Text className="text-gray-800 font-pmedium">{selectedJob.location_address}</Text>
                    </View>
                  </View>
                )}

                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <Wrench size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-500 text-xs font-pregular">Skill Level</Text>
                    <Text className="text-gray-800 font-pmedium capitalize">
                      {selectedJob.skill_level} {getSkillLevelIcon(selectedJob.skill_level)}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <Calendar size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-500 text-xs font-pregular">Posted Date</Text>
                    <Text className="text-gray-800 font-pmedium">
                      {format(new Date(selectedJob.created_at), "MMMM dd, yyyy")}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="h-24" />
            </ScrollView>

            <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4">
              <TouchableOpacity
                className="bg-[#0D9F70] py-3.5 rounded-xl w-full items-center"
                onPress={() => setSelectedJob(null)}
              >
                <Text className="text-white font-pbold">Close</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    )
  }

  const EmptyState = () => (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0D9F70"]} />}
    >
      <Briefcase size={48} color="#ccc" />
      <Text className="text-xl font-pbold text-gray-800 mb-2 mt-4">
        {searchQuery ? "No matching jobs found" : "No jobs available"}
      </Text>
      <Text className="text-gray-600 text-center mb-6 font-pregular">
        {searchQuery ? "Try adjusting your search terms or clear the search" : "Check back later for new opportunities"}
      </Text>
      {searchQuery && (
        <TouchableOpacity className="border border-[#0D9F70] py-3 px-6 rounded-xl" onPress={() => setSearchQuery("")}>
          <Text className="text-[#0D9F70] font-pmedium">Clear Search</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
        <View className="bg-[#0D9F70] pt-12 pb-6 px-4 rounded-b-3xl shadow-md">
        <View className="flex-row items-center justify-center relative">
          <TouchableOpacity
            onPress={() => {
              if (navigation && typeof navigation.goBack === "function") {
                navigation.goBack()
              } else if (navigation && typeof navigation.navigate === "function") {
                navigation.navigate("Home")
              }
            }}
            className="absolute left-0 p-2 rounded-full"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-psemibold">Online Jobs</Text>
        </View>

        <View className="mt-4 relative">
          <TextInput
            placeholder="Search jobs..."
            placeholderTextColor="#E7F7F1"
            className="bg-white/10 text-white pl-10 pr-4 py-3 rounded-xl border border-white/20"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View className="absolute left-3 top-3">
            <Search size={20} color="#E7F7F1" />
          </View>
        </View>
      </View>

      {loading ? (
        <FlatList
          data={skeletonArray}
          keyExtractor={(_, index) => `skeleton-${index}`}
          renderItem={() => <JobSkeleton />}
          contentContainerStyle={{ padding: 16 }}
        />
      ) : error ? (
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-red-500 mb-2 font-pmedium">Error loading jobs</Text>
          <Text className="text-gray-600 mb-4 font-pregular">{error}</Text>
          <TouchableOpacity className="bg-[#0D9F70] px-6 py-3 rounded-xl" onPress={fetchJobs}>
            <Text className="text-white font-pmedium">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : filteredJobs.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <JobCard job={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0D9F70"]} />}
        />
      )}

      <JobDetailModal />
    </View>
  )
}

export default ViewOnlineJobs
