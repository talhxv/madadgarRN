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
  Alert,
  ActivityIndicator,
} from "react-native"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import {
  X,
  MapPin,
  Calendar,
  ArrowLeft,
  ChevronRight,
  Search,
  Briefcase,
  Banknote,
  Trash2,
  Wrench,
  CalendarRange,
} from "lucide-react-native"
import { useAuth } from "@/contexts/AuthContext"
import { MakeOfflineProposalModal } from "@/components/make-offline-proposal-modal"
import LocationViewer from "@/components/location-viewer"

// Offline Job type definition based on your schema
type OfflineJob = {
  id: string
  user_id: string
  title: string
  description: string
  availability_type: "specific_dates" | "flexible" | "asap"
  preferred_start_date: string | null
  preferred_end_date: string | null
  expected_budget: number | null
  currency: string
  professional_certification_required: boolean
  status: "open" | "in_progress" | "completed" | "cancelled"
  location_id: string
  location_address: string
  location_details: string | null
  location_latitude?: number
  location_longitude?: number
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
  // New field to track if user has already made a proposal
  hasProposal?: boolean
  proposalId?: string
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
  const [showProposalModal, setShowProposalModal] = useState(false)
  const [deletingProposal, setDeletingProposal] = useState(false)
  const [proposalCounts, setProposalCounts] = useState<{ [jobId: string]: number }>({})
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [showLocationMap, setShowLocationMap] = useState(false)

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

  const fetchProposalCounts = async (jobIds: string[]) => {
    if (jobIds.length === 0) return
    const { data, error } = await supabase
      .from("offline_proposals")
      .select("offline_job_id", { count: "exact", head: false })
      .in("offline_job_id", jobIds)
    if (error) {
      console.error("Error fetching proposal counts:", error)
      return
    }
    // Count proposals per job
    const counts: { [jobId: string]: number } = {}
    data.forEach((row) => {
      counts[row.offline_job_id] = (counts[row.offline_job_id] || 0) + 1
    })
    setProposalCounts(counts)
  }

  // Function to get coordinates from the locations table
  const getCoordinatesFromLocationsTable = async (locationIds: string[]) => {
    if (!locationIds.length) return {}

    try {
      // Query the locations table to get coordinates for all location_ids
      const { data, error } = await supabase.from("locations").select("id, geom, address").in("id", locationIds)

      if (error) {
        console.error("Error fetching locations:", error)
        return {}
      }

      // Create a map of location_id to coordinates
      const coordinatesMap: { [locationId: string]: { latitude: number; longitude: number } } = {}

      data.forEach((location) => {
        // Extract coordinates from the geography type
        // The geography type in PostGIS is typically stored as POINT(longitude latitude)
        if (location.geom) {
          try {
            // Parse the geography data to get coordinates
            // This assumes the geom field is in a format like 'POINT(longitude latitude)'
            // or that it has properties to access the coordinates

            // If geom is a string like 'POINT(longitude latitude)'
            if (typeof location.geom === "string") {
              const match = location.geom.match(/POINT$$([^ ]+) ([^)]+)$$/)
              if (match) {
                coordinatesMap[location.id] = {
                  longitude: Number.parseFloat(match[1]),
                  latitude: Number.parseFloat(match[2]),
                }
              }
            }
            // If geom is an object with coordinates
            else if (location.geom.coordinates) {
              // GeoJSON format: [longitude, latitude]
              coordinatesMap[location.id] = {
                longitude: location.geom.coordinates[0],
                latitude: location.geom.coordinates[1],
              }
            }
            // If geom has lat/lng properties
            else if (location.geom.latitude !== undefined && location.geom.longitude !== undefined) {
              coordinatesMap[location.id] = {
                latitude: location.geom.latitude,
                longitude: location.geom.longitude,
              }
            }
            // If geom has x/y properties (PostGIS sometimes uses these)
            else if (location.geom.x !== undefined && location.geom.y !== undefined) {
              coordinatesMap[location.id] = {
                longitude: location.geom.x,
                latitude: location.geom.y,
              }
            }
          } catch (e) {
            console.error(`Error parsing geom for location ${location.id}:`, e)
          }
        }
      })

      return coordinatesMap
    } catch (e) {
      console.error("Error in getCoordinatesFromLocationsTable:", e)
      return {}
    }
  }

  // Alternative function to get coordinates by address
  const getCoordinatesByAddress = async (addresses: string[]) => {
    if (!addresses.length) return {}

    try {
      // Query the locations table to get coordinates for all addresses
      const { data, error } = await supabase.from("locations").select("id, geom, address").in("address", addresses)

      if (error) {
        console.error("Error fetching locations by address:", error)
        return {}
      }

      // Create a map of address to coordinates
      const coordinatesMap: { [address: string]: { latitude: number; longitude: number } } = {}

      data.forEach((location) => {
        if (location.geom && location.address) {
          try {
            // Same parsing logic as above
            if (typeof location.geom === "string") {
              const match = location.geom.match(/POINT$$([^ ]+) ([^)]+)$$/)
              if (match) {
                coordinatesMap[location.address] = {
                  longitude: Number.parseFloat(match[1]),
                  latitude: Number.parseFloat(match[2]),
                }
              }
            } else if (location.geom.coordinates) {
              coordinatesMap[location.address] = {
                longitude: location.geom.coordinates[0],
                latitude: location.geom.coordinates[1],
              }
            } else if (location.geom.latitude !== undefined && location.geom.longitude !== undefined) {
              coordinatesMap[location.address] = {
                latitude: location.geom.latitude,
                longitude: location.geom.longitude,
              }
            } else if (location.geom.x !== undefined && location.geom.y !== undefined) {
              coordinatesMap[location.address] = {
                longitude: location.geom.x,
                latitude: location.geom.y,
              }
            }
          } catch (e) {
            console.error(`Error parsing geom for address ${location.address}:`, e)
          }
        }
      })

      return coordinatesMap
    } catch (e) {
      console.error("Error in getCoordinatesByAddress:", e)
      return {}
    }
  }

  const fetchJobs = async () => {
    try {
      setLoading(true)

      // 1. Fetch offline jobs with category
      const { data: jobsData, error: jobsError } = await supabase
        .from("offline_jobs")
        .select(`
          *,
          category:category_id(name)
        `)
        .eq("status", "open")
        .order("created_at", { ascending: false })

      if (jobsError) throw jobsError

      // Filter out current user's jobs right after fetching
      const filteredJobs = currentUser ? jobsData.filter((job) => job.user_id !== currentUser.id) : jobsData

      // 2. Get all unique user IDs from the jobs
      const userIds = [...new Set(filteredJobs.map((job) => job.user_id))]

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

      // 5. If user is logged in, fetch their proposals to check which jobs they've already applied to
      let userProposals: { offline_job_id: string; id: string }[] = []
      if (currentUser) {
        const { data: proposalsData, error: proposalsError } = await supabase
          .from("offline_proposals")
          .select("id, offline_job_id")
          .eq("user_id", currentUser.id)

        if (proposalsError) {
          console.error("Error fetching user proposals:", proposalsError)
        } else {
          userProposals = proposalsData || []
          console.log("User proposals fetched:", userProposals.length)
        }
      }

      // 6. Fetch location coordinates for all jobs
      // First try by location_id
      const locationIds = filteredJobs.map((job) => job.location_id).filter((id) => id) // Filter out null/undefined

      const locationAddresses = filteredJobs.map((job) => job.location_address).filter((address) => address) // Filter out null/undefined

      console.log(
        `Fetching coordinates for ${locationIds.length} location IDs and ${locationAddresses.length} addresses`,
      )

      // Get coordinates by location_id
      const coordinatesByIdMap = await getCoordinatesFromLocationsTable(locationIds)

      // Get coordinates by address as backup
      const coordinatesByAddressMap = await getCoordinatesByAddress(locationAddresses)

      console.log(
        `Found coordinates for ${Object.keys(coordinatesByIdMap).length} location IDs and ${Object.keys(coordinatesByAddressMap).length} addresses`,
      )

      // 7. Merge jobs with profile data, proposal status, and coordinates
      const jobsWithProfiles = filteredJobs.map((job) => {
        const profile = profilesData?.find((p) => p.user_id === job.user_id)
        const extendedProfile = extendedProfilesData?.find((ep) => ep.user_id === job.user_id)

        // Check if user has already made a proposal for this job
        const existingProposal = userProposals.find((p) => p.offline_job_id === job.id)
        const hasProposal = !!existingProposal
        const proposalId = existingProposal?.id

        // Get coordinates from our maps
        let coordinates = null

        // First try by location_id
        if (job.location_id && coordinatesByIdMap[job.location_id]) {
          coordinates = coordinatesByIdMap[job.location_id]
        }
        // Then try by address
        else if (job.location_address && coordinatesByAddressMap[job.location_address]) {
          coordinates = coordinatesByAddressMap[job.location_address]
        }

        return {
          ...job,
          // Add coordinates if we found them
          ...(coordinates && {
            location_latitude: coordinates.latitude,
            location_longitude: coordinates.longitude,
          }),
          user_profile: {
            id: extendedProfile?.id || null,
            bio: extendedProfile?.bio || null,
            profession: extendedProfile?.profession || null,
            user: profile
              ? {
                  full_name: profile.full_name || null,
                  phone_number: profile.phone_number || null,
                  is_verified: profile.is_verified || false,
                  avatar_url: null, // To be added later
                }
              : null,
          },
          hasProposal,
          proposalId,
        }
      })

      setJobs(jobsWithProfiles)
      // Fetch proposal counts for all jobs
      const jobIds = jobsWithProfiles.map((job) => job.id)
      fetchProposalCounts(jobIds)
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
        return "bg-blue-100 text-blue-700"
      case "flexible":
        return "bg-purple-100 text-purple-700"
      case "asap":
        return "bg-amber-100 text-amber-700"
      default:
        return "bg-gray-100 text-gray-600"
    }
  }

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount === null) return "Budget not specified"
    return `${currency} ${amount.toFixed(0)}`
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not specified"
    try {
      return format(new Date(dateString), "MMM dd, yyyy")
    } catch (error) {
      console.warn("Invalid date format:", error)
      return "Not specified"
    }
  }

  const getUserName = (job: OfflineJob) => {
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

  const getUserInitials = (job: OfflineJob) => {
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

  const getUserAvatar = (job: OfflineJob) => {
    if (!job.user_profile?.user?.avatar_url) return null
    return job.user_profile.user.avatar_url
  }

  const handleMakeOffer = () => {
    if (!currentUser) {
      // Handle not logged in case
      Alert.alert("Login Required", "Please log in to make an offer")
      return
    }

    setShowProposalModal(true)
  }

  const handleDeleteProposal = async () => {
    if (!selectedJob || !selectedJob.proposalId || !currentUser) {
      return
    }

    Alert.alert("Delete Proposal", "Are you sure you want to delete your proposal for this job?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingProposal(true)

            // 1. Fetch the proposal to get portfolio_images
            const { data: proposal, error: fetchError } = await supabase
              .from("proposals")
              .select("portfolio_images")
              .eq("id", selectedJob.proposalId)
              .eq("user_id", currentUser.id)
              .single()

            if (fetchError) throw fetchError

            // 2. Delete images from storage if any
            if (proposal?.portfolio_images && proposal.portfolio_images.length > 0) {
              // Extract storage paths from public URLs
              const paths = proposal.portfolio_images
                .map((url: string) => {
                  const match = url.match(/portfolio\/(.+)$/)
                  return match ? match[1] : null
                })
                .filter(Boolean)

              if (paths.length > 0) {
                const { error: removeError } = await supabase.storage.from("portfolio").remove(paths)
                if (removeError) {
                  console.warn("Some images could not be deleted from storage:", removeError)
                }
              }
            }

            // 3. Delete the proposal row
            const { error } = await supabase
              .from("proposals")
              .delete()
              .eq("id", selectedJob.proposalId)
              .eq("user_id", currentUser.id)

            if (error) throw error

            // Update the local state
            setJobs((prevJobs) =>
              prevJobs.map((job) =>
                job.id === selectedJob.id ? { ...job, hasProposal: false, proposalId: undefined } : job,
              ),
            )

            setSelectedJob((prev) => (prev ? { ...prev, hasProposal: false, proposalId: undefined } : null))

            Alert.alert("Success", "Your proposal has been deleted successfully.")
          } catch (error) {
            console.error("Error deleting proposal or images:", error)
            Alert.alert("Error", "Failed to delete your proposal. Please try again.")
          } finally {
            setDeletingProposal(false)
          }
        },
      },
    ])
  }

  const handleImagePress = (imageUrl: string) => {
    setSelectedImage(imageUrl)
  }

  const JobCard = ({ job }: { job: OfflineJob }) => (
    <TouchableOpacity
      className={`bg-white rounded-2xl mb-4 overflow-hidden shadow-sm border border-gray-100 ${
        job.hasProposal ? "opacity-70" : ""
      }`}
      style={{ elevation: 2 }}
      onPress={() => setSelectedJob(job)}
      activeOpacity={0.7}
    >
      <View className="p-5">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-3">
            <Text className="text-lg font-pbold text-gray-800">{job.title}</Text>
          </View>
          <View className="flex-row items-center">
            {/* Show proposal count */}
            <View className="bg-gray-100 px-3 py-1.5 rounded-full mr-2 flex-row items-center">
              <Text className="text-xs font-pmedium text-gray-700">{proposalCounts[job.id] || 0} applied</Text>
            </View>
            {job.hasProposal && (
              <View className="bg-blue-100 px-3 py-1.5 rounded-full mr-2">
                <Text className="text-xs font-pmedium text-blue-700">Applied</Text>
              </View>
            )}
            <View className={`px-3 py-1.5 rounded-full ${getStatusColor(job.status)}`}>
              <Text className="text-xs text-white font-pmedium">
                {job.status === "open" ? "Open" : job.status.replace("_", " ")}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row items-center mt-3 flex-wrap">
          {job.category?.name && (
            <View className="bg-[#E7F7F1] px-3 py-1.5 rounded-full mr-2 mb-2">
              <Text className="text-sm font-pmedium text-[#0D9F70]">{job.category.name}</Text>
            </View>
          )}

          <View className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${getAvailabilityTypeBadge(job.availability_type)}`}>
            <Text className="text-sm font-pmedium capitalize">
              {job.availability_type === "specific_dates"
                ? "Specific Dates"
                : job.availability_type === "asap"
                  ? "ASAP"
                  : "Flexible"}
            </Text>
          </View>

          {job.professional_certification_required && (
            <View className="bg-amber-100 px-3 py-1.5 rounded-full mb-2">
              <Text className="text-sm font-pmedium text-amber-700">Certification Required</Text>
            </View>
          )}
        </View>

        <View className="h-px bg-gray-100 my-3" />

        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <Banknote size={16} color="#0D9F70" />
            <Text className="text-gray-800 font-pbold ml-1">
              {job.expected_budget ? `${job.currency} ${job.expected_budget}` : "Budget not specified"}
            </Text>
          </View>

          <View className="flex-row items-center">
            <MapPin size={16} color="#0D9F70" />
            <Text className="text-gray-800 font-pmedium ml-1" numberOfLines={1}>
              {job.location_address.length > 20 ? job.location_address.substring(0, 20) + "..." : job.location_address}
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

    // Check if dates are available for specific_dates type
    const hasStartDate = selectedJob.preferred_start_date !== null && selectedJob.preferred_start_date !== undefined
    const hasEndDate = selectedJob.preferred_end_date !== null && selectedJob.preferred_end_date !== undefined
    const showDates = selectedJob.availability_type === "specific_dates" && (hasStartDate || hasEndDate)

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
                {selectedJob.hasProposal && (
                  <View className="bg-blue-100 px-3 py-1.5 rounded-full mr-2 mb-2">
                    <Text className="text-sm font-pmedium text-blue-700">Applied</Text>
                  </View>
                )}

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
                  className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${getAvailabilityTypeBadge(selectedJob.availability_type)}`}
                >
                  <Text className="text-sm font-pmedium capitalize">
                    {selectedJob.availability_type === "specific_dates"
                      ? "Specific Dates"
                      : selectedJob.availability_type === "asap"
                        ? "ASAP"
                        : "Flexible"}
                  </Text>
                </View>

                {selectedJob.professional_certification_required && (
                  <View className="bg-amber-100 px-3 py-1.5 rounded-full mb-2">
                    <Text className="text-sm font-pmedium text-amber-700">Certification Required</Text>
                  </View>
                )}
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
                      <TouchableOpacity key={index} onPress={() => handleImagePress(imageUrl)} activeOpacity={0.8}>
                        <Image source={{ uri: imageUrl }} className="w-32 h-32 rounded-2xl mr-3" resizeMode="cover" />
                      </TouchableOpacity>
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
                    <Text className="text-gray-500 text-xs font-pregular">Expected Budget</Text>
                    <Text className="text-gray-800 font-pmedium">
                      {formatCurrency(selectedJob.expected_budget, selectedJob.currency)}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <CalendarRange size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-500 text-xs font-pregular">Availability</Text>
                    <Text className="text-gray-800 font-pmedium capitalize">
                      {selectedJob.availability_type === "specific_dates"
                        ? "Specific Dates"
                        : selectedJob.availability_type === "asap"
                          ? "ASAP"
                          : "Flexible"}
                    </Text>
                  </View>
                </View>

                {/* Only show date fields if they exist */}
                {selectedJob.availability_type === "specific_dates" && (
                  <>
                    {hasStartDate && (
                      <View className="flex-row items-center mb-4">
                        <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                          <Calendar size={18} color="#0D9F70" />
                        </View>
                        <View className="ml-3">
                          <Text className="text-gray-500 text-xs font-pregular">Start Date</Text>
                          <Text className="text-gray-800 font-pmedium">
                            {formatDate(selectedJob.preferred_start_date)}
                          </Text>
                        </View>
                      </View>
                    )}

                    {hasEndDate && (
                      <View className="flex-row items-center mb-4">
                        <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                          <Calendar size={18} color="#0D9F70" />
                        </View>
                        <View className="ml-3">
                          <Text className="text-gray-500 text-xs font-pregular">End Date</Text>
                          <Text className="text-gray-800 font-pmedium">
                            {formatDate(selectedJob.preferred_end_date)}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Show a message if no dates are specified but availability type is specific_dates */}
                    {!hasStartDate && !hasEndDate && (
                      <View className="flex-row items-center mb-4">
                        <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                          <Calendar size={18} color="#0D9F70" />
                        </View>
                        <View className="ml-3">
                          <Text className="text-gray-500 text-xs font-pregular">Dates</Text>
                          <Text className="text-gray-800 font-pmedium">Dates not specified</Text>
                        </View>
                      </View>
                    )}
                  </>
                )}

                <TouchableOpacity className="flex-row items-center mb-4" onPress={() => setShowLocationMap(true)}>
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <MapPin size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-gray-500 text-xs font-pregular">Location</Text>
                    <View className="flex-row items-center">
                      <Text className="text-gray-800 font-pmedium">{selectedJob.location_address}</Text>
                      <ChevronRight size={16} color="#0D9F70" className="ml-1" />
                    </View>
                  </View>
                </TouchableOpacity>

                {selectedJob.location_details && (
                  <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                      <MapPin size={18} color="#0D9F70" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-gray-500 text-xs font-pregular">Location Details</Text>
                      <Text className="text-gray-800 font-pmedium">{selectedJob.location_details}</Text>
                    </View>
                  </View>
                )}

                {selectedJob.professional_certification_required && (
                  <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                      <Wrench size={18} color="#0D9F70" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-gray-500 text-xs font-pregular">Certification</Text>
                      <Text className="text-gray-800 font-pmedium">Professional certification required</Text>
                    </View>
                  </View>
                )}

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
              {selectedJob.hasProposal ? (
                <View className="flex-row items-center">
                  <TouchableOpacity className="bg-gray-300 py-3.5 rounded-xl flex-1 items-center mr-3" disabled={true}>
                    <Text className="text-gray-700 font-pbold">Proposal Sent</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="bg-red-100 p-3.5 rounded-xl items-center justify-center"
                    onPress={handleDeleteProposal}
                    disabled={deletingProposal}
                  >
                    {deletingProposal ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <Trash2 size={20} color="#ef4444" />
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  className="bg-[#0D9F70] py-3.5 rounded-xl w-full items-center"
                  onPress={handleMakeOffer}
                >
                  <Text className="text-white font-pbold">Make Offer</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    )
  }

  const ImageViewerModal = () => {
    if (!selectedImage) return null

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!selectedImage}
        onRequestClose={() => setSelectedImage(null)}
      >
        <View className="flex-1 bg-black/90 justify-center items-center">
          <TouchableOpacity
            className="absolute top-10 right-6 z-10 p-2 bg-black/50 rounded-full"
            onPress={() => setSelectedImage(null)}
          >
            <X size={24} color="white" />
          </TouchableOpacity>

          <View className="w-full h-3/4 justify-center items-center">
            <Image source={{ uri: selectedImage }} className="w-full h-full" resizeMode="contain" />
          </View>
        </View>
      </Modal>
    )
  }

  const LocationMapModal = () => {
    if (!selectedJob || !showLocationMap) return null

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={showLocationMap}
        onRequestClose={() => setShowLocationMap(false)}
      >
        <View className="flex-1 bg-black/80 justify-center items-center p-4">
          <View className="bg-white w-full rounded-2xl overflow-hidden" style={{ height: "80%" }}>
            <LocationViewer
              address={selectedJob.location_address}
              latitude={selectedJob.location_latitude}
              longitude={selectedJob.location_longitude}
              onClose={() => setShowLocationMap(false)}
            />
          </View>
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
      <ImageViewerModal />
      <LocationMapModal />
      {/* Proposal Modal */}
      {currentUser && (
        <MakeOfflineProposalModal
        job={
          selectedJob
            ? {
                id: selectedJob.id,
                title: selectedJob.title,
                amount: selectedJob.expected_budget ?? 0,
                currency: selectedJob.currency,
                user_id: selectedJob.user_id,
                location: selectedJob.location_address,
                professional_certification_required: selectedJob.professional_certification_required, // <-- add this
              }
            : null
        }
          isVisible={showProposalModal}
          onClose={() => {
            setShowProposalModal(false)
            fetchJobs()
            setSelectedJob(null)
          }}
          userId={currentUser.id}
        />
      )}
    </View>
  )
}

export default ViewOfflineJobs
