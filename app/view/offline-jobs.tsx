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
  Calendar,
  DollarSign,
  MapPin,
  Clock,
  Certificate,
  ArrowLeft,
  ChevronRight,
  Search,
  Briefcase,
  Star,
} from "lucide-react-native"
import { useAuth } from "@/contexts/AuthContext"

// Offline Job type definition based on your schema
type OfflineJob = {
  id: string
  user_id: string
  title: string
  description: string
  images: string[]
  availability_type: "specific_dates" | "flexible" | "asap"
  preferred_start_date: string | null
  preferred_end_date: string | null
  location_id: string
  location_address: string
  location_details: string | null
  expected_budget: number | null
  currency: string
  professional_certification_required: boolean
  status: "open" | "in_progress" | "completed" | "cancelled"
  created_at: string
  updated_at: string
  category: { name: string } | null
  location: { address: string } | null // Changed from 'name' to 'address'
  user_profile?: {
    id: string
    bio: string | null
    profession: string | null
    user?: {
      email: string
      user_metadata: {
        full_name?: string
        avatar_url?: string
      }
    } | null
  } | null
  skill_level?: "amateur" | "intermediate" | "professional"
}

const ViewOfflineJobs = ({ navigation }) => {
  const { user: currentUser } = useAuth()
  const [jobs, setJobs] = useState<OfflineJob[]>([])
  const [selectedJob, setSelectedJob] = useState<OfflineJob | null>(null)
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

      // 1. Fix the query to select 'address' instead of 'name' in the locations table
      const { data: jobsData, error: jobsError } = await supabase
        .from("offline_jobs")
        .select(`
          *,
          category:category_id(name),
          location:location_id(address) 
        `)
        .eq("status", "open")
        .order("created_at", { ascending: false })

      if (jobsError) throw jobsError

      // Filter out current user's jobs right after fetching
      const filteredJobs = currentUser ? jobsData.filter((job) => job.user_id !== currentUser.id) : jobsData

      // 2. Fetch extended_profiles for all user_ids in filtered jobs
      const userIds = filteredJobs.map((job) => job.user_id)
      const { data: profilesData, error: profilesError } = await supabase
        .from("extended_profiles")
        .select("*")
        .in("user_id", userIds)

      if (profilesError) throw profilesError

      // 3. Merge jobs and profiles
      const jobsWithProfiles = filteredJobs.map((job) => {
        const profile = profilesData.find((profile) => profile.user_id === job.user_id) || null

        return {
          ...job,
          user_profile: profile || null,
        }
      })

      setJobs(jobsWithProfiles)
    } catch (err) {
      console.error("Error fetching offline jobs:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch offline jobs")
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
      job.category?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location_address.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const getStatusColor = (status: OfflineJob["status"]) => {
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

  const getAvailabilityTypeBadge = (type: OfflineJob["availability_type"]) => {
    switch (type) {
      case "specific_dates":
        return "bg-purple-100 text-purple-700"
      case "flexible":
        return "bg-blue-100 text-blue-700"
      case "asap":
        return "bg-red-100 text-red-700"
      default:
        return "bg-gray-100 text-gray-600"
    }
  }

  const getAvailabilityTypeLabel = (type: OfflineJob["availability_type"]) => {
    switch (type) {
      case "specific_dates":
        return "Specific Dates"
      case "flexible":
        return "Flexible"
      case "asap":
        return "ASAP"
      default:
        return type.replace("_", " ")
    }
  }

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null) return "Budget not specified"
    return `${currency} ${amount.toFixed(0)}`
  }

  const formatDateRange = (startDate: string | null, endDate: string | null, availabilityType: string) => {
    if (availabilityType === "asap") return "As soon as possible"
    if (availabilityType === "flexible") return "Flexible schedule"

    if (startDate && endDate) {
      const start = format(new Date(startDate), "MMM dd, yyyy")
      const end = format(new Date(endDate), "MMM dd, yyyy")
      return `${start} - ${end}`
    }

    if (startDate) {
      return `From ${format(new Date(startDate), "MMM dd, yyyy")}`
    }

    return "Dates not specified"
  }

  const getUserName = (job: OfflineJob) => {
    if (!job.user_profile) return "Unknown User"
    // If profession exists, use that when name is missing
    return job.user_profile.profession || "Anonymous User"
  }

  const getUserInitials = (job: OfflineJob) => {
    if (!job.user_profile?.user) return "??"
    const name = job.user_profile.user.user_metadata?.full_name || job.user_profile.user.email || ""
    return name.substring(0, 2).toUpperCase()
  }

  const getUserAvatar = (job: OfflineJob) => {
    if (!job.user_profile?.user?.user_metadata?.avatar_url) return null
    return job.user_profile.user.user_metadata.avatar_url
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

  const JobCard = ({ job }: { job: OfflineJob }) => (
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

        <View className="flex-row items-center">
          {job.skill_level && (
            <View className="flex-row items-center ml-2">
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

          <View className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${getAvailabilityTypeBadge(job.availability_type)}`}>
            <Text className="text-sm font-pmedium">{getAvailabilityTypeLabel(job.availability_type)}</Text>
          </View>
        </View>

        <View className="h-px bg-gray-100 my-3" />

        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center">
            <MapPin size={16} color="#0D9F70" />
            <Text className="text-gray-800 font-pmedium ml-1 flex-1" numberOfLines={1}>
              {job.location_address}
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <DollarSign size={16} color="#0D9F70" />
            <Text className="text-gray-800 font-pbold ml-1">
              {job.expected_budget ? `${job.currency} ${job.expected_budget}` : "Budget not specified"}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Calendar size={16} color="#0D9F70" />
            <Text className="text-gray-800 font-pmedium ml-1">
              {job.availability_type === "asap"
                ? "ASAP"
                : job.availability_type === "flexible"
                  ? "Flexible"
                  : "Scheduled"}
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

      <View className="flex-row items-center mb-3">
        <View className="w-4 h-4 bg-gray-200 rounded-full mr-2" />
        <View className="flex-1 h-4 bg-gray-200 rounded-md" />
      </View>

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

                <View
                  className={`px-3 py-1.5 rounded-full mb-2 ${getAvailabilityTypeBadge(selectedJob.availability_type)}`}
                >
                  <Text className="text-sm font-pmedium">
                    {getAvailabilityTypeLabel(selectedJob.availability_type)}
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
                    <MapPin size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-gray-500 text-xs font-pregular">Location</Text>
                    <Text className="text-gray-800 font-pmedium">{selectedJob.location_address}</Text>
                    {selectedJob.location_details && (
                      <Text className="text-gray-600 text-sm mt-1">{selectedJob.location_details}</Text>
                    )}
                  </View>
                </View>

                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <DollarSign size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-500 text-xs font-pregular">Budget</Text>
                    <Text className="text-gray-800 font-pmedium">
                      {formatCurrency(selectedJob.expected_budget, selectedJob.currency)}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <Clock size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-500 text-xs font-pregular">Availability</Text>
                    <Text className="text-gray-800 font-pmedium">
                      {getAvailabilityTypeLabel(selectedJob.availability_type)}
                    </Text>
                  </View>
                </View>

                {(selectedJob.availability_type === "specific_dates" || selectedJob.preferred_start_date) && (
                  <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                      <Calendar size={18} color="#0D9F70" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-gray-500 text-xs font-pregular">Preferred Dates</Text>
                      <Text className="text-gray-800 font-pmedium">
                        {formatDateRange(
                          selectedJob.preferred_start_date,
                          selectedJob.preferred_end_date,
                          selectedJob.availability_type,
                        )}
                      </Text>
                    </View>
                  </View>
                )}

                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <Certificate size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-500 text-xs font-pregular">Certification Required</Text>
                    <Text className="text-gray-800 font-pmedium">
                      {selectedJob.professional_certification_required ? "Yes" : "No"}
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
        {searchQuery ? "No matching jobs found" : "No offline jobs available"}
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
            onPress={() => navigation.goBack()}
            className="absolute left-0 p-2 rounded-full"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-psemibold">Offline Jobs</Text>
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

export default ViewOfflineJobs
