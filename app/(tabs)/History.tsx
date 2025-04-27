"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Animated,
  Alert,
  ScrollView,
  Image,
} from "react-native"
import { router } from "expo-router"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import {
  ArrowLeft,
  Trash2,
  AlertCircle,
  Clock,
  X,
  ChevronRight,
  MapPin,
  Calendar,
  Star,
  Banknote,
  Wrench,
  Users,
} from "lucide-react-native"
import { useAuth } from "@/contexts/AuthContext"

// Job type definition based on your schema
type Job = {
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
  updated_at: string
  category: { name: string } | null
  _count?: {
    proposals: number
  }
}

// Proposal type definition
type Proposal = {
    id: string
    job_id: string
    user_id: string
    proposal_text: string
    rate: number
    payment_type: "hourly" | "project"
    has_done_before: boolean
    portfolio_images: string[]
    status: "pending" | "accepted" | "rejected"
    currency: string
    created_at: string
    updated_at: string
    profile?: {
      full_name: string
    }
    user?: {
      id: string
      email: string
      user_metadata: {
        full_name: string
      }
    }
  }

const History = () => {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [activeJobs, setActiveJobs] = useState<Job[]>([])
  const [inProgressJobs, setInProgressJobs] = useState<Job[]>([])
  const [completedJobs, setCompletedJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [showProposals, setShowProposals] = useState(false)
  const [loading, setLoading] = useState(true)
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const deleteModalAnimation = useRef(new Animated.Value(0)).current
  const detailsModalAnimation = useRef(new Animated.Value(0)).current
  const proposalsModalAnimation = useRef(new Animated.Value(0)).current
  const shimmerAnimation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    console.log("Current user in useEffect:", user)
    if (user) {
      fetchJobs()
    } else {
      setError("User not authenticated")
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (loading) {
      // Create a looping animation for the shimmer effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start()
    } else {
      shimmerAnimation.setValue(0)
    }
  }, [loading])

  useEffect(() => {
    if (deleteModalVisible) {
      Animated.spring(deleteModalAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 7,
      }).start()
    } else {
      Animated.timing(deleteModalAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [deleteModalVisible])

  useEffect(() => {
    if (selectedJob) {
      Animated.spring(detailsModalAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 7,
      }).start()

      if (selectedJob.status === "open") {
        fetchProposals(selectedJob.id)
      }
    } else {
      Animated.timing(detailsModalAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start()
      setShowProposals(false)
    }
  }, [selectedJob])

  useEffect(() => {
    if (showProposals) {
      Animated.spring(proposalsModalAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 7,
      }).start()
    } else {
      Animated.timing(proposalsModalAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [showProposals])

  const fetchJobs = async () => {
    try {
      setLoading(true)

      if (!user) {
        throw new Error("User not authenticated")
      }

      console.log("Fetching jobs for user:", user.id)

      // Fetch jobs for the current user
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          category:category_id(name)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Supabase error fetching jobs:", error)
        throw error
      }

      console.log("Jobs fetched from Supabase:", data)

      // If no data, set empty arrays and return
      if (!data || data.length === 0) {
        console.log("No jobs found for user")
        setActiveJobs([])
        setInProgressJobs([])
        setCompletedJobs([])
        setJobs([])
        setLoading(false)
        return
      }

      const jobsWithData = [...data] // Create a copy to avoid reference issues

      // Get all job IDs
      const jobIds = jobsWithData.map((job) => job.id)
      console.log("Job IDs:", jobIds)

      if (jobIds.length > 0) {
        try {
          // Fetch all proposals for these jobs
          const { data: allProposals, error: proposalsError } = await supabase
            .from("proposals")
            .select("job_id")
            .in("job_id", jobIds)

          console.log("Proposals fetched:", allProposals)

          if (proposalsError) {
            console.error("Error fetching proposals:", proposalsError)
          } else if (allProposals) {
            // Count proposals for each job
            const countMap = {}
            allProposals.forEach((proposal) => {
              countMap[proposal.job_id] = (countMap[proposal.job_id] || 0) + 1
            })

            console.log("Proposal counts:", countMap)

            // Add the counts to the job objects
            jobsWithData.forEach((job) => {
              job._count = {
                proposals: countMap[job.id] || 0,
              }
            })
          }
        } catch (proposalErr) {
          console.error("Error in proposal counting:", proposalErr)
        }
      }

      console.log("Jobs with proposal counts:", jobsWithData)

      // Filter jobs by status
      const active = jobsWithData.filter((job) => job.status === "open")
      const inProgress = jobsWithData.filter((job) => job.status === "in_progress")
      const completed = jobsWithData.filter((job) => job.status === "completed" || job.status === "cancelled")

      console.log("Jobs after filtering:", {
        active: active.length > 0 ? active.map(j => ({id: j.id, status: j.status, title: j.title})) : [],
        inProgress: inProgress.length > 0 ? inProgress.map(j => ({id: j.id, status: j.status, title: j.title})) : [],
        completed: completed.length > 0 ? completed.map(j => ({id: j.id, status: j.status, title: j.title})) : []
      })

      setActiveJobs(active)
      setInProgressJobs(inProgress)
      setCompletedJobs(completed)
      setJobs(jobsWithData)
      setLoading(false)
    } catch (err) {
      console.error("Error fetching jobs:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch jobs")
      setLoading(false)
    }
  }

  const fetchProposals = async (jobId: string) => {
    try {
      setProposalsLoading(true);

      // 1. Fetch proposals for the job
      const { data: proposalsData, error: proposalsError } = await supabase
        .from("proposals")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });

      if (proposalsError) throw proposalsError;
      if (!proposalsData || proposalsData.length === 0) {
        setProposals([]);
        return;
      }

      // 2. Get all user_ids from proposals
      const userIds = proposalsData.map((p) => p.user_id);

      // 3. Fetch profiles for those user_ids
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // 4. Map user_id to profile
      const profileMap = {};
      (profilesData || []).forEach((profile) => {
        profileMap[profile.user_id] = profile;
      });

      // 5. Merge proposals with profile info
      const combinedData = proposalsData.map((proposal) => ({
        ...proposal,
        user: {
          id: proposal.user_id,
          user_metadata: {
            full_name: profileMap[proposal.user_id]?.full_name || "Unknown",
          },
        },
      }));

      setProposals(combinedData);
    } catch (err) {
      console.error("Error fetching proposals:", err);
      Alert.alert("Error", "Failed to load proposals");
    } finally {
      setProposalsLoading(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!jobToDelete) return

    try {
      setDeleteLoading(true)

      const { error } = await supabase
        .from("jobs")
        .delete()
        .eq("id", jobToDelete.id)
        .eq("user_id", user.id)
        .eq("status", "open")

      if (error) throw error

      // Update local state to remove the deleted job
      setJobs(jobs.filter((job) => job.id !== jobToDelete.id))
      setActiveJobs(activeJobs.filter((job) => job.id !== jobToDelete.id))

      // Close modals
      setDeleteModalVisible(false)
      setJobToDelete(null)

      // Show success message
      Alert.alert("Success", "Job deleted successfully")
    } catch (err) {
      console.error("Error deleting job:", err)
      Alert.alert("Error", "Failed to delete job. Please try again.")
    } finally {
      setDeleteLoading(false)
    }
  }

  const initiateDelete = (job: Job) => {
    if (job.status !== "open") {
      Alert.alert("Cannot Delete", "Only jobs with 'Open' status can be deleted.", [{ text: "OK" }])
      return
    }

    setJobToDelete(job)
    setDeleteModalVisible(true)
  }

  const cancelDelete = () => {
    setDeleteModalVisible(false)
    setJobToDelete(null)
  }

  const navigateToChat = async (proposalUserId: string, proposalId: string, jobId: string) => {
    if (!selectedJob) return;

    setSelectedJob(null);
    setShowProposals(false);

    try {
      // Try to fetch the chat by proposal_id (unique)
      const { data: chat, error } = await supabase
        .from("chats")
        .select("*")
        .eq("proposal_id", proposalId)
        .single();

      if (chat) {
        // Chat exists, navigate to it
        router.push(`/chat/${chat.id}`);
      } else {
        // If no chat, create it
        const { data: newChat, error: createError } = await supabase
          .from("chats")
          .insert({
            job_id: jobId,
            proposal_id: proposalId,
            job_owner_id: user.id,
            proposal_owner_id: proposalUserId,
            is_active: true,
          })
          .select()
          .single();

        if (newChat) {
          router.push(`/chat/${newChat.id}`);
        } else {
          Alert.alert("Error", createError?.message || "Could not create chat");
        }
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not open chat");
    }
  };

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

  const getStatusText = (status: Job["status"]) => {
    switch (status) {
      case "open":
        return "Open"
      case "in_progress":
        return "In Progress"
      case "completed":
        return "Completed"
      case "cancelled":
        return "Cancelled"
      default:
        return status.replace("_", " ")
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
    const starColor = "#0D9F70" // Gold color for the stars
    const starSize = 12 // Adjust the size as needed

    const renderStars = (count: number) => (
      <View className="flex-row mt-1">
        {Array.from({ length: count }).map((_, index) => (
          <Star key={index} size={starSize} color={starColor} />
        ))}
      </View>
    )

    switch (level) {
      case "amateur":
        return renderStars(1)
      case "intermediate":
        return renderStars(2)
      case "professional":
        return renderStars(3)
      default:
        return renderStars(1)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toFixed(0)}`
  }

  const JobHistoryItem = ({ job }: { job: Job }) => (
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
            {job.category?.name && (
              <Text className="text-sm font-pregular text-gray-500 mt-1">{job.category.name}</Text>
            )}
          </View>
          <View className={`px-3 py-1.5 rounded-full ${getStatusColor(job.status)}`}>
            <Text className="text-xs text-white font-pmedium">{getStatusText(job.status)}</Text>
          </View>
        </View>

        <View className="h-px bg-gray-100 my-3" />

        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <Banknote size={16} color="#0D9F70" />
            <Text className="text-gray-800 font-pmedium ml-1">
              {job.currency} {job.amount}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Clock size={16} color="#0D9F70" />
            <Text className="text-gray-800 font-pmedium ml-1">
              {job.time_required} {job.time_unit}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between mt-3">
          <View className="flex-row items-center">
            <Text className="text-gray-500 text-xs font-pregular">
              Posted {format(new Date(job.created_at), "MMM dd, yyyy")}
            </Text>

            {job.status === "open" && job._count?.proposals > 0 && (
              <View className="flex-row items-center ml-2 bg-[#E7F7F1] px-2 py-0.5 rounded-full">
                <Users size={12} color="#0D9F70" />
                <Text className="text-[#0D9F70] text-xs font-pmedium ml-1">{job._count.proposals}</Text>
              </View>
            )}
          </View>

          <View className="flex-row">
            {job.status === "open" && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation()
                  initiateDelete(job)
                }}
                className="bg-red-50 p-2 rounded-full mr-2"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            )}

            <View className="bg-[#E7F7F1] p-2 rounded-full flex-row items-center">
              <Text className="text-[#0D9F70] font-pmedium mr-1 text-sm">View</Text>
              <ChevronRight size={16} color="#0D9F70" />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )

  const SkeletonCard = () => {
    const translateX = shimmerAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [-350, 350],
    })

    return (
      <View className="bg-white rounded-2xl mb-4 overflow-hidden shadow-sm border border-gray-100 p-5">
        <View style={{ overflow: "hidden", position: "relative" }}>
          {/* Shimmer effect overlay */}
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(255,255,255,0.5)",
              transform: [{ translateX }],
              zIndex: 10,
            }}
          />

          {/* Title and status */}
          <View className="flex-row justify-between items-start">
            <View className="flex-1 mr-3">
              <View className="h-6 bg-gray-200 rounded-md w-3/4 mb-2" />
              <View className="h-4 bg-gray-200 rounded-md w-1/2" />
            </View>
            <View className="h-6 bg-gray-200 rounded-full w-16" />
          </View>

          <View className="h-px bg-gray-100 my-3" />

          {/* Price and time */}
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <View className="h-5 w-5 bg-gray-200 rounded-full mr-2" />
              <View className="h-5 bg-gray-200 rounded-md w-20" />
            </View>

            <View className="flex-row items-center">
              <View className="h-5 w-5 bg-gray-200 rounded-full mr-2" />
              <View className="h-5 bg-gray-200 rounded-md w-16" />
            </View>
          </View>

          {/* Date and actions */}
          <View className="flex-row items-center justify-between mt-3">
            <View className="h-4 bg-gray-200 rounded-md w-32" />

            <View className="flex-row">
              <View className="h-8 w-8 bg-gray-200 rounded-full mr-2" />
              <View className="h-8 bg-gray-200 rounded-full w-20" />
            </View>
          </View>
        </View>
      </View>
    )
  }

  const JobDetailModal = () => {
    if (!selectedJob) return null

    const translateY = detailsModalAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [300, 0],
    })

    const hasProposals = selectedJob._count?.proposals && selectedJob._count.proposals > 0

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
                  <Text className="text-sm text-white font-pmedium">{getStatusText(selectedJob.status)}</Text>
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

              <View/>
            </ScrollView>

            <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4">
              {selectedJob.status === "open" ? (
                <View className="flex-row space-x-4">
                  <TouchableOpacity
                    className="flex-1 py-3.5 rounded-xl border border-gray-200 items-center"
                    onPress={() => setSelectedJob(null)}
                  >
                    <Text className="text-gray-700 font-pmedium">Close</Text>
                  </TouchableOpacity>

                  {hasProposals ? (
                    <TouchableOpacity
                      className="flex-1 ml-2 py-3.5 rounded-xl bg-[#0D9F70] items-center"
                      onPress={() => setShowProposals(true)}
                    >
                      <Text className="text-white font-pbold">See Proposals ({selectedJob._count.proposals})</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      className="flex-1 ml-2 py-3.5 rounded-xl bg-red-500 items-center"
                      onPress={() => {
                        setSelectedJob(null)
                        initiateDelete(selectedJob)
                      }}
                    >
                      <Text className="text-white font-pbold">Delete Job</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  className="bg-[#0D9F70] py-3.5 rounded-xl w-full items-center"
                  onPress={() => setSelectedJob(null)}
                >
                  <Text className="text-white font-pbold">Close</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    )
  }

  const ProposalsModal = () => {
    if (!selectedJob || !showProposals) return null

    const translateY = proposalsModalAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [300, 0],
    })

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={showProposals}
        onRequestClose={() => setShowProposals(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <Animated.View
            style={{
              transform: [{ translateY }],
              maxHeight: "80%",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: "white",
              overflow: "hidden",
            }}
          >
            <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />

            <View className="px-6 py-2 border-b border-gray-100">
              <View className="flex-row justify-between items-center">
                <Text className="text-xl font-pbold text-gray-800">Proposals</Text>
                <TouchableOpacity
                  onPress={() => setShowProposals(false)}
                  className="p-2 rounded-full bg-gray-100"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            {proposalsLoading ? (
              <View className="p-6 items-center justify-center">
                <ActivityIndicator size="large" color="#0D9F70" />
                <Text className="text-gray-600 mt-4 font-pmedium">Loading proposals...</Text>
              </View>
            ) : proposals.length === 0 ? (
              <View className="p-6 items-center justify-center">
                <Text className="text-gray-800 text-lg font-pbold mb-2">No Proposals Yet</Text>
                <Text className="text-gray-600 text-center font-pregular">
                  No one has submitted a proposal for this job yet.
                </Text>
              </View>
            ) : (
              <FlatList
                data={proposals}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <View className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4 p-4">
                    <View className="flex-row justify-between items-center mb-3">
                      <Text className="font-pbold text-gray-800">{item.user?.user_metadata?.full_name || "User"}</Text>
                      <View
                        className={`px-2 py-1 rounded-full ${
                          item.status === "accepted"
                            ? "bg-green-100 text-green-700"
                            : item.status === "rejected"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        <Text className="text-xs font-pmedium capitalize">{item.status}</Text>
                      </View>
                    </View>

                    <View className="flex-row justify-between items-center mb-3">
                      <View className="flex-row items-center">
                        <Banknote size={14} color="#0D9F70" />
                        <Text className="text-gray-700 font-pmedium ml-1">
                          {item.currency} {item.rate} • {item.payment_type === "hourly" ? "Hourly" : "Fixed"}
                        </Text>
                      </View>

                      <Text className="text-xs text-gray-500">{format(new Date(item.created_at), "MMM dd, yyyy")}</Text>
                    </View>

                    <Text className="text-gray-600 mb-4 font-pregular" numberOfLines={3}>
                      {item.proposal_text}
                    </Text>

                    <TouchableOpacity
                      className="bg-[#0D9F70] py-2.5 rounded-lg items-center"
                      onPress={() => navigateToChat(item.user_id, item.id, item.job_id)}
                    >
                      <Text className="text-white font-pmedium">Go to Proposal</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </Animated.View>
        </View>
      </Modal>
    )
  }

  const DeleteConfirmationModal = () => {
    if (!jobToDelete) return null

    const translateY = deleteModalAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [300, 0],
    })

    return (
      <Modal animationType="fade" transparent={true} visible={deleteModalVisible} onRequestClose={cancelDelete}>
        <View className="flex-1 bg-black/60 justify-center items-center px-5">
          <Animated.View
            style={{
              transform: [{ translateY }],
              width: "100%",
              maxWidth: 340,
              borderRadius: 24,
              backgroundColor: "white",
              overflow: "hidden",
            }}
            className="shadow-xl"
          >
            <View className="p-6">
              <View className="items-center mb-4">
                <View className="w-12 h-12 rounded-full bg-red-100 items-center justify-center mb-3">
                  <AlertCircle size={24} color="#EF4444" />
                </View>
                <Text className="text-xl font-pbold text-gray-800 text-center">Delete Job</Text>
              </View>

              <Text className="text-gray-600 text-center mb-6">
                Are you sure you want to delete "{jobToDelete.title}"? This action cannot be undone.
              </Text>

              <View className="flex-row space-x-3">
                <TouchableOpacity
                  className="flex-1 py-3.5 rounded-xl border border-gray-200 items-center"
                  onPress={cancelDelete}
                >
                  <Text className="text-gray-700 font-pmedium">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 py-3.5 ml-2 rounded-xl bg-red-500 items-center"
                  onPress={handleDeleteJob}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white font-pbold">Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    )
  }

  // Custom tab component
  const CustomTabs = () => {
    const tabs = [
      { key: "active", title: "Active Jobs", data: activeJobs },
      { key: "inProgress", title: "In Progress", data: inProgressJobs },
      { key: "completed", title: "Completed", data: completedJobs },
    ]
  
    const currentTabData = tabs[activeTab].data
  
    return (
      <View className="flex-1">
        {/* Tab headers */}
        <View className="flex-row bg-white border-b border-gray-100">
          {tabs.map((tab, index) => (
            <TouchableOpacity
              key={tab.key}
              className={`flex-1 py-3 px-2 ${activeTab === index ? "border-b-2 border-[#0D9F70]" : ""}`}
              onPress={() => setActiveTab(index)}
            >
              <Text className={`text-center font-pmedium ${activeTab === index ? "text-[#0D9F70]" : "text-gray-600"}`}>
                {tab.title} ({tab.data.length})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
  
        {/* Tab content */}
        <View className="flex-1">
          {currentTabData.length > 0 ? (
            <FlatList
              data={currentTabData}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <JobHistoryItem job={item} />}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View className="flex-1 justify-center items-center p-4">
              <Text className="text-gray-500 font-pmedium">
                {activeTab === 0 
                  ? "No active jobs" 
                  : activeTab === 1 
                    ? "No jobs in progress" 
                    : "No completed jobs"}
              </Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-[#0D9F70] pt-12 pb-6 px-4 rounded-b-3xl shadow-md">
          <View className="flex-row items-center justify-center relative">
            <TouchableOpacity
              onPress={() => router.back()}
              className="absolute left-0 p-2 rounded-full"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft color="white" size={24} />
            </TouchableOpacity>
            <Text className="text-white text-xl font-pbold">Job History</Text>
          </View>
        </View>

        <FlatList
          data={[1, 2, 3, 4, 5]} // Show 5 skeleton cards
          keyExtractor={(item) => item.toString()}
          renderItem={() => <SkeletonCard />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        />
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <Text className="text-red-500 mb-2 font-pmedium">Error loading jobs</Text>
        <Text className="text-gray-600 mb-4 font-pregular">{error}</Text>
        <TouchableOpacity className="bg-[#0D9F70] px-6 py-3 rounded-xl" onPress={fetchJobs}>
          <Text className="text-white font-pmedium">Try Again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  console.log("Rendering with jobs:", jobs)
  console.log("Active tab:", activeTab)
  console.log("Tab data:", activeTab === 0 ? activeJobs : activeTab === 1 ? inProgressJobs : completedJobs)

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-[#0D9F70] pt-12 pb-6 px-4 rounded-b-3xl shadow-md">
        <View className="flex-row items-center justify-center relative">
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute left-0 p-2 rounded-full"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-pbold">Job History</Text>
        </View>
      </View>

      {jobs.length === 0 ? (
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-xl font-pbold text-gray-800 mb-2">No Jobs Found</Text>
          <Text className="text-gray-600 text-center mb-6 pregular">
            You haven't posted any jobs yet. When you do, they'll appear here.
          </Text>
          <TouchableOpacity
            className="bg-[#0D9F70] px-8 py-4 rounded-xl shadow-sm"
            onPress={() => router.push("/create-job")}
          >
            <Text className="text-white font-pbold">Create a Job</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <CustomTabs key={`${activeJobs.length}-${inProgressJobs.length}-${completedJobs.length}`} />
      )}

      <JobDetailModal />
      <ProposalsModal />
      <DeleteConfirmationModal />
    </View>
  )
}

export default History
