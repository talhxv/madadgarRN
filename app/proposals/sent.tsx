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
import {
  X,
  Clock,
  MapPin,
  Calendar,
  ArrowLeft,
  ChevronRight,
  Search,
  Briefcase,
  Star,
  Banknote,
  User,
} from "lucide-react-native"
import { useRouter } from "expo-router"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { format, formatDistanceToNow } from "date-fns"

type ProposalType = {
  id: string
  created_at: string
  status: string
  job_title: string
  job_id: string
  job_type: "online" | "offline"
  payment_type: string
  currency: string
  rate: number
  proposal_text: string
  has_done_before: boolean
  portfolio_images?: string[]
  job_description?: string
  job_category?: string
  job_skill_level?: string
  job_time_required?: number
  job_time_unit?: string
  job_location_address?: string
  job_created_at?: string
  job_status?: string
  job_client_name?: string
  job_client_id?: string
}

export default function ProposalsSent() {
  const router = useRouter()
  const { user } = useAuth()
  const [proposals, setProposals] = useState<ProposalType[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProposal, setSelectedProposal] = useState<ProposalType | null>(null)
  const [modalAnimation] = useState(new Animated.Value(0))
  const [error, setError] = useState<string | null>(null)

  // Skeleton loading array
  const skeletonArray = Array(6).fill(0)

  useEffect(() => {
    if (user) {
      fetchProposals()
    }
  }, [user])

  useEffect(() => {
    if (selectedProposal) {
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
  }, [selectedProposal])

  const fetchProposals = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Fetch online proposals with job details
      const { data: onlineProposals, error: onlineError } = await supabase
        .from("proposals")
        .select(`
          id, 
          created_at, 
          status, 
          payment_type, 
          currency, 
          rate,
          proposal_text,
          has_done_before,
          portfolio_images,
          job_id,
          jobs!inner (
            title,
            description,
            status,
            skill_level,
            time_required,
            time_unit,
            location_address,
            created_at,
            user_id,
            category:category_id(name)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (onlineError) throw onlineError

      // Fetch offline proposals with job details
      const { data: offlineProposals, error: offlineError } = await supabase
        .from("offline_proposals")
        .select(`
          id, 
          created_at, 
          status, 
          payment_type, 
          currency, 
          rate,
          proposal_text,
          has_done_before,
          portfolio_images,
          offline_job_id,
          offline_jobs!inner (
            title,
            description,
            status,
            location_address,
            created_at,
            user_id,
            category:category_id(name)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (offlineError) throw offlineError

      // Get client names for all jobs
      const allUserIds = [
        ...(onlineProposals?.map((p) => p.jobs.user_id) || []),
        ...(offlineProposals?.map((p) => p.offline_jobs.user_id) || []),
      ]

      const { data: clientProfiles, error: clientError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", allUserIds)

      if (clientError) throw clientError

      // Format online proposals
      const formattedOnlineProposals = onlineProposals.map((proposal) => {
        const clientProfile = clientProfiles?.find((p) => p.user_id === proposal.jobs.user_id)

        return {
          id: proposal.id,
          created_at: proposal.created_at,
          status: proposal.status,
          job_title: proposal.jobs.title,
          job_id: proposal.job_id,
          job_type: "online" as const,
          payment_type: proposal.payment_type,
          currency: proposal.currency,
          rate: proposal.rate,
          proposal_text: proposal.proposal_text,
          has_done_before: proposal.has_done_before,
          portfolio_images: proposal.portfolio_images,
          job_description: proposal.jobs.description,
          job_category: proposal.jobs.category?.name,
          job_skill_level: proposal.jobs.skill_level,
          job_time_required: proposal.jobs.time_required,
          job_time_unit: proposal.jobs.time_unit,
          job_location_address: proposal.jobs.location_address,
          job_created_at: proposal.jobs.created_at,
          job_status: proposal.jobs.status,
          job_client_name: clientProfile?.full_name || "Unknown Client",
          job_client_id: proposal.jobs.user_id,
        }
      })

      // Format offline proposals
      const formattedOfflineProposals = offlineProposals.map((proposal) => {
        const clientProfile = clientProfiles?.find((p) => p.user_id === proposal.offline_jobs.user_id)

        return {
          id: proposal.id,
          created_at: proposal.created_at,
          status: proposal.status,
          job_title: proposal.offline_jobs.title,
          job_id: proposal.offline_job_id,
          job_type: "offline" as const,
          payment_type: proposal.payment_type,
          currency: proposal.currency,
          rate: proposal.rate,
          proposal_text: proposal.proposal_text,
          has_done_before: proposal.has_done_before,
          portfolio_images: proposal.portfolio_images,
          job_description: proposal.offline_jobs.description,
          job_category: proposal.offline_jobs.category?.name,
          job_location_address: proposal.offline_jobs.location_address,
          job_created_at: proposal.offline_jobs.created_at,
          job_status: proposal.offline_jobs.status,
          job_client_name: clientProfile?.full_name || "Unknown Client",
          job_client_id: proposal.offline_jobs.user_id,
        }
      })

      // Combine and sort by date
      const allProposals = [...formattedOnlineProposals, ...formattedOfflineProposals].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )

      setProposals(allProposals)
    } catch (err) {
      console.error("Error fetching proposals:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch proposals")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchProposals()
  }

  const filteredProposals = proposals.filter(
    (proposal) =>
      proposal.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.proposal_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.job_category?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-[#0D9F70] text-white"
      case "rejected":
        return "bg-red-500 text-white"
      case "pending":
        return "bg-amber-500 text-white"
      default:
        return "bg-gray-500 text-white"
    }
  }

  const getSkillLevelBadge = (level?: string) => {
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

  const getSkillLevelIcon = (level?: string) => {
    if (!level) return null

    const starColor = "#0D9F70" // Emerald color for the stars
    const starSize = 12 // Adjust the size as needed

    const renderStars = (count: number) => (
      <View className="flex-row mt-1">
        {Array.from({ length: count }).map((_, index) => (
          <Star key={index} size={starSize} color={starColor} fill={starColor} />
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

  const getUserInitials = (name: string) => {
    if (!name || name === "Unknown Client") return "UC"

    const nameParts = name.split(" ")
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const handleProposalPress = (proposal: ProposalType) => {
    setSelectedProposal(proposal)
  }

  const ProposalCard = ({ proposal }: { proposal: ProposalType }) => (
    <TouchableOpacity
      className="bg-white rounded-2xl mb-4 overflow-hidden shadow-sm border border-gray-100"
      style={{ elevation: 2 }}
      onPress={() => handleProposalPress(proposal)}
      activeOpacity={0.7}
    >
      <View className="p-5">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-3">
            <Text className="text-lg font-pbold text-gray-800">{proposal.job_title}</Text>
          </View>
          <View className={`px-3 py-1.5 rounded-full ${getStatusColor(proposal.status)}`}>
            <Text className="text-xs text-white font-pmedium capitalize">{proposal.status}</Text>
          </View>
        </View>

        <View className="flex-row items-center mt-3 flex-wrap">
          {proposal.job_category && (
            <View className="bg-[#E7F7F1] px-3 py-1.5 rounded-full mr-2 mb-2">
              <Text className="text-sm font-pmedium text-[#0D9F70]">{proposal.job_category}</Text>
            </View>
          )}

          {proposal.job_skill_level && (
            <View className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${getSkillLevelBadge(proposal.job_skill_level)}`}>
              <Text className="text-sm font-pmedium capitalize">
                {proposal.job_skill_level} {getSkillLevelIcon(proposal.job_skill_level)}
              </Text>
            </View>
          )}

          <View className="bg-gray-100 px-3 py-1.5 rounded-full mb-2">
            <Text className="text-sm font-pmedium text-gray-700 capitalize">{proposal.job_type} Job</Text>
          </View>
        </View>

        <View className="h-px bg-gray-100 my-3" />

        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <Banknote size={16} color="#0D9F70" />
            <Text className="text-gray-800 font-pbold ml-1">
              {proposal.currency} {proposal.rate}
              <Text className="text-gray-500 font-pregular">
                {" "}
                • {proposal.payment_type === "hourly" ? "Hourly" : "Fixed"}
              </Text>
            </Text>
          </View>

          <View className="flex-row items-center">
            <Clock size={16} color="#0D9F70" />
            <Text className="text-gray-800 font-pmedium ml-1">
              {formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true })}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center mt-3">
          <View className="w-6 h-6 rounded-full bg-[#E7F7F1] items-center justify-center mr-2">
            <Text className="text-xs text-[#0D9F70] font-pbold">{getUserInitials(proposal.job_client_name)}</Text>
          </View>
          <Text className="text-gray-500 text-xs font-pregular">Client: {proposal.job_client_name}</Text>
        </View>

        <View className="flex-row items-center justify-between mt-3">
          <Text className="text-gray-500 text-xs font-pregular">
            {format(new Date(proposal.created_at), "MMM dd, yyyy")}
          </Text>
          <View className="flex-row items-center">
            <Text className="text-[#0D9F70] font-pmedium mr-1">Details</Text>
            <ChevronRight size={16} color="#0D9F70" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )

  const ProposalSkeleton = () => (
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

  const ProposalDetailModal = () => {
    if (!selectedProposal) return null

    const translateY = modalAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [300, 0],
    })

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!selectedProposal}
        onRequestClose={() => setSelectedProposal(null)}
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
                <Text className="text-2xl font-pbold text-gray-800 flex-1 mr-2">{selectedProposal.job_title}</Text>
                <TouchableOpacity
                  onPress={() => setSelectedProposal(null)}
                  className="p-2 rounded-full bg-gray-100"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View className="flex-row flex-wrap mb-5">
                <View className={`px-3 py-1.5 rounded-full mr-2 mb-2 ${getStatusColor(selectedProposal.status)}`}>
                  <Text className="text-sm text-white font-pmedium capitalize">{selectedProposal.status}</Text>
                </View>

                {selectedProposal.job_category && (
                  <View className="bg-[#E7F7F1] px-3 py-1.5 rounded-full mr-2 mb-2">
                    <Text className="text-sm font-pmedium text-[#0D9F70]">{selectedProposal.job_category}</Text>
                  </View>
                )}

                {selectedProposal.job_skill_level && (
                  <View
                    className={`px-3 py-1.5 rounded-full mb-2 ${getSkillLevelBadge(selectedProposal.job_skill_level)}`}
                  >
                    <Text className="text-sm font-pmedium capitalize">
                      {selectedProposal.job_skill_level} {getSkillLevelIcon(selectedProposal.job_skill_level)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Client Info */}
              <View className="flex-row items-center mb-4 bg-gray-50 p-3 rounded-lg">
                <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                  <User size={20} color="#0D9F70" />
                </View>
                <View className="ml-3">
                  <Text className="text-gray-500 text-xs font-pregular">Client</Text>
                  <Text className="text-gray-800 font-pmedium">{selectedProposal.job_client_name}</Text>
                </View>
              </View>

              <View className="bg-gray-50 p-4 rounded-2xl mb-6">
                <Text className="text-[#0D9F70] mb-2 text-base font-pbold">Your Proposal</Text>
                <Text className="text-gray-700 font-pregular leading-5">{selectedProposal.proposal_text}</Text>

                <View className="mt-4 flex-row items-center">
                  <Text className="text-gray-700 font-pmedium">
                    {selectedProposal.has_done_before
                      ? "You've done similar work before"
                      : "First time doing this type of work"}
                  </Text>
                </View>
              </View>

              {selectedProposal.portfolio_images && selectedProposal.portfolio_images.length > 0 && (
                <View className="mb-6">
                  <Text className="text-[#0D9F70] mb-2 text-base font-pbold">Portfolio Images</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-1">
                    {selectedProposal.portfolio_images.map((imageUrl, index) => (
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
                <Text className="text-[#0D9F70] mb-2 text-base font-pbold">Job Description</Text>
                <Text className="text-gray-700 font-pregular leading-5">{selectedProposal.job_description}</Text>
              </View>

              <View className="bg-gray-50 p-4 rounded-2xl mb-6">
                <Text className="text-[#0D9F70] mb-3 text-base font-pbold">Job Details</Text>

                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <Banknote size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-500 text-xs font-pregular">Your Bid</Text>
                    <Text className="text-gray-800 font-pmedium">
                      {formatCurrency(selectedProposal.rate, selectedProposal.currency)} •{" "}
                      {selectedProposal.payment_type === "hourly" ? "Hourly rate" : "Fixed price"}
                    </Text>
                  </View>
                </View>

                {selectedProposal.job_time_required && selectedProposal.job_time_unit && (
                  <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                      <Clock size={18} color="#0D9F70" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-gray-500 text-xs font-pregular">Time Required</Text>
                      <Text className="text-gray-800 font-pmedium">
                        {selectedProposal.job_time_required} {selectedProposal.job_time_unit}
                      </Text>
                    </View>
                  </View>
                )}

                {selectedProposal.job_location_address && (
                  <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                      <MapPin size={18} color="#0D9F70" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-gray-500 text-xs font-pregular">Location</Text>
                      <Text className="text-gray-800 font-pmedium">{selectedProposal.job_location_address}</Text>
                    </View>
                  </View>
                )}

                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <Calendar size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-500 text-xs font-pregular">Proposal Sent</Text>
                    <Text className="text-gray-800 font-pmedium">
                      {format(new Date(selectedProposal.created_at), "MMMM dd, yyyy")}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="h-24" />
            </ScrollView>

            <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4">
              <TouchableOpacity
                className="bg-[#0D9F70] py-3.5 rounded-xl w-full items-center"
                onPress={() => {
                  setSelectedProposal(null)
                  if (selectedProposal.job_type === "online") {
                    router.push(`/jobs/${selectedProposal.job_id}`)
                  } else {
                    router.push(`/offline-jobs/${selectedProposal.job_id}`)
                  }
                }}
              >
                <Text className="text-white font-pbold">View Job</Text>
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
        {searchQuery ? "No matching proposals found" : "No proposals sent yet"}
      </Text>
      <Text className="text-gray-600 text-center mb-6 font-pregular">
        {searchQuery
          ? "Try adjusting your search terms or clear the search"
          : "Start applying to jobs to see your proposals here"}
      </Text>
      {searchQuery ? (
        <TouchableOpacity className="border border-[#0D9F70] py-3 px-6 rounded-xl" onPress={() => setSearchQuery("")}>
          <Text className="text-[#0D9F70] font-pmedium">Clear Search</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity className="bg-[#0D9F70] py-3 px-6 rounded-xl" onPress={() => router.push("/jobs")}>
          <Text className="text-white font-pmedium">Browse Jobs</Text>
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
            onPress={() => router.back()}
            className="absolute left-0 p-2 rounded-full"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-psemibold">Proposals Sent</Text>
        </View>

        <View className="mt-4 relative">
          <TextInput
            placeholder="Search proposals..."
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
          renderItem={() => <ProposalSkeleton />}
          contentContainerStyle={{ padding: 16 }}
        />
      ) : error ? (
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-red-500 mb-2 font-pmedium">Error loading proposals</Text>
          <Text className="text-gray-600 mb-4 font-pregular">{error}</Text>
          <TouchableOpacity className="bg-[#0D9F70] px-6 py-3 rounded-xl" onPress={fetchProposals}>
            <Text className="text-white font-pmedium">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : filteredProposals.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={filteredProposals}
          keyExtractor={(item) => `${item.job_type}-${item.id}`}
          renderItem={({ item }) => <ProposalCard proposal={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0D9F70"]} />}
        />
      )}

      <ProposalDetailModal />
    </View>
  )
}
