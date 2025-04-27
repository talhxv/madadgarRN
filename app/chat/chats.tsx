"use client"

import { useState, useEffect } from "react"
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { ArrowLeft, MessageSquare, Clock, CheckCircle2 } from "lucide-react-native"
import { format, isToday, isYesterday, isThisYear } from "date-fns"
import { useRouter } from "expo-router"
import { ChatListSkeleton } from "@/components/chats/chat-list-skeleton"

type Chat = {
  id: string
  job_id: string
  proposal_id: string
  job_owner_id: string
  proposal_owner_id: string
  created_at: string
  is_active: boolean
  job: {
    title: string
  }
  other_user: {
    full_name?: string
    user_id: string
  }
  last_message?: {
    content: string
    created_at: string
    sender_id: string
    is_system?: boolean
  }
  unread_count: number
  proposal?: {
    id: string
    status: string
    created_at: string
  }
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
          job:job_id(title),
          proposal:proposal_id(id, status, created_at)
        `)
        .or(`job_owner_id.eq.${user.id},proposal_owner_id.eq.${user.id}`)

      if (error) throw error

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
        if (chat.job_owner_id === user.id) return true

        // Proposal owners can only see active chats
        return chat.is_active
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
    router.push(`/chat/${chat.id}?jobId=${chat.job_id}&proposalId=${chat.proposal_id}`)
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
    const isJobOwner = user?.id === item.job_owner_id
    const otherUserName = item.other_user?.full_name || "Unknown User"
    const hasUnread = item.unread_count > 0
    const isPending = item.proposal?.status !== "accepted" && (!item.last_message || item.last_message.is_system)

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
      lastMessageText = "New proposal submitted"
    }

    return (
      <TouchableOpacity
        className={`p-4 border-b border-gray-100 ${hasUnread ? "bg-blue-50" : ""}`}
        onPress={() => navigateToChat(item)}
      >
        <View className="flex-row items-center">
          <View
            className={`w-12 h-12 rounded-full ${isPending ? "bg-gray-100" : "bg-[#E7F7F1]"} items-center justify-center mr-3`}
          >
            <Text className={`${isPending ? "text-gray-500" : "text-[#0D9F70]"} font-pbold`}>
              {getInitials(otherUserName)}
            </Text>
          </View>

          <View className="flex-1">
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-800 font-pbold">{otherUserName}</Text>
              {lastMessageTime && <Text className="text-gray-500 text-xs">{lastMessageTime}</Text>}
            </View>

            <View className="flex-row items-center">
              <Text className="text-gray-500 text-sm" numberOfLines={1}>
                {item.job.title}
              </Text>

              {isPending && (
                <View className="ml-2 px-2 py-0.5 bg-yellow-100 rounded-full">
                  <Text className="text-yellow-800 text-xs">Pending</Text>
                </View>
              )}

              {item.proposal?.status === "accepted" && (
                <View className="ml-2 px-2 py-0.5 bg-green-100 rounded-full">
                  <Text className="text-green-800 text-xs">Accepted</Text>
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
