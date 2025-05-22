"use client"

import { useState, useEffect } from "react"
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { ArrowLeft, MessageSquare, Clock, CheckCircle2, ArrowUpRight, ArrowDownLeft } from "lucide-react-native"
import { format, isToday, isYesterday, isThisYear } from "date-fns"
import { useRouter } from "expo-router"
import { ChatListSkeleton } from "@/components/chats/chat-list-skeleton"
import { Image } from 'expo-image'

type Chat = {
  id: string
  job_id: string | null
  proposal_id: string | null
  offline_job_id?: string | null
  offline_proposal_id?: string | null
  job_owner_id: string
  proposal_owner_id: string
  created_at: string
  is_active: boolean
  job?: { title: string; status?: string } | null
  proposal?: { id: string; status: string; created_at: string } | null
  offline_job?: { title: string; status?: string } | null
  offline_proposal?: { id: string; status: string; created_at: string } | null
  other_user: {
    full_name?: string
    user_id: string
    avatar_url?: string  // Add this property
  }
  last_message?: {
    content: string
    created_at: string
    sender_id: string
    is_system?: boolean
  }
  unread_count: number
}

type TabType = "all" | "active" | "pending"

export default function ChatListScreen() {
  const { user } = useAuth()
  const [chats, setChats] = useState<Chat[]>([])
  const [filteredChats, setFilteredChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>("all")
  const router = useRouter()

  useEffect(() => {
    if (user) {
      fetchChats()
      setupRealtimeSubscription()
    }

    return () => {
      supabase.removeAllChannels()
    }
  }, [user])

  // Apply filters whenever chats or activeTab changes
  useEffect(() => {
    filterChats()
  }, [chats, activeTab])

  const filterChats = () => {
    if (activeTab === "all") {
      setFilteredChats(chats)
    } else if (activeTab === "active") {
      // Only show truly active chats - those with real messages or accepted proposals
      setFilteredChats(
        chats.filter((chat) => {
          // Chat is active if:
          // 1. Proposal is accepted OR
          // 2. Has non-system messages
          return chat.proposal?.status === "accepted" || (chat.last_message && !chat.last_message.is_system)
        }),
      )
    } else if (activeTab === "pending") {
      // Only show pending chats - no real messages and not accepted
      setFilteredChats(
        chats.filter((chat) => {
          // Chat is pending if:
          // 1. Proposal is not accepted AND
          // 2. Either has no messages OR only has system messages
          return chat.proposal?.status !== "accepted" && (!chat.last_message || chat.last_message.is_system)
        }),
      )
    }
  }

  const fetchChats = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Fetch chats where the current user is either the job owner or proposal owner
      const { data, error } = await supabase
        .from("chats")
        .select(`
          *,
          job:job_id(title, status),
          proposal:proposal_id(id, status, created_at),
          offline_job:offline_job_id(title, status),
          offline_proposal:offline_proposal_id(id, status, created_at)
        `)
        .or(`job_owner_id.eq.${user.id},proposal_owner_id.eq.${user.id}`)

      if (error) throw error

      // Debug by logging total chats found initially
      console.log(`Found ${data?.length || 0} chats before filtering`)

      // For each chat, fetch the other user's details
      const enhancedChats = await Promise.all(
        data.map(async (chat) => {
          const otherUserId = chat.job_owner_id === user.id ? chat.proposal_owner_id : chat.job_owner_id

          // Fetch other user's profile with better error handling
          let profileData = null
          try {
            // Use a more direct query without single() which can fail
            const { data: profiles, error: profileError } = await supabase
              .from("profiles")
              .select("full_name, user_id")
              .eq("user_id", otherUserId)

            if (!profileError && profiles && profiles.length > 0) {
              profileData = profiles[0]
              console.log("Found profile for user:", otherUserId, profileData)
              
              // Add this code to fetch the avatar URL
              const { data: extendedProfileData, error: extError } = await supabase
                .from("extended_profiles")
                .select("avatar_url")
                .eq("user_id", otherUserId)
                .single()
                
              if (!extError && extendedProfileData?.avatar_url) {
                // Get the public URL for the avatar
                const { data: publicUrlData } = supabase.storage
                  .from('avatars')
                  .getPublicUrl(extendedProfileData.avatar_url)
                  
                profileData.avatar_url = publicUrlData.publicUrl
              }
            } else {
              console.log("No profile found for user:", otherUserId)
            }
          } catch (profileError) {
            console.log(`Failed to fetch profile for user ${otherUserId}:`, profileError)
          }

          // Fetch last message
          const { data: messages, error: messagesError } = await supabase
            .from("messages")
            .select("content, created_at, sender_id, is_system")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: false })
            .limit(1)

          const lastMessage =
            messages && messages.length > 0
              ? {
                  content: messages[0].content,
                  created_at: messages[0].created_at,
                  sender_id: messages[0].sender_id,
                  is_system: messages[0].is_system,
                }
              : undefined

          // Count unread messages
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("chat_id", chat.id)
            .eq("read", false)
            .neq("sender_id", user.id)

          return {
            ...chat,
            other_user: profileData || {
              full_name: `User ${otherUserId.substring(0, 8)}`,
              user_id: otherUserId,
            },
            last_message: lastMessage,
            unread_count: count || 0,
          }
        }),
      )

      // Filter out chats that should not be visible to the proposal owner
      const visibleChats = enhancedChats.filter((chat) => {
        // Job owners can see all chats
        const isVisible = chat.job_owner_id === user.id || chat.is_active
        if (!isVisible) {
          console.log(`Filtering out chat ${chat.id} - job owner: ${chat.job_owner_id}, is_active: ${chat.is_active}`)
        }
        return isVisible
      })

      // Sort by last message time (or proposal time if no messages)
      const sortedChats = visibleChats.sort((a, b) => {
        const timeA = a.last_message?.created_at || a.proposal?.created_at || a.created_at
        const timeB = b.last_message?.created_at || b.proposal?.created_at || b.created_at
        return new Date(timeB).getTime() - new Date(timeA).getTime()
      })

      setChats(sortedChats)
    } catch (error) {
      console.error("Error fetching chats:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel("chat_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          // Refresh the chat list when new messages arrive
          fetchChats()
        },
      )
      .subscribe()
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchChats()
  }

  const navigateToChat = (chat: Chat) => {
    // Handle online/offline jobs correctly
    const jobId = chat.job_id || chat.offline_job_id
    const proposalId = chat.proposal_id || chat.offline_proposal_id

    // Add debug log
    console.log(`Navigating to chat ${chat.id} with jobId ${jobId} and proposalId ${proposalId}`)

    // Navigate with correct params
    router.push(`/chat/${chat.id}?jobId=${jobId}&proposalId=${proposalId}`)
  }

  const getInitials = (name: string) => {
    if (!name) return "??"
    const nameParts = name.split(" ")
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString)

    if (isToday(date)) {
      return format(date, "h:mm a")
    } else if (isYesterday(date)) {
      return "Yesterday"
    } else if (isThisYear(date)) {
      return format(date, "MMM d")
    } else {
      return format(date, "MM/dd/yyyy")
    }
  }

  const renderChatItem = ({ item }: { item: Chat }) => {
    // Prefer offline_job if present, else job
    const jobTitle = item.offline_job?.title || item.job?.title || "Unknown Job"
    // Prefer offline_proposal if present, else proposal
    const proposalStatus = item.offline_proposal?.status || item.proposal?.status
    const proposalCreatedAt = item.offline_proposal?.created_at || item.proposal?.created_at

    const isJobOwner = user?.id === item.job_owner_id
    const isProposalSender = user?.id === item.proposal_owner_id
    const hasUnread = item.unread_count > 0

    // Determine the exact status of the proposal
    let proposalState = ""
    let statusColor = ""
    let avatarBgColor = ""
    let textColor = ""
    let textColorCode = ""

    if (item.proposal?.status === "accepted") {
      proposalState = "Accepted"
      statusColor = "bg-green-100"
      avatarBgColor = "bg-[#E7F7F1]"
      textColor = "text-green-800"
      textColorCode = "#166534" // green-800
    } else if (isProposalSender) {
      proposalState = "Sent"
      statusColor = "bg-blue-100"
      avatarBgColor = "bg-blue-50"
      textColor = "text-blue-800"
      textColorCode = "#1e40af" // blue-800
    } else if (isJobOwner && !item.last_message) {
      proposalState = "Review"
      statusColor = "bg-yellow-100"
      avatarBgColor = "bg-yellow-50"
      textColor = "text-yellow-800"
      textColorCode = "#854d0e" // yellow-800
    } else if (item.last_message && item.proposal?.status !== "accepted") {
      proposalState = "Discussing"
      statusColor = "bg-purple-100"
      avatarBgColor = "bg-purple-50"
      textColor = "text-purple-800"
      textColorCode = "#6b21a8" // purple-800
    }

    let lastMessageText = "No messages yet"
    let lastMessageTime = ""

    if (item.last_message) {
      lastMessageText = item.last_message.is_system
        ? item.last_message.content
        : `${item.last_message.sender_id === user?.id ? "You: " : ""}${item.last_message.content}`

      lastMessageTime = formatMessageTime(item.last_message.created_at)
    } else if (item.proposal?.created_at) {
      // If no messages, show when the proposal was created
      lastMessageTime = formatMessageTime(item.proposal.created_at)
      if (isProposalSender) {
        lastMessageText = "You submitted a proposal"
      } else {
        lastMessageText = "New proposal awaiting your review"
      }
    }

    const otherUserName = item.other_user?.full_name || `User ${item.other_user.user_id.substring(0, 8)}`

    return (
      <TouchableOpacity
        className={`p-4 border-b border-gray-100 ${hasUnread ? "bg-blue-50" : ""}`}
        onPress={() => navigateToChat(item)}
      >
        <View className="flex-row items-center">
          <View className={`w-12 h-12 rounded-full ${avatarBgColor || "bg-gray-100"} items-center justify-center mr-3 overflow-hidden`}>
            {item.other_user?.avatar_url ? (
              <Image
                source={{ uri: item.other_user.avatar_url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <Text
                className={`${proposalState === "Accepted" ? "text-[#0D9F70]" : textColor || "text-gray-500"} font-pbold`}
              >
                {getInitials(otherUserName)}
              </Text>
            )}
          </View>

          <View className="flex-1">
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-800 font-pbold">{otherUserName}</Text>
              {lastMessageTime && <Text className="text-gray-500 text-xs">{lastMessageTime}</Text>}
            </View>

            <View className="flex-row items-center">
              <Text className="text-gray-500 text-sm" numberOfLines={1}>
                {jobTitle}
              </Text>

              {proposalState && (
                <View className={`ml-2 px-2 py-0.5 rounded-full ${statusColor} flex-row items-center`}>
                  {isProposalSender ? (
                    <ArrowUpRight size={12} color={textColorCode} className="mr-1" />
                  ) : (
                    <ArrowDownLeft size={12} color={textColorCode} className="mr-1" />
                  )}
                  <Text className={`text-xs ${textColor}`}>{proposalState}</Text>
                </View>
              )}
            </View>

            <View className="flex-row justify-between items-center mt-1">
              <Text
                className={`text-sm ${hasUnread ? "text-gray-800 font-pmedium" : "text-gray-500"}`}
                numberOfLines={1}
              >
                {lastMessageText}
              </Text>

              {hasUnread && (
                <View className="bg-[#0D9F70] rounded-full w-6 h-6 items-center justify-center">
                  <Text className="text-white text-xs font-pbold">
                    {item.unread_count > 9 ? "9+" : item.unread_count}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const EmptyState = () => (
    <View className="flex-1 justify-center items-center p-6" style={{ height: "80%" }}>
      <View className="items-center">
        <MessageSquare size={48} color="#ccc" />
        <Text className="text-xl font-pbold text-gray-800 mt-4 mb-2 text-center">No chats yet</Text>
        <Text className="text-gray-600 text-center">
          {activeTab === "all"
            ? "Your conversations will appear here"
            : activeTab === "active"
              ? "You don't have any active conversations yet"
              : "You don't have any pending proposals"}
        </Text>
      </View>
    </View>
  )

  return (
    <View className="flex-1 bg-white">
      {/* Header with rounded bottom corners */}
      <View className="bg-[#0D9F70] pt-12 pb-4 px-4 rounded-b-3xl shadow-md">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-2 rounded-full mr-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-pbold">Messages</Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-200 px-2">
        <TouchableOpacity
          className={`flex-1 py-3 flex-row items-center justify-center ${activeTab === "all" ? "border-b-2 border-[#0D9F70]" : ""}`}
          onPress={() => setActiveTab("all")}
        >
          <MessageSquare size={18} color={activeTab === "all" ? "#0D9F70" : "#6B7280"} className="mr-1" />
          <Text className={`font-pmedium ${activeTab === "all" ? "text-[#0D9F70]" : "text-gray-500"}`}>All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 py-3 flex-row items-center justify-center ${activeTab === "active" ? "border-b-2 border-[#0D9F70]" : ""}`}
          onPress={() => setActiveTab("active")}
        >
          <CheckCircle2 size={18} color={activeTab === "active" ? "#0D9F70" : "#6B7280"} className="mr-1" />
          <Text className={`font-pmedium ${activeTab === "active" ? "text-[#0D9F70]" : "text-gray-500"}`}>Active</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 py-3 flex-row items-center justify-center ${activeTab === "pending" ? "border-b-2 border-[#0D9F70]" : ""}`}
          onPress={() => setActiveTab("pending")}
        >
          <Clock size={18} color={activeTab === "pending" ? "#0D9F70" : "#6B7280"} className="mr-1" />
          <Text className={`font-pmedium ${activeTab === "pending" ? "text-[#0D9F70]" : "text-gray-500"}`}>
            Pending
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ChatListSkeleton />
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          ListEmptyComponent={EmptyState}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0D9F70"]} />}
        />
      )}
    </View>
  )
}
