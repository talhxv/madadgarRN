"use client"

import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity } from "react-native"
import { MessageCircle } from "lucide-react-native"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { getUnreadMessageCount } from "@/lib/chat-service"
import { useRouter } from "expo-router"

type ChatButtonProps = {
  color?: string
  size?: number
}

const ChatButton = ({ color = "white", size = 24 }: ChatButtonProps) => {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const router = useRouter()

  useEffect(() => {
    if (!user) return

    // Initial fetch of unread count
    fetchUnreadCount()

    // Set up real-time subscription for new messages
    const channel = supabase
      .channel("chat_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          // When a new message is inserted, update the unread count
          fetchUnreadCount()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        () => {
          // When a message is updated (e.g., marked as read), update the unread count
          fetchUnreadCount()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const fetchUnreadCount = async () => {
    if (!user) return

    try {
      const count = await getUnreadMessageCount(user.id)
      setUnreadCount(count)
    } catch (error) {
      console.error("Error fetching unread count:", error)
      setUnreadCount(0)
    }
  }

  const handlePress = () => {
    // Use Expo Router to navigate to the chats screen
    router.push("/chat/chats")
  }

  return (
    <TouchableOpacity onPress={handlePress}>
      <View className="relative">
        <MessageCircle size={size} color={color} />
        {unreadCount > 0 && (
          <View
            className={`absolute -top-1 -right-1 ${
              unreadCount > 9 ? "w-5 h-5" : "w-4 h-4"
            } bg-red-500 rounded-full items-center justify-center`}
          >
            <Text className="text-white text-[10px] font-pbold">{unreadCount > 99 ? "99+" : unreadCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

export default ChatButton
