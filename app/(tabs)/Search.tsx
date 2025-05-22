"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  RefreshControl,
  Modal,
  Animated,
  Image,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native"
import { useRouter } from "expo-router"
import { supabase } from "@/lib/supabase"
import {
  MapPin,
  Search as SearchIcon,
  Calendar,
  Briefcase,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Clock,
  Banknote,
  Star,
  ArrowLeft,
  Sliders,
  Check,
  Upload,
  AlertCircle,
  Info,
} from "lucide-react-native"
import { useAuth } from "@/contexts/AuthContext"
import * as Location from "expo-location"
import { format } from "date-fns"
import Slider from "@react-native-community/slider"
import * as ImagePicker from "expo-image-picker"
import { createChatForProposal } from "@/lib/chat-service"

// Job types based on your schema
type OnlineJob = {
  id: string
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
  category: { name: string } | null
  distance?: number
  user_id: string
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

type OfflineJob = {
  id: string
  title: string
  description: string
  expected_budget: number | null
  currency: string
  status: "open" | "in_progress" | "completed" | "cancelled"
  location_address: string
  location_latitude?: number
  location_longitude?: number
  created_at: string
  category: { name: string } | null
  distance?: number
  user_id: string
  professional_certification_required?: boolean
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

const MAX_DISTANCE = 100 // Maximum distance in km

const Search = ({ navigation }) => {
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [jobType, setJobType] = useState<"all" | "online" | "offline">("all")
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [onlineJobs, setOnlineJobs] = useState<OnlineJob[]>([])
  const [offlineJobs, setOfflineJobs] = useState<OfflineJob[]>([])
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [maxDistance, setMaxDistance] = useState<number>(50) // in km
  const [sortBy, setSortBy] = useState<"recent" | "distance">("recent")
  const [timeFrame, setTimeFrame] = useState<"all" | "today" | "week" | "month">("all")
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<OnlineJob | OfflineJob | null>(null)
  const [modalAnimation] = useState(new Animated.Value(0))
  const [proposalCounts, setProposalCounts] = useState<{ [jobId: string]: number }>({})
  const [categorySearchQuery, setCategorySearchQuery] = useState("")
  const [showCategoryModal, setShowCategoryModal] = useState(false)

  // Proposal modal states
  const [showProposalModal, setShowProposalModal] = useState(false)
  const [proposalText, setProposalText] = useState("")
  const [rate, setRate] = useState("")
  const [hasDoneBefore, setHasDoneBefore] = useState(false)
  const [portfolioImages, setPortfolioImages] = useState<{ uri: string; name: string; type: string }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentType, setPaymentType] = useState<"hourly" | "project">("hourly")

  // Offline proposal specific states
  const [estimatedCost, setEstimatedCost] = useState("")
  const [minimumVisitFee, setMinimumVisitFee] = useState<number | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [userProfile, setUserProfile] = useState<{ minimum_visit_fee: number | null } | null>(null)

  // Skeleton loading array
  const skeletonArray = Array(6).fill(0)

  // First, let's add state to track user proposals
  // Add these to the existing state declarations:

  const [userProposals, setUserProposals] = useState<{ [jobId: string]: { id: string; type: "online" | "offline" } }>(
    {},
  )
  const [deletingProposal, setDeletingProposal] = useState(false)

  useEffect(() => {
    fetchCategories()
    getUserLocation()
    fetchJobs()
    fetchUserProposals() // Add this line
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

  useEffect(() => {
    if (showProposalModal) {
      if (selectedJob && "expected_budget" in selectedJob) {
        // It's an offline job, fetch user profile for minimum visit fee
        fetchUserProfile()
      }

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
  }, [showProposalModal])

  const fetchUserProfile = async () => {
    if (!currentUser) return

    setIsLoadingProfile(true)
    try {
      const { data, error } = await supabase
        .from("extended_profiles")
        .select("minimum_visit_fee")
        .eq("user_id", currentUser.id)
        .single()

      if (error) throw error

      if (data) {
        setUserProfile(data)
        setMinimumVisitFee(data.minimum_visit_fee)
      }
    } catch (error) {
      console.error("Error fetching user profile:", error)
      Alert.alert(
        "Profile Error",
        "Could not load your minimum visit fee. Please make sure you've set it in your profile.",
        [{ text: "OK" }],
      )
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const fetchCategories = async () => {
    try {
      // Fix: Use job_categories table instead of categories
      const { data, error } = await supabase.from("job_categories").select("id, name").order("name")

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  const fetchProposalCounts = async (jobIds: string[]) => {
    if (jobIds.length === 0) return
    const { data, error } = await supabase
      .from("proposals")
      .select("job_id", { count: "exact", head: false })
      .in("job_id", jobIds)
    if (error) {
      console.error("Error fetching proposal counts:", error)
      return
    }
    // Count proposals per job
    const counts: { [jobId: string]: number } = {}
    data.forEach((row) => {
      counts[row.job_id] = (counts[row.job_id] || 0) + 1
    })
    setProposalCounts(counts)
  }

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        console.log("Permission to access location was denied")
        return
      }

      const location = await Location.getCurrentPositionAsync({})
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      })
    } catch (error) {
      console.error("Error getting location:", error)
    }
  }

  const fetchJobs = async () => {
    try {
      setLoading(true)

      // Date filtering
      let dateValue = null
      const now = new Date()
      if (timeFrame === "today") {
        dateValue = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      } else if (timeFrame === "week") {
        dateValue = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      } else if (timeFrame === "month") {
        dateValue = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString()
      }

      // Category filter
      const categoryFilter = selectedCategory ? `.eq.${selectedCategory}` : ""

      // Fetch online jobs if needed
      if (jobType === "all" || jobType === "online") {
        let query = supabase
          .from("jobs")
          .select(`
            id, 
            title, 
            description, 
            payment_type, 
            amount, 
            currency, 
            time_required, 
            time_unit, 
            skill_level, 
            status,
            location_address,
            images,
            created_at,
            user_id,
            category:category_id(name)
          `)
          .eq("status", "open")

        // Apply date filter if set
        if (dateValue) {
          query = query.gte("created_at", dateValue)
        }

        // Apply category filter if set
        if (selectedCategory) {
          query = query.eq("category_id", selectedCategory)
        }

        // Apply search query if set
        if (searchQuery) {
          query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        }

        query = query.order("created_at", { ascending: false })

        const { data, error } = await query
        if (error) throw error

        // Filter out current user's jobs
        const filteredJobs = currentUser ? data.filter((job) => job.user_id !== currentUser.id) : data

        // Get user profiles for jobs
        if (filteredJobs && filteredJobs.length > 0) {
          const userIds = [...new Set(filteredJobs.map((job) => job.user_id))]

          // Fetch profiles
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("*")
            .in("user_id", userIds)

          if (profilesError) throw profilesError

          // Fetch extended profiles
          const { data: extendedProfilesData, error: extendedProfilesError } = await supabase
            .from("extended_profiles")
            .select("*")
            .in("user_id", userIds)

          if (extendedProfilesError) throw extendedProfilesError

          // Add profile data to jobs
          const jobsWithProfiles = filteredJobs.map((job) => {
            const profile = profilesData?.find((p) => p.user_id === job.user_id)
            const extendedProfile = extendedProfilesData?.find((ep) => ep.user_id === job.user_id)

            return {
              ...job,
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
            }
          })

          setOnlineJobs(jobsWithProfiles)

          // Fetch proposal counts
          const jobIds = jobsWithProfiles.map((job) => job.id)
          fetchProposalCounts(jobIds)
        } else {
          setOnlineJobs([])
        }
      }

      // Fetch offline jobs if needed
      if (jobType === "all" || jobType === "offline") {
        let query = supabase
          .from("offline_jobs")
          .select(`
            id, 
            title, 
            description, 
            expected_budget, 
            currency, 
            status,
            location_address,
            location_id,
            created_at,
            user_id,
            professional_certification_required,
            category:category_id(name)
          `)
          .eq("status", "open")

        // Apply date filter if set
        if (dateValue) {
          query = query.gte("created_at", dateValue)
        }

        // Apply category filter if set
        if (selectedCategory) {
          query = query.eq("category_id", selectedCategory)
        }

        // Apply search query if set
        if (searchQuery) {
          query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        }

        query = query.order("created_at", { ascending: false })

        const { data, error } = await query
        if (error) throw error

        // Filter out current user's jobs
        const filteredJobs = currentUser ? data.filter((job) => job.user_id !== currentUser.id) : data

        // Get location coordinates for offline jobs
        if (filteredJobs && filteredJobs.length > 0) {
          const locationIds = filteredJobs.filter((job) => job.location_id).map((job) => job.location_id)

          if (locationIds.length > 0) {
            const { data: locationsData, error: locationsError } = await supabase
              .from("locations")
              .select("id, geom::geometry")
              .in("id", locationIds)

            if (locationsError) throw locationsError

            // Add coordinates to jobs
            const jobsWithCoordinates = filteredJobs.map((job) => {
              const jobLocation = locationsData?.find((loc) => loc.id === job.location_id)
              let latitude = null
              let longitude = null

              if (jobLocation && jobLocation.geom) {
                try {
                  // Parse GeoJSON object
                  if (
                    typeof jobLocation.geom === "object" &&
                    jobLocation.geom.type === "Point" &&
                    Array.isArray(jobLocation.geom.coordinates)
                  ) {
                    longitude = jobLocation.geom.coordinates[0]
                    latitude = jobLocation.geom.coordinates[1]
                  }
                  // Parse POINT(lng lat) string
                  else if (typeof jobLocation.geom === "string" && jobLocation.geom.startsWith("POINT")) {
                    const match = jobLocation.geom.match(/POINT\$$([^ ]+) ([^)]+)\$$/)
                    if (match) {
                      longitude = Number.parseFloat(match[2])
                      latitude = Number.parseFloat(match[1])
                    }
                  }
                  // Handle object format {x, y}
                  else if (typeof jobLocation.geom === "object" && "x" in jobLocation.geom && "y" in jobLocation.geom) {
                    longitude = jobLocation.geom.x
                    latitude = jobLocation.geom.y
                  }
                } catch (e) {
                  console.error(`Error parsing geom for location ${jobLocation.id}:`, e)
                }
              }

              // Log the parsing result for each job
              console.log(`[PARSE] Job ${job.id} geom:`, jobLocation?.geom, "-> lat:", latitude, "lng:", longitude)

              return {
                ...job,
                location_latitude: latitude,
                location_longitude: longitude,
              }
            })

            // Get user profiles for jobs
            const userIds = [...new Set(jobsWithCoordinates.map((job) => job.user_id))]

            // Fetch profiles
            const { data: profilesData, error: profilesError } = await supabase
              .from("profiles")
              .select("*")
              .in("user_id", userIds)

            if (profilesError) throw profilesError

            // Fetch extended profiles
            const { data: extendedProfilesData, error: extendedProfilesError } = await supabase
              .from("extended_profiles")
              .select("*")
              .in("user_id", userIds)

            if (extendedProfilesError) throw extendedProfilesError

            // Add profile data to jobs
            const jobsWithProfiles = jobsWithCoordinates.map((job) => {
              const profile = profilesData?.find((p) => p.user_id === job.user_id)
              const extendedProfile = extendedProfilesData?.find((ep) => ep.user_id === job.user_id)

              return {
                ...job,
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
              }
            })

            setOfflineJobs(jobsWithProfiles)
          } else {
            setOfflineJobs(filteredJobs)
          }
        } else {
          setOfflineJobs([])
        }
      }
    } catch (error) {
      console.error("Error fetching jobs:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Now, let's add a function to fetch user proposals after the fetchJobs function:

  const fetchUserProposals = async () => {
    if (!currentUser) return

    try {
      // Fetch online proposals
      const { data: onlineProposals, error: onlineError } = await supabase
        .from("proposals")
        .select("id, job_id")
        .eq("user_id", currentUser.id)

      if (onlineError) throw onlineError

      // Fetch offline proposals
      const { data: offlineProposals, error: offlineError } = await supabase
        .from("offline_proposals")
        .select("id, offline_job_id")
        .eq("user_id", currentUser.id)

      if (offlineError) throw offlineError

      // Combine into a single object for easy lookup
      const proposals: { [jobId: string]: { id: string; type: "online" | "offline" } } = {}

      onlineProposals?.forEach((proposal) => {
        proposals[proposal.job_id] = { id: proposal.id, type: "online" }
      })

      offlineProposals?.forEach((proposal) => {
        proposals[proposal.offline_job_id] = { id: proposal.id, type: "offline" }
      })

      setUserProposals(proposals)
    } catch (error) {
      console.error("Error fetching user proposals:", error)
    }
  }

  // Now, let's add a function to handle proposal deletion:

  const handleDeleteProposal = async (jobId: string, proposalType: "online" | "offline") => {
    if (!currentUser || !userProposals[jobId]) return

    const proposalId = userProposals[jobId].id

    Alert.alert(
      "Delete Proposal",
      "Are you sure you want to delete your proposal for this job?",
      [
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
              
              if (proposalType === "online") {
                // 1. Fetch the proposal to get portfolio_images
                const { data: proposal, error: fetchError } = await supabase
                  .from("proposals")
                  .select("portfolio_images")
                  .eq("id", proposalId)
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
                  .eq("id", proposalId)
                  .eq("user_id", currentUser.id)
                
                if (error) throw error
              } else {
                // Handle offline proposal deletion
                // 1. Fetch the proposal to get portfolio_images
                const { data: proposal, error: fetchError } = await supabase
                  .from("offline_proposals")
                  .select("portfolio_images")
                  .eq("id", proposalId)
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
                  .from("offline_proposals")
                  .delete()
                  .eq("id", proposalId)
                  .eq("user_id", currentUser.id)
                
                if (error) throw error
              }
              
              // Update local state
              const updatedProposals = { ...userProposals }
              delete updatedProposals[jobId]
              setUserProposals(updatedProposals)
              
              // Update proposal count
              if (proposalCounts[jobId]) {
                setProposalCounts({
                  ...proposalCounts,
                  [jobId]: Math.max(0, proposalCounts[jobId] - 1)
                })
              }
              
              Alert.alert("Success", "Your proposal has been deleted successfully.")
            } catch (error) {
              console.error("Error deleting proposal or images:", error)
              Alert.alert("Error", "Failed to delete your proposal. Please try again.")
            } finally {
              setDeletingProposal(false)
            }
          },
        },
      ]
    )
  }

  // Calculate distance between user and job locations
  const calculateDistances = () => {
    if (!userLocation) return

    // Calculate distance for offline jobs
    const offlineJobsWithDistance = offlineJobs.map((job) => {
      if (job.location_latitude && job.location_longitude) {
        const distance = getDistanceFromLatLonInKm(
          userLocation.latitude,
          userLocation.longitude,
          job.location_latitude,
          job.location_longitude,
        )
        console.log(`[DISTANCE] Job ${job.id}:`, {
          userLat: userLocation.latitude,
          userLng: userLocation.longitude,
          jobLat: job.location_latitude,
          jobLng: job.location_longitude,
          distance,
        })
        return { ...job, distance }
      }
      return job
    })

    setOfflineJobs(offlineJobsWithDistance)
  }

  // Haversine formula to calculate distance between two points
  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371 // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1)
    const dLon = deg2rad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const d = R * c // Distance in km
    return d
  }

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180)
  }

  useEffect(() => {
    calculateDistances()
  }, [userLocation, offlineJobs.length])

  // Also add it to the onRefresh function:

  const onRefresh = () => {
    setRefreshing(true)
    fetchJobs()
    fetchUserProposals() // Add this line
  }

  // Filter jobs by distance
  const filteredOfflineJobs = offlineJobs.filter((job) => {
    if (typeof job.distance !== "number") {
      console.log(`[FILTER] Job ${job.id}: No distance, included`)
      return true
    }
    const included = job.distance <= maxDistance
    console.log(`[FILTER] Job ${job.id}: distance=${job.distance}, maxDistance=${maxDistance}, included=${included}`)
    return included
  })

  // Sort jobs
  const sortedOnlineJobs = [...onlineJobs].sort((a, b) => {
    if (sortBy === "recent") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    return 0 // Online jobs don't have distance
  })

  const sortedOfflineJobs = [...filteredOfflineJobs].sort((a, b) => {
    if (sortBy === "recent") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    } else if (sortBy === "distance") {
      const distA = a.distance || Number.POSITIVE_INFINITY
      const distB = b.distance || Number.POSITIVE_INFINITY
      return distA - distB
    }
    return 0
  })

  const getStatusColor = (status: "open" | "in_progress" | "completed" | "cancelled") => {
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

  const getSkillLevelBadge = (level: "amateur" | "intermediate" | "professional") => {
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

  const renderSkillStars = (level: "amateur" | "intermediate" | "professional") => {
    let count = 1
    if (level === "intermediate") count = 2
    if (level === "professional") count = 3
    return (
      <View style={{ flexDirection: "row", alignItems: "center", marginRight: 4 }}>
        {[...Array(count)].map((_, i) => (
          <Star key={i} size={14} color="#0D9F70" fill="#0D9F70" strokeWidth={1.5} style={{ marginRight: 1 }} />
        ))}
      </View>
    )
  }

  const getUserName = (job: OnlineJob | OfflineJob) => {
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

  const getUserInitials = (job: OnlineJob | OfflineJob) => {
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

  const getUserAvatar = (job: OnlineJob | OfflineJob) => {
    if (!job.user_profile?.user?.avatar_url) return null
    return job.user_profile.user.avatar_url
  }

  // Filter categories based on search
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(categorySearchQuery.toLowerCase()),
  )

  // Proposal functions
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
      const filePath = `proposals/${currentUser?.id}/${image.name}`

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

  const handleSubmitOnlineProposal = async () => {
    if (!selectedJob || !proposalText || !rate || !currentUser) {
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
          job_id: selectedJob.id,
          user_id: currentUser.id,
          proposal_text: proposalText,
          rate: Number.parseFloat(rate),
          payment_type: paymentType,
          has_done_before: hasDoneBefore,
          portfolio_images: imageUrls,
          status: "pending",
          currency: "payment_type" in selectedJob ? selectedJob.currency : "USD",
        })
        .select("id")
        .single()

      if (error) throw error

      if (!proposal || !proposal.id) {
        console.error("Proposal created but no ID returned")
        throw new Error("Proposal created but no ID returned")
      }

      console.log("Proposal created successfully:", proposal)

      // Create a chat for this proposal
      try {
        console.log("Creating chat for proposal:", {
          proposalId: proposal.id,
          jobId: selectedJob.id,
          jobType: "online",
        })

        const chatResult = await createChatForProposal(selectedJob.id, proposal.id, "online", currentUser.id)

        console.log("Chat creation result:", chatResult)

        Alert.alert("Success", "Your proposal has been submitted successfully!", [
          {
            text: "OK",
            onPress: () => {
              setShowProposalModal(false)
              setSelectedJob(null)
            },
          },
        ])
      } catch (chatError) {
        console.error("Error creating chat:", chatError)
        // Still show success for proposal, but mention chat issue
        Alert.alert(
          "Proposal Submitted",
          "Your proposal was submitted, but there was an issue setting up the chat. You may need to refresh the app.",
          [
            {
              text: "OK",
              onPress: () => {
                setShowProposalModal(false)
                setSelectedJob(null)
              },
            },
          ],
        )
      }

      // Reset form
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

  const handleSubmitOfflineProposal = async () => {
    if (!selectedJob || !proposalText || !estimatedCost || !currentUser) {
      Alert.alert("Missing information", "Please fill in all required fields")
      return
    }

    const isOfflineJob = "expected_budget" in selectedJob
    if (!isOfflineJob) {
      Alert.alert("Error", "Selected job is not an offline job")
      return
    }

    const isCertificationRequired = selectedJob.professional_certification_required

    if (isCertificationRequired && portfolioImages.length === 0) {
      Alert.alert("Certification Required", "You must attach your certification as an image to apply for this job.")
      return
    }

    if (!minimumVisitFee) {
      Alert.alert(
        "Missing Minimum Visit Fee",
        "You need to set a minimum visit fee in your profile before submitting offline job proposals.",
        [{ text: "OK" }],
      )
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
          }
        }
      }

      // Calculate the total amount
      const totalAmount = Number(estimatedCost) + (minimumVisitFee || 0)

      // Insert into offline_proposals table
      const { data: proposal, error } = await supabase
        .from("offline_proposals")
        .insert({
          offline_job_id: selectedJob.id,
          user_id: currentUser.id,
          proposal_text: proposalText,
          rate: totalAmount,
          payment_type: "project",
          has_done_before: hasDoneBefore,
          portfolio_images: imageUrls,
          status: "pending",
          currency: selectedJob.currency,
          minimum_visit_fee: minimumVisitFee,
          estimated_cost: Number(estimatedCost),
          total_amount: totalAmount,
        })
        .select("id")
        .single()

      if (error) throw error

      if (!proposal || !proposal.id) {
        console.error("Proposal created but no ID returned")
        throw new Error("Proposal created but no ID returned")
      }

      // Create chat
      try {
        const chatResult = await createChatForProposal(selectedJob.id, proposal.id, "offline", currentUser.id)
        console.log("Chat creation result:", chatResult)
        Alert.alert("Success", "Your offline proposal has been submitted successfully!", [
          {
            text: "OK",
            onPress: () => {
              setShowProposalModal(false)
              setSelectedJob(null)
            },
          },
        ])
      } catch (chatError) {
        console.error("Error creating chat:", chatError)
        Alert.alert(
          "Proposal Submitted",
          "Your proposal was submitted, but there was an issue setting up the chat. You may need to refresh the app.",
          [
            {
              text: "OK",
              onPress: () => {
                setShowProposalModal(false)
                setSelectedJob(null)
              },
            },
          ],
        )
      }

      // Reset form
      setProposalText("")
      setEstimatedCost("")
      setHasDoneBefore(false)
      setPortfolioImages([])
    } catch (error) {
      console.error("Error submitting offline proposal:", error)
      Alert.alert("Error", "Failed to submit your proposal. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const getTotalAmount = () => {
    const baseRate = Number(estimatedCost) || 0
    if (minimumVisitFee) {
      return baseRate + minimumVisitFee
    }
    return baseRate
  }

  const JobCard = ({ job, type }: { job: OnlineJob | OfflineJob; type: "online" | "offline" }) => {
    const isOnline = type === "online"
  const isApplied = !!userProposals[job.id]
    return (
     <TouchableOpacity
      className="bg-white rounded-2xl mb-4 overflow-hidden shadow-sm border border-gray-100"
      style={{
        elevation: 2,
        opacity: isApplied ? 0.5 : 1, // Gray out if applied
      }}
      onPress={() => setSelectedJob(job)}
      activeOpacity={0.7}
      disabled={isApplied} // Optional: disable click if applied
    >
        <View className="p-5">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 mr-3">
              <Text className="text-lg font-semibold text-gray-800">{job.title}</Text>
            </View>
            <View className="flex-row items-center">
              {/* Show proposal count for online jobs */}
              {isOnline && (
                <View className="bg-gray-100 px-3 py-1.5 rounded-full mr-2 flex-row items-center">
                  <Text className="text-xs font-medium text-gray-700">{proposalCounts[job.id] || 0} applied</Text>
                </View>
              )}
              <View className={`px-3 py-1.5 rounded-full ${getStatusColor(job.status as any)}`}>
                <Text className="text-xs text-white font-medium">{isOnline ? "Online" : "Offline"}</Text>
              </View>
              {userProposals[job.id] && (
                <View className="bg-blue-100 px-3 py-1.5 rounded-full ml-2">
                  <Text className="text-xs font-medium text-blue-700">Applied</Text>
                </View>
              )}
            </View>
          </View>

          {isOnline && (job as OnlineJob).skill_level && (
            <View className="flex-row items-center mt-3 flex-wrap">
              <View
                className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${getSkillLevelBadge((job as OnlineJob).skill_level)}`}
              >
                <Text className="text-sm font-medium capitalize flex-row items-center">
                  {(job as OnlineJob).skill_level}
                  {renderSkillStars((job as OnlineJob).skill_level)}
                </Text>
              </View>

              {job.category?.name && (
                <View className="bg-[#E7F7F1] px-3 py-1.5 rounded-full mr-2 mb-2">
                  <Text className="text-sm font-medium text-[#0D9F70]">{job.category.name}</Text>
                </View>
              )}
            </View>
          )}

          {!isOnline && job.category?.name && (
            <View className="flex-row items-center mt-3">
              <View className="bg-[#E7F7F1] px-3 py-1.5 rounded-full">
                <Text className="text-sm font-medium text-[#0D9F70]">{job.category.name}</Text>
              </View>
            </View>
          )}

          <View className="h-px bg-gray-100 my-3" />

          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <Banknote size={16} color="#0D9F70" />
              <Text className="text-gray-800 font-bold ml-1">
                {job.currency}{" "}
                {isOnline ? (job as OnlineJob).amount : (job as OfflineJob).expected_budget || "Negotiable"}
                {isOnline && (
                  <Text className="text-gray-500 font-normal">
                    {" "}
                    • {(job as OnlineJob).payment_type === "hourly" ? "Hourly" : "Project"}
                  </Text>
                )}
              </Text>
            </View>

            {isOnline && (
              <View className="flex-row items-center">
                <Clock size={16} color="#0D9F70" />
                <Text className="text-gray-800 font-medium ml-1">
                  {(job as OnlineJob).time_required} {(job as OnlineJob).time_unit}
                </Text>
              </View>
            )}

            {!isOnline && "distance" in job && job.distance !== undefined && (
              <View className="flex-row items-center">
                <MapPin size={16} color="#0D9F70" />
                <Text className="text-gray-800 font-medium ml-1">{job.distance.toFixed(1)} km</Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center mt-3">
            {getUserAvatar(job) ? (
              <Image source={{ uri: getUserAvatar(job) }} className="w-6 h-6 rounded-full mr-2" />
            ) : (
              <View className="w-6 h-6 rounded-full bg-[#E7F7F1] items-center justify-center mr-2">
                <Text className="text-xs text-[#0D9F70] font-bold">{getUserInitials(job)}</Text>
              </View>
            )}
            <Text className="text-gray-500 text-xs">Posted by {getUserName(job)}</Text>
          </View>

          <View className="flex-row items-center justify-between mt-3">
            <Text className="text-gray-500 text-xs">{format(new Date(job.created_at), "MMM dd, yyyy")}</Text>
            <View className="flex-row items-center">
              <Text className="text-[#0D9F70] font-medium mr-1">Details</Text>
              <ChevronRight size={16} color="#0D9F70" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

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

    const isOnline = "payment_type" in selectedJob

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
                <Text className="text-2xl font-bold text-gray-800 flex-1 mr-2">{selectedJob.title}</Text>
                <TouchableOpacity
                  onPress={() => setSelectedJob(null)}
                  className="p-2 rounded-full bg-gray-100"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View className="flex-row flex-wrap mb-5">
                <View className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${getStatusColor(selectedJob.status as any)}`}>
                  <Text className="text-sm text-white font-medium">{isOnline ? "Online" : "Offline"}</Text>
                </View>

                {selectedJob.category?.name && (
                  <View className="bg-[#E7F7F1] px-3 py-1.5 rounded-full mr-2 mb-2">
                    <Text className="text-sm font-medium text-[#0D9F70]">{selectedJob.category.name}</Text>
                  </View>
                )}

                {isOnline && (
                  <View
                    className={`px-3 py-1.5 rounded-full mb-2 ${getSkillLevelBadge((selectedJob as OnlineJob).skill_level)}`}
                  >
                    <Text className="text-sm font-medium capitalize">
                      {(selectedJob as OnlineJob).skill_level}{" "}
                      {renderSkillStars((selectedJob as OnlineJob).skill_level)}
                    </Text>
                  </View>
                )}
              </View>

              <View className="flex-row items-center mb-4">
                {getUserAvatar(selectedJob) ? (
                  <Image source={{ uri: getUserAvatar(selectedJob) }} className="w-8 h-8 rounded-full mr-2" />
                ) : (
                  <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-2">
                    <Text className="text-sm text-[#0D9F70] font-bold">{getUserInitials(selectedJob)}</Text>
                  </View>
                )}
                <Text className="text-gray-700 font-medium">Posted by {getUserName(selectedJob)}</Text>
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
                <Text className="text-[#0D9F70] mb-2 text-base font-bold">Description</Text>
                <Text className="text-gray-700 leading-5">{selectedJob.description}</Text>
              </View>

              <View className="bg-gray-50 p-4 rounded-2xl mb-6">
                <Text className="text-[#0D9F70] mb-3 text-base font-bold">Job Details</Text>

                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <Banknote size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-500 text-xs">Payment</Text>
                    <Text className="text-gray-800 font-medium">
                      {isOnline
                        ? `${selectedJob.currency} ${(selectedJob as OnlineJob).amount} • ${(selectedJob as OnlineJob).payment_type === "hourly" ? "Hourly rate" : "Project budget"}`
                        : `${selectedJob.currency} ${(selectedJob as OfflineJob).expected_budget || "Negotiable"}`}
                    </Text>
                  </View>
                </View>

                {isOnline && (
                  <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                      <Clock size={18} color="#0D9F70" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-gray-500 text-xs">Time Required</Text>
                      <Text className="text-gray-800 font-medium">
                        {(selectedJob as OnlineJob).time_required} {(selectedJob as OnlineJob).time_unit}
                      </Text>
                    </View>
                  </View>
                )}

                {selectedJob.location_address && (
                  <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                      <MapPin size={18} color="#0D9F70" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-gray-500 text-xs">Location</Text>
                      <Text className="text-gray-800 font-medium">{selectedJob.location_address}</Text>
                    </View>
                  </View>
                )}

                {isOnline && (
                  <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                      <Star size={18} color="#0D9F70" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-gray-500 text-xs">Skill Level</Text>
                      <Text className="text-gray-800 font-medium capitalize">
                        {(selectedJob as OnlineJob).skill_level}{" "}
                        {renderSkillStars((selectedJob as OnlineJob).skill_level)}
                      </Text>
                    </View>
                  </View>
                )}

                {!isOnline && (selectedJob as OfflineJob).professional_certification_required && (
                  <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center">
                      <Info size={18} color="#f59e0b" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-amber-700 font-medium">Professional certification required</Text>
                    </View>
                  </View>
                )}

                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <Calendar size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-500 text-xs">Posted Date</Text>
                    <Text className="text-gray-800 font-medium">
                      {format(new Date(selectedJob.created_at), "MMMM dd, yyyy")}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="h-24" />
            </ScrollView>

            {/* Now, let's update the JobDetailModal to show different buttons based on whether the user has already submitted a proposal:

            // Replace the View at the bottom of the JobDetailModal with this: */}

            <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4">
              {!currentUser ? (
                <TouchableOpacity
                  className="bg-[#0D9F70] py-3.5 rounded-xl w-full items-center"
                  onPress={() => {
                    Alert.alert("Login Required", "Please login to make a proposal")
                  }}
                >
                  <Text className="text-white font-bold">Make Offer</Text>
                </TouchableOpacity>
              ) : userProposals[selectedJob.id] ? (
                <View className="flex-row space-x-3">
                  <TouchableOpacity
                    className="flex-1 bg-red-500 py-3.5 rounded-xl items-center"
                    onPress={() => handleDeleteProposal(selectedJob.id, userProposals[selectedJob.id].type)}
                    disabled={deletingProposal}
                  >
                    {deletingProposal ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text className="text-white font-bold">Delete Proposal</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="flex-1 bg-blue-500 py-3.5 rounded-xl items-center"
                    onPress={() => {
                      setSelectedJob(null)
                      // Navigate to chat if available
                      // This would require additional logic to find the chat ID
                      // For now, just close the modal
                    }}
                  >
                    <Text className="text-white font-bold">View Details</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  className="bg-[#0D9F70] py-3.5 rounded-xl w-full items-center"
                  onPress={() => {
                    // Reset form fields
                    setProposalText("")
                    setRate("")
                    setEstimatedCost("")
                    setHasDoneBefore(false)
                    setPortfolioImages([])

                    // Set payment type for online jobs
                    if ("payment_type" in selectedJob) {
                      setPaymentType(selectedJob.payment_type)
                    }

                    setShowProposalModal(true)
                  }}
                >
                  <Text className="text-white font-bold">Make Offer</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    )
  }

  const OnlineProposalModal = () => {
    if (!selectedJob || !("payment_type" in selectedJob)) return null

    const translateY = modalAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [300, 0],
    })

    const isExceedingBudget = selectedJob ? Number(rate) > selectedJob.amount : false

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={showProposalModal}
        onRequestClose={() => setShowProposalModal(false)}
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

            <View className="flex-row justify-between items-center px-6 py-3 border-b border-gray-100">
              <Text className="text-xl font-bold text-gray-800">Make an Offer</Text>
              <TouchableOpacity
                onPress={() => setShowProposalModal(false)}
                className="p-2 rounded-full bg-gray-100"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
              <View className="mb-4 mt-4">
                <Text className="text-sm font-medium text-gray-500 mb-1">Job</Text>
                <Text className="font-bold text-gray-800">{selectedJob.title}</Text>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Proposal Details</Text>
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
                <Text className="text-sm font-medium text-gray-700 mb-2">Payment Type</Text>
                <View className="flex-row">
                  <TouchableOpacity
                    className={`flex-row items-center mr-6 p-2 rounded-lg ${
                      paymentType === "hourly" ? "bg-[#E7F7F1]" : "bg-transparent"
                    }`}
                    onPress={() => {}}
                    disabled={selectedJob?.payment_type !== "hourly"}
                    style={selectedJob?.payment_type !== "hourly" ? { opacity: 0.5 } : {}}
                  >
                    <View
                      className={`w-5 h-5 rounded-full mr-2 items-center justify-center ${
                        paymentType === "hourly" ? "bg-[#0D9F70]" : "border border-gray-300"
                      }`}
                    >
                      {paymentType === "hourly" && <Check size={12} color="#fff" />}
                    </View>
                    <Text className={`font-medium ${paymentType === "hourly" ? "text-[#0D9F70]" : "text-gray-700"}`}>
                      Hourly Rate
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className={`flex-row items-center p-2 rounded-lg ${
                      paymentType === "project" ? "bg-[#E7F7F1]" : "bg-transparent"
                    }`}
                    onPress={() => {}}
                    disabled={selectedJob?.payment_type !== "project"}
                    style={selectedJob?.payment_type !== "project" ? { opacity: 0.5 } : {}}
                  >
                    <View
                      className={`w-5 h-5 rounded-full mr-2 items-center justify-center ${
                        paymentType === "project" ? "bg-[#0D9F70]" : "border border-gray-300"
                      }`}
                    >
                      {paymentType === "project" && <Check size={12} color="#fff" />}
                    </View>
                    <Text className={`font-medium ${paymentType === "project" ? "text-[#0D9F70]" : "text-gray-700"}`}>
                      Project Rate
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">
                  {paymentType === "hourly" ? "Hourly Rate" : "Project Rate"} ({selectedJob.currency})
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
                      Rate exceeds client's expected budget ({selectedJob.currency} {selectedJob.amount})
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
                  <Text className="font-medium text-gray-700">I have done this type of job before</Text>
                </TouchableOpacity>
              </View>

              <View className="mb-6">
                <Text className="text-sm font-medium text-gray-700 mb-2">
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
                      <Text className="text-xs text-[#0D9F70] mt-1 font-medium">Add Image</Text>
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
                onPress={handleSubmitOnlineProposal}
                disabled={isSubmitting || !proposalText || !rate}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-bold">Send Proposal</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    )
  }

  const OfflineProposalModal = () => {
    if (!selectedJob || !("expected_budget" in selectedJob)) return null

    const translateY = modalAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [300, 0],
    })

    const isExceedingBudget = selectedJob ? Number(estimatedCost) > (selectedJob.expected_budget || 0) : false
    const isCertificationRequired = selectedJob.professional_certification_required

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={showProposalModal}
        onRequestClose={() => setShowProposalModal(false)}
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

            <View className="flex-row justify-between items-center px-6 py-3 border-b border-gray-100">
              <Text className="text-xl font-bold text-gray-800">Make an Offline Offer</Text>
              <TouchableOpacity
                onPress={() => setShowProposalModal(false)}
                className="p-2 rounded-full bg-gray-100"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
              <View className="mb-4 mt-4">
                <Text className="text-sm font-medium text-gray-500 mb-1">Job</Text>
                <Text className="font-bold text-gray-800">{selectedJob.title}</Text>
                <View className="mt-1 flex-row items-center">
                  <View className="px-2 py-1 bg-blue-50 rounded-md self-start">
                    <Text className="text-xs font-medium text-blue-600">Offline Job</Text>
                  </View>
                  {selectedJob.location_address && (
                    <View className="flex-row items-center ml-2">
                      <MapPin size={14} color="#666" />
                      <Text className="text-xs text-gray-600 ml-1">{selectedJob.location_address}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">Proposal Details</Text>
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
                <Text className="text-sm font-medium text-gray-700 mb-2">Estimated Costs ({selectedJob.currency})</Text>
                <TextInput
                  placeholder="Enter your estimated costs"
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-gray-800"
                  keyboardType="numeric"
                  value={estimatedCost}
                  onChangeText={setEstimatedCost}
                />

                {isExceedingBudget && (
                  <View className="flex-row items-center mt-2">
                    <AlertCircle size={16} color="#f59e0b" />
                    <Text className="text-amber-600 text-sm ml-1">
                      Your estimate exceeds the client's budget ({selectedJob.currency} {selectedJob.expected_budget})
                    </Text>
                  </View>
                )}
              </View>

              {isLoadingProfile ? (
                <View className="mb-4 p-4 items-center">
                  <ActivityIndicator color="#0D9F70" size="small" />
                  <Text className="text-gray-600 mt-2">Loading your profile...</Text>
                </View>
              ) : minimumVisitFee !== null ? (
                <View className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <View className="flex-row items-center mb-2">
                    <Info size={16} color="#0D9F70" />
                    <Text className="text-gray-700 font-medium ml-2">Minimum Visit Fee</Text>
                  </View>
                  <Text className="text-gray-600 text-sm">
                    A minimum visit fee of {selectedJob.currency} {minimumVisitFee} will be added to your proposal.
                  </Text>
                  <View className="mt-3 pt-3 border-t border-gray-200">
                    <View className="flex-row justify-between">
                      <Text className="text-gray-600">Estimated Costs:</Text>
                      <Text className="text-gray-600">
                        {selectedJob.currency} {Number(estimatedCost) || 0}
                      </Text>
                    </View>
                    <View className="flex-row justify-between mt-1">
                      <Text className="text-gray-600">Minimum Visit Fee:</Text>
                      <Text className="text-gray-600">
                        {selectedJob.currency} {minimumVisitFee}
                      </Text>
                    </View>
                    <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
                      <Text className="font-bold text-gray-800">Total:</Text>
                      <Text className="font-bold text-gray-800">
                        {selectedJob.currency} {getTotalAmount()}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <View className="flex-row items-center">
                    <AlertCircle size={16} color="#f59e0b" />
                    <Text className="text-amber-700 font-medium ml-2">Missing Minimum Visit Fee</Text>
                  </View>
                  <Text className="text-amber-600 text-sm mt-1">
                    You need to set a minimum visit fee in your profile before submitting offline job proposals.
                  </Text>
                </View>
              )}

              {isCertificationRequired && (
                <View className="mb-2 p-3 bg-blue-50 rounded-xl border border-blue-200 flex-row items-center">
                  <Info size={16} color="#0D9F70" />
                  <Text className="ml-2 text-blue-800 font-medium">
                    Attach your professional certification in the images (mandatory)
                  </Text>
                </View>
              )}

              <View className="mb-4">
                <TouchableOpacity className="flex-row items-center" onPress={() => setHasDoneBefore(!hasDoneBefore)}>
                  <View
                    className={`w-5 h-5 rounded mr-2 items-center justify-center ${
                      hasDoneBefore ? "bg-[#0D9F70]" : "border border-gray-300"
                    }`}
                  >
                    {hasDoneBefore && <Check size={12} color="#fff" />}
                  </View>
                  <Text className="font-medium text-gray-700">I have done this type of job before</Text>
                </TouchableOpacity>
              </View>

              <View className="mb-6">
                <Text className="text-sm font-medium text-gray-700 mb-2">
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
                      <Text className="text-xs text-[#0D9F70] mt-1 font-medium">Add Image</Text>
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
                  isSubmitting || !proposalText || !estimatedCost || minimumVisitFee === null
                    ? "bg-gray-300"
                    : "bg-[#0D9F70]"
                }`}
                onPress={handleSubmitOfflineProposal}
                disabled={isSubmitting || !proposalText || !estimatedCost || minimumVisitFee === null}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-bold">Send Offline Proposal</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    )
  }

  const CategoryModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCategoryModal}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />

            <View className="px-4 py-3 border-b border-gray-100">
              <Text className="text-xl font-bold text-gray-800">Select Category</Text>
            </View>

            <View className="px-4 py-2">
              <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2 mb-3">
                <SearchIcon size={20} color="#6b7280" />
                <TextInput
                  className="flex-1 ml-2 text-gray-800"
                  placeholder="Search categories..."
                  value={categorySearchQuery}
                  onChangeText={setCategorySearchQuery}
                />
                {categorySearchQuery ? (
                  <TouchableOpacity onPress={() => setCategorySearchQuery("")}>
                    <X size={18} color="#6b7280" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <FlatList
              data={[{ id: "all", name: "All Categories" }, ...filteredCategories]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className={`px-4 py-3 border-b border-gray-100 flex-row justify-between items-center ${
                    (item.id === "all" && !selectedCategory) || selectedCategory === item.id ? "bg-[#E7F7F1]" : ""
                  }`}
                  onPress={() => {
                    setSelectedCategory(item.id === "all" ? null : item.id)
                    setShowCategoryModal(false)
                  }}
                >
                  <Text
                    className={`${
                      (item.id === "all" && !selectedCategory) || selectedCategory === item.id
                        ? "text-[#0D9F70] font-medium"
                        : "text-gray-700"
                    }`}
                  >
                    {item.name}
                  </Text>
                  {((item.id === "all" && !selectedCategory) || selectedCategory === item.id) && (
                    <View className="w-5 h-5 rounded-full bg-[#0D9F70] items-center justify-center">
                      <Check size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
            />

            <View className="p-4">
              <TouchableOpacity
                className="bg-[#0D9F70] py-3 rounded-xl items-center"
                onPress={() => setShowCategoryModal(false)}
              >
                <Text className="text-white font-medium">Close</Text>
              </TouchableOpacity>
            </View>
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
      <Text className="text-xl font-bold text-gray-800 mb-2 mt-4">
        {searchQuery ? "No matching jobs found" : "No jobs available"}
      </Text>
      <Text className="text-gray-600 text-center mb-6">
        {searchQuery ? "Try adjusting your search terms or clear the search" : "Check back later for new opportunities"}
      </Text>
      {searchQuery && (
        <TouchableOpacity className="border border-[#0D9F70] py-3 px-6 rounded-xl" onPress={() => setSearchQuery("")}>
          <Text className="text-[#0D9F70] font-medium">Clear Search</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )

  // Instead of always combining both lists in the FlatList, do this before your return:

  let jobsToShow: any[] = []
  if (jobType === "all") {
    jobsToShow = [
      ...sortedOnlineJobs.map((job) => ({ ...job, type: "online" })),
      ...sortedOfflineJobs.map((job) => ({ ...job, type: "offline" })),
    ]
  } else if (jobType === "online") {
    jobsToShow = sortedOnlineJobs.map((job) => ({ ...job, type: "online" }))
  } else if (jobType === "offline") {
    jobsToShow = sortedOfflineJobs.map((job) => ({ ...job, type: "offline" }))
  }

  useEffect(() => {
    fetchJobs()
  }, [jobType, timeFrame, selectedCategory, searchQuery])

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
          <Text className="text-white text-xl font-semibold">Search Jobs</Text>
        </View>

        <View className="mt-4 relative">
          <TextInput
            placeholder="Search jobs..."
            placeholderTextColor="#E7F7F1"
            className="bg-white/10 text-white pl-10 pr-4 py-3 rounded-xl border border-white/20"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={fetchJobs}
          />
          <View className="absolute left-3 top-3">
            <SearchIcon size={20} color="#E7F7F1" />
          </View>
          {searchQuery ? (
            <TouchableOpacity
              className="absolute right-3 top-3"
              onPress={() => {
                setSearchQuery("")
                fetchJobs()
              }}
            >
              <X size={18} color="#E7F7F1" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter options */}
        <View className="flex-row justify-between mt-4">
          <View className="flex-row">
            <TouchableOpacity
              className={`px-3 py-1.5 rounded-full mr-2 ${jobType === "all" ? "bg-white" : "bg-white/20"}`}
              onPress={() => setJobType("all")}
            >
              <Text className={jobType === "all" ? "text-[#0D9F70] font-medium" : "text-white"}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-3 py-1.5 rounded-full mr-2 ${jobType === "online" ? "bg-white" : "bg-white/20"}`}
              onPress={() => setJobType("online")}
            >
              <Text className={jobType === "online" ? "text-[#0D9F70] font-medium" : "text-white"}>Online</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-3 py-1.5 rounded-full ${jobType === "offline" ? "bg-white" : "bg-white/20"}`}
              onPress={() => setJobType("offline")}
            >
              <Text className={jobType === "offline" ? "text-[#0D9F70] font-medium" : "text-white"}>Offline</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity className="flex-row items-center" onPress={() => setShowFilters(!showFilters)}>
            <Sliders size={18} color="white" />
            <Text className="text-white ml-1">Filters</Text>
            {showFilters ? <ChevronUp size={18} color="white" /> : <ChevronDown size={18} color="white" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Expanded filters */}
      {showFilters && (
        <View className="bg-white rounded-2xl mx-4 mt-4 p-4 shadow-sm">
          {/* Time filter */}
          <View className="mb-3">
            <Text className="text-gray-700 font-medium mb-2">Time Frame</Text>
            <View className="flex-row flex-wrap">
              <TouchableOpacity
                className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${timeFrame === "all" ? "bg-[#0D9F70]" : "bg-gray-200"}`}
                onPress={() => setTimeFrame("all")}
              >
                <Text className={timeFrame === "all" ? "text-white font-medium" : "text-gray-700"}>All Time</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${timeFrame === "today" ? "bg-[#0D9F70]" : "bg-gray-200"}`}
                onPress={() => setTimeFrame("today")}
              >
                <Text className={timeFrame === "today" ? "text-white font-medium" : "text-gray-700"}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${timeFrame === "week" ? "bg-[#0D9F70]" : "bg-gray-200"}`}
                onPress={() => setTimeFrame("week")}
              >
                <Text className={timeFrame === "week" ? "text-white font-medium" : "text-gray-700"}>This Week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${timeFrame === "month" ? "bg-[#0D9F70]" : "bg-gray-200"}`}
                onPress={() => setTimeFrame("month")}
              >
                <Text className={timeFrame === "month" ? "text-white font-medium" : "text-gray-700"}>This Month</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Category filter */}
          <View className="mb-3">
            <Text className="text-gray-700 font-medium mb-2">Category</Text>
            <TouchableOpacity
              className="flex-row justify-between items-center bg-gray-100 rounded-lg px-4 py-3"
              onPress={() => setShowCategoryModal(true)}
            >
              <Text className="text-gray-700">
                {selectedCategory
                  ? categories.find((c) => c.id === selectedCategory)?.name || "Select Category"
                  : "All Categories"}
              </Text>
              <ChevronDown size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Distance filter */}
          {jobType === "offline" && (
            <View className="mb-3">
              <Text className="text-gray-700 font-medium mb-2">Max Distance: {maxDistance} km</Text>
              <Slider
                style={{ width: "100%", height: 40 }}
                minimumValue={1}
                maximumValue={MAX_DISTANCE}
                step={1}
                value={maxDistance}
                onValueChange={setMaxDistance}
                minimumTrackTintColor="#0D9F70"
                maximumTrackTintColor="#d3d3d3"
                thumbTintColor="#0D9F70"
              />
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-xs">1 km</Text>
                <Text className="text-gray-500 text-xs">{MAX_DISTANCE} km</Text>
              </View>
            </View>
          )}

          {/* Sort by */}
          <View className="mb-3">
            <Text className="text-gray-700 font-medium mb-2">Sort By</Text>
            <View className="flex-row">
              <TouchableOpacity
                className={`px-3 py-1.5 rounded-full mr-2 ${sortBy === "recent" ? "bg-[#0D9F70]" : "bg-gray-200"}`}
                onPress={() => setSortBy("recent")}
              >
                <Text className={sortBy === "recent" ? "text-white font-medium" : "text-gray-700"}>Recent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-3 py-1.5 rounded-full ${sortBy === "distance" ? "bg-[#0D9F70]" : "bg-gray-200"}`}
                onPress={() => setSortBy("distance")}
              >
                <Text className={sortBy === "distance" ? "text-white font-medium" : "text-gray-700"}>Distance</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Apply button */}
          <TouchableOpacity
            className="bg-[#0D9F70] py-2.5 rounded-xl items-center mt-2"
            onPress={() => {
              setShowFilters(false)
              fetchJobs()
            }}
          >
            <Text className="text-white font-medium">Apply Filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Job list */}
      {loading ? (
        <FlatList
          data={skeletonArray}
          keyExtractor={(_, index) => `skeleton-${index}`}
          renderItem={() => <JobSkeleton />}
          contentContainerStyle={{ padding: 16 }}
        />
      ) : jobsToShow.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={jobsToShow}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={({ item }) => <JobCard job={item} type={item.type} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0D9F70"]} />}
          ListHeaderComponent={() => (
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-semibold text-gray-800">
                {jobType === "all" ? "All Jobs" : jobType === "online" ? "Online Jobs" : "Offline Jobs"}
              </Text>
              <Text className="text-gray-500 text-sm">{jobsToShow.length} results</Text>
            </View>
          )}
        />
      )}

      <JobDetailModal />
      <CategoryModal />
      {selectedJob && "payment_type" in selectedJob ? <OnlineProposalModal /> : <OfflineProposalModal />}
    </View>
  )
}

export default Search
