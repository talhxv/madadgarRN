"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import {
  ArrowLeft,
  Send,
  Info,
  MessageCircle,
  Clock,
  CheckCircle,
  Calendar,
  Camera,
  Paperclip,
  X,
  DollarSign,
} from "lucide-react-native"
import { format } from "date-fns"
import { ProposalDetails } from "@/components/chats/proposal-details"
import { ChatScreenSkeleton } from "@/components/chats/chat-screen-skeleton"
import { createChatForProposal, markMessagesAsRead, sendMessage, uploadChatMedia } from "@/lib/chat-service"
import { JobDetails } from "@/components/chats/job-details"
import { AgreementModal } from "@/components/chats/agreement-modal"
import { MilestonesModal } from "@/components/chats/milestones-modal"
import * as ImagePicker from "expo-image-picker"

export default function ChatScreen() {
  const params = useLocalSearchParams()
  const chatId = params.id as string
  const jobId = params.jobId as string
  const proposalId = params.proposalId as string

  const router = useRouter()
  const { user } = useAuth()

  const [showAgreementModal, setShowAgreementModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [chat, setChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageText, setMessageText] = useState("")
  const [otherUser, setOtherUser] = useState({
    full_name: "Chat",
    user_id: null,
  })
  const [proposal, setProposal] = useState(null)
  const [job, setJob] = useState(null)
  const [showProposalDetails, setShowProposalDetails] = useState(false)
  const [showJobDetails, setShowJobDetails] = useState(false)
  const [isStartingChat, setIsStartingChat] = useState(false)
  const [isAcceptingProposal, setIsAcceptingProposal] = useState(false)
  const [canSendMessages, setCanSendMessages] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)
  const [agreementExists, setAgreementExists] = useState(false)
  const [activityLogs, setActivityLogs] = useState([])
  const [isMediaPickerVisible, setIsMediaPickerVisible] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [jobStarted, setJobStarted] = useState(false)
  const [showMilestonesModal, setShowMilestonesModal] = useState(false)
  const [agreement, setAgreement] = useState(null)
  const [showDebugInfo, setShowDebugInfo] = useState(false)

  const flatListRef = useRef(null)
  const subscription = useRef(null)

  useEffect(() => {
    console.log("ChatScreen mounted with params:", { chatId, jobId, proposalId })

    if (user) {
      if (chatId) {
        fetchChatData()
        setupMessagesSubscription()
        if (chatId) {
          markMessagesAsRead(chatId, user.id).catch((err) => console.error("Error marking messages as read:", err))
        }
      } else if (jobId && proposalId) {
        findOrCreateChat()
      }
    }

    return () => {
      if (subscription.current) {
        supabase.removeChannel(subscription.current)
      }
    }
  }, [chatId, jobId, proposalId, user])

  useEffect(() => {
    if (!chatId || !user) return

    const checkSubscription = setInterval(() => {
      if (!subscription.current) {
        console.log("Subscription not found, reconnecting...")
        setupMessagesSubscription()
      }
    }, 30000)

    return () => clearInterval(checkSubscription)
  }, [chatId, user])

  useEffect(() => {
    if (proposal?.status === "accepted" && agreementExists) {
      if (chat && chat.agreement_start_date) {
        const startDate = new Date(chat.agreement_start_date)
        const now = new Date()
        setJobStarted(now >= startDate)
      }
    }
  }, [proposal, agreementExists, chat])

  const findOrCreateChat = async () => {
    try {
      setLoading(true)
      console.log("Finding or creating chat for job:", jobId, "and proposal:", proposalId)

      if (!user) {
        Alert.alert("Error", "You must be logged in to view this chat")
        router.back()
        return
      }

      const newChat = await createChatForProposal(jobId, proposalId, user.id)

      if (newChat) {
        console.log("Chat found or created:", newChat)

        // Check if user is job owner
        const isJobOwner = user.id === newChat.job_owner_id

        // Set initial chat state
        if (isJobOwner) {
          console.log("User is job owner - should see Start Chat button")
          setChatStarted(false)
          setCanSendMessages(false)
        } else {
          console.log("User is proposal owner - waiting for job owner to start chat")
          setChatStarted(false)
          setCanSendMessages(false)
        }

        router.replace(`/chat/${newChat.id}?jobId=${jobId}&proposalId=${proposalId}`)
        fetchChatData(newChat.id)
        setupMessagesSubscription(newChat.id)
      } else {
        console.error("Failed to create or find chat")
        Alert.alert("Error", "Could not create or find the chat. Please try again later.", [
          { text: "OK", onPress: () => router.back() },
        ])
        setLoading(false)
      }
    } catch (error) {
      console.error("Error in findOrCreateChat:", error)
      Alert.alert("Error", "An error occurred while setting up the chat. Please try again later.", [
        { text: "OK", onPress: () => router.back() },
      ])
      setLoading(false)
    }
  }

  const fetchChatData = async (id = chatId) => {
    try {
      setLoading(true)

      const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .select(`
    *,
    job:job_id(
      id, user_id, title, description, images, payment_type, amount, currency, time_required, time_unit, skill_level, location_address, required_skills, status
    ),
    offline_job:offline_job_id(
      id, user_id, category_id, title, description, images, availability_type, preferred_start_date, preferred_end_date, location_id, location_address, location_details, expected_budget, currency, professional_certification_required, status, created_at, updated_at
    )
  `)
        .eq("id", id)
        .single()

      if (chatError) {
        console.error("Error fetching chat:", chatError)
        setLoading(false)
        return
      }

      setChat(chatData)
      setJob(chatData.offline_job || chatData.job)

      let proposalData = null
      let proposalError = null

      if (chatData.offline_proposal_id) {
        const { data, error } = await supabase
          .from("offline_proposals")
          .select("*")
          .eq("id", chatData.offline_proposal_id)
          .single()
        proposalData = data
        proposalError = error
      } else if (chatData.proposal_id) {
        const { data, error } = await supabase.from("proposals").select("*").eq("id", chatData.proposal_id).single()
        proposalData = data
        proposalError = error
      }

      if (proposalError) {
        console.error("Error fetching proposal:", proposalError)
        if (chatData) {
          setProposal({
            id: chatData.proposal_id,
            status: "pending",
            currency: "$",
            rate: "TBD",
            payment_type: "hourly",
            proposal_text: "Proposal details unavailable",
          })
        }
      } else {
        setProposal(proposalData)

        if (proposalData) {
          const { data: proposerData } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", proposalData.user_id)
            .single()

          if (proposerData) {
            setProposal({
              ...proposalData,
              proposer_name: proposerData.full_name,
            })
          }
        }
      }

      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", id)
        .order("created_at", { ascending: true })

      if (messagesError) {
        console.error("Error fetching messages:", messagesError)
      } else {
        setMessages(messagesData || [])
        console.log("Fetched messages:", messagesData.length, messagesData)

        // Update how chatStarted is determined - ONLY count non-system messages
        const nonSystemMessages = messagesData.filter((msg) => !msg.is_system) || []
        const hasRealMessages = nonSystemMessages.length > 0

        console.log("Non-system messages:", nonSystemMessages.length, "Has real messages:", hasRealMessages)

        // For the job owner, we want to show the Start Chat button if there are NO REAL messages
        // For proposal owner, we need to wait until the job owner has started the chat
        if (user.id === chatData.job_owner_id) {
          const isJobOwner = true
          // Job owner should see "Start Chat" button if there are no real messages
          setChatStarted(hasRealMessages)
          // Job owner can always send messages after clicking Start Chat
          setCanSendMessages(hasRealMessages)

          // Add this debug log
          console.log("Job owner chat state:", {
            isJobOwner,
            hasRealMessages,
            chatStarted: hasRealMessages,
            canSendMessages: hasRealMessages,
          })
        } else {
          // Proposal owner needs to wait until there are real messages
          setChatStarted(hasRealMessages)
          setCanSendMessages(hasRealMessages)

          console.log("Proposal owner chat state:", {
            isJobOwner: false,
            hasRealMessages,
            chatStarted: hasRealMessages,
            canSendMessages: hasRealMessages,
          })
        }
      }

      const otherUserIdToFetch = chatData.job_owner_id === user.id ? chatData.proposal_owner_id : chatData.job_owner_id

      console.log("Fetching profile for user:", otherUserIdToFetch)

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, user_id")
        .eq("user_id", otherUserIdToFetch)

      if (profileError) {
        console.error("Error fetching profile:", profileError)
      } else if (profileData && profileData.length > 0) {
        setOtherUser({
          full_name: profileData[0].full_name || `User ${otherUserIdToFetch.substring(0, 4)}`,
          user_id: otherUserIdToFetch,
        })
        console.log("Found profile:", profileData[0])
      } else {
        setOtherUser({
          full_name: `User ${otherUserIdToFetch.substring(0, 4)}`,
          user_id: otherUserIdToFetch,
        })
        console.log("No profile found for user:", otherUserIdToFetch)
      }

      try {
        const { data: agreementData, error: agreementError } = await supabase
          .from("proposal_agreements")
          .select("*")
          .eq("proposal_id", proposalId || chatData.proposal_id || chatData.offline_proposal_id)
          .eq("job_id", jobId || chatData.job_id || chatData.offline_job_id)
          .eq("chat_id", id)
          .single()

        if (!agreementError && agreementData) {
          setAgreementExists(true)
          setAgreement(agreementData)
        } else {
          setAgreementExists(false)
          setAgreement(null)
        }
      } catch (error) {
        console.error("Error checking for agreement:", error)
      }

      try {
        const { data: logsData, error: logsError } = await supabase
          .from("chat_activity_logs")
          .select("*")
          .eq("chat_id", id)
          .order("created_at", { ascending: true })

        if (!logsError && logsData) {
          setActivityLogs(logsData)
        } else {
          const defaultLogs = []
          if (proposalData) {
            defaultLogs.push({
              id: `default-1`,
              chat_id: id,
              user_id: proposalData.user_id,
              action_type: "proposal_sent",
              details: "Sent proposal",
              created_at: proposalData.created_at,
            })

            if (proposalData.status === "accepted") {
              defaultLogs.push({
                id: `default-2`,
                chat_id: id,
                user_id: chatData.job_owner_id,
                action_type: "proposal_accepted",
                details: "Accepted proposal",
                created_at: proposalData.updated_at,
              })
            } else if (proposalData.status === "rejected") {
              defaultLogs.push({
                id: `default-3`,
                chat_id: id,
                user_id: chatData.job_owner_id,
                action_type: "proposal_rejected",
                details: "Rejected proposal",
                created_at: proposalData.updated_at,
              })
            }
          }
          setActivityLogs(defaultLogs)
        }
      } catch (error) {
        console.error("Error fetching activity logs:", error)
      }
    } catch (error) {
      console.error("Error in fetchChatData:", error)
    } finally {
      setLoading(false)
    }
  }

  const setupMessagesSubscription = (id = chatId) => {
    try {
      console.log("Setting up real-time subscription for chat:", id)

      subscription.current = supabase
        .channel(`chat:${id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${id}`,
          },
          (payload) => {
            console.log("Real-time update received:", payload)

            setMessages((currentMessages) => {
              if (payload.new.sender_id === user.id && !payload.new.is_system) {
                return currentMessages.map((msg) =>
                  msg.id.toString().startsWith("temp-") && msg.content === payload.new.content ? payload.new : msg,
                )
              } else {
                return [...currentMessages, payload.new]
              }
            })

            console.log("Updated messages state with real-time data")

            // Only update chat state if it's a real message, not a system message
            if (!chatStarted && !payload.new.is_system) {
              setChatStarted(true)
              setCanSendMessages(true)
            }

            if (payload.new.sender_id !== user.id) {
              markMessagesAsRead(id, user.id).catch((err) => console.error("Error marking messages as read:", err))
            }

            setTimeout(() => scrollToBottom(), 100)
          },
        )
        .subscribe((status) => {
          console.log("Subscription status:", status)
        })

      console.log("Message subscription set up for chat:", id)
    } catch (error) {
      console.error("Error setting up subscription:", error)
      Alert.alert(
        "Connection Error",
        "Could not establish real-time connection. Messages may not update automatically.",
        [{ text: "OK" }],
      )
    }
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant permission to access your media library")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    })

    if (!result.canceled) {
      setSelectedMedia({
        uri: result.assets[0].uri,
        base64: result.assets[0].base64,
        type: "image",
      })
    }
  }

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()

    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant permission to access your camera")
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    })

    if (!result.canceled) {
      setSelectedMedia({
        uri: result.assets[0].uri,
        base64: result.assets[0].base64,
        type: "image",
      })
    }
  }

  const uploadMedia = async () => {
    if (!selectedMedia || !selectedMedia.base64) {
      return null
    }

    const fileExt = selectedMedia.uri.split(".").pop()
    return await uploadChatMedia(chatId, user.id, selectedMedia.base64, fileExt)
  }

  const sendMessageWithMedia = async (chatId, senderId, content, mediaUrl = null, mediaType = null) => {
    try {
      const messageData = {
        chat_id: chatId,
        sender_id: senderId,
        content: content,
        media_url: mediaUrl,
        media_type: mediaType,
        created_at: new Date(),
        read: false,
      }

      const { data, error } = await supabase.from("messages").insert(messageData).select().single()

      if (error) throw error
      return data
    } catch (error) {
      console.error("Error in sendMessageWithMedia:", error)
      return null
    }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() && !selectedMedia) return
    if (!chatId || !canSendMessages) return

    try {
      setSendingMessage(true)
      let mediaUrl = null

      if (selectedMedia) {
        setUploadingMedia(true)
        mediaUrl = await uploadMedia()
        if (!mediaUrl) {
          Alert.alert("Error", "Failed to upload media. Please try again.")
          setUploadingMedia(false)
          setSendingMessage(false)
          return
        }
        setUploadingMedia(false)
      }

      const tempMessage = {
        id: `temp-${Date.now()}`,
        chat_id: chatId,
        sender_id: user.id,
        content: messageText.trim(),
        media_url: mediaUrl,
        media_type: selectedMedia ? "image" : null,
        created_at: new Date().toISOString(),
        read: false,
        is_system: false,
      }

      setMessages((currentMessages) => [...currentMessages, tempMessage])

      setMessageText("")
      setSelectedMedia(null)

      setTimeout(() => scrollToBottom(), 100)

      const result = await sendMessageWithMedia(chatId, user.id, tempMessage.content, mediaUrl, selectedMedia?.type)

      if (!result) {
        throw new Error("Failed to send message")
      }

      if (!chatStarted) {
        setChatStarted(true)
        setCanSendMessages(true)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      Alert.alert("Error", "Failed to send message. Please try again.")

      setMessages((currentMessages) => currentMessages.filter((msg) => !msg.id.toString().startsWith("temp-")))
    } finally {
      setSendingMessage(false)
    }
  }

  const addActivityLog = async (actionType, details) => {
    try {
      const newLog = {
        chat_id: chatId,
        user_id: user.id,
        action_type: actionType,
        details: details,
        created_at: new Date().toISOString(),
      }

      setActivityLogs((current) => [
        ...current,
        {
          id: `temp-${Date.now()}`,
          ...newLog,
        },
      ])

      const { error } = await supabase.from("chat_activity_logs").insert(newLog)

      if (error) throw error
    } catch (error) {
      console.error("Error adding activity log:", error)
    }
  }

  const startChat = async () => {
    try {
      setIsStartingChat(true)

      // Send the system message
      const { error } = await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        content: "Chat has been started. You can now discuss the proposal details.",
        created_at: new Date(),
        read: false,
        is_system: true,
      })

      if (error) throw error

      // This is important - send an actual first message so chatStarted becomes true
      const result = await sendMessage(
        chatId,
        user.id,
        "Hello! I've reviewed your proposal and would like to discuss further.",
      )

      if (!result) {
        throw new Error("Failed to send initial message")
      }

      // Explicitly set these states
      setChatStarted(true)
      setCanSendMessages(true)

      // Refresh messages to show the new ones
      fetchChatData()
    } catch (error) {
      console.error("Error starting chat:", error)
      Alert.alert("Error", "Failed to start chat. Please try again.")
    } finally {
      setIsStartingChat(false)
    }
  }

  const acceptProposal = async () => {
    await addSystemMessage("Opening agreement creation form...")
    setShowAgreementModal(true)
  }

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true })
    }
  }

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender_id === user.id

    if (item.is_system) {
      let bgColor = "bg-gray-100"
      let textColor = "text-gray-700"

      if (item.content.includes("proposal") && item.content.includes("submitted")) {
        bgColor = "bg-blue-50"
        textColor = "text-blue-700"
      } else if (item.content.includes("accepted")) {
        bgColor = "bg-green-50"
        textColor = "text-green-700"
      } else if (item.content.includes("rejected")) {
        bgColor = "bg-red-50"
        textColor = "text-red-700"
      } else if (item.content.includes("agreement")) {
        bgColor = "bg-purple-50"
        textColor = "text-purple-700"
      }

      return (
        <View className="my-2 px-4">
          <View className={`${bgColor} py-2 px-4 rounded-full self-center`}>
            <Text className={`${textColor} text-xs text-center`}>{item.content}</Text>
          </View>
        </View>
      )
    }

    return (
      <View className={`mb-3 max-w-[80%] ${isMyMessage ? "self-end" : "self-start"}`}>
        <View
          className={`p-3 ${
            isMyMessage ? "bg-[#0D9F70] rounded-3xl rounded-br-none" : "bg-gray-100 rounded-3xl rounded-bl-none"
          }`}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 1,
          }}
        >
          {item.media_url && item.media_type === "image" && (
            <TouchableOpacity
              onPress={() => {
                // You could add a full-screen image viewer here
              }}
              className="mb-2"
            >
              <Image
                source={{ uri: item.media_url }}
                style={{
                  width: "100%",
                  aspectRatio: 1.33, // 4:3 aspect ratio, adjust as needed
                  borderRadius: 8,
                }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}

          {item.content && item.content.length > 0 && (
            <Text className={`${isMyMessage ? "text-white" : "text-gray-800"}`}>{item.content}</Text>
          )}
        </View>
        <Text className={`text-xs text-gray-500 mt-1 ${isMyMessage ? "text-right mr-2" : "text-left ml-2"}`}>
          {format(new Date(item.created_at), "HH:mm")}
        </Text>
      </View>
    )
  }

  if (loading) {
    return <ChatScreenSkeleton />
  }

  const isJobOwner = user && chat && user.id === chat.job_owner_id

  // Check if there are any non-system messages
  const nonSystemMessages = messages.filter((msg) => !msg.is_system)
  const hasOnlySystemMessages = messages.length > 0 && nonSystemMessages.length === 0

  const addSystemMessage = async (content) => {
    try {
      const { error } = await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        content: content,
        created_at: new Date(),
        read: false,
        is_system: true,
      })

      if (error) throw error

      fetchChatData()
    } catch (error) {
      console.error("Error adding system message:", error)
    }
  }

  const MediaPickerOverlay = () => {
    if (!isMediaPickerVisible) return null

    return (
      <View className="absolute bottom-16 left-0 right-0 bg-white p-4 rounded-t-3xl shadow-lg border border-gray-200">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-gray-800 text-lg font-pmedium">Attach Media</Text>
          <TouchableOpacity onPress={() => setIsMediaPickerVisible(false)}>
            <X size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-around">
          <TouchableOpacity onPress={pickImage} className="items-center p-3">
            <View className="bg-gray-100 w-12 h-12 rounded-full items-center justify-center mb-1">
              <Paperclip size={24} color="#0D9F70" />
            </View>
            <Text className="text-gray-700">Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={takePhoto} className="items-center p-3">
            <View className="bg-gray-100 w-12 h-12 rounded-full items-center justify-center mb-1">
              <Camera size={24} color="#0D9F70" />
            </View>
            <Text className="text-gray-700">Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const MediaPreview = () => {
    if (!selectedMedia) return null

    return (
      <View className="mx-3 mt-2 mb-3">
        <View className="relative">
          <Image
            source={{ uri: selectedMedia.uri }}
            style={{ width: "100%", height: 120, borderRadius: 8 }}
            resizeMode="cover"
          />
          <TouchableOpacity
            onPress={() => setSelectedMedia(null)}
            className="absolute top-2 right-2 bg-black/50 rounded-full p-1"
          >
            <X size={16} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const DebugInfo = () => {
    if (!showDebugInfo) return null

    return (
      <View className="bg-black/80 p-3 absolute top-20 left-0 right-0 z-50">
        <Text className="text-white text-xs">isJobOwner: {isJobOwner ? "true" : "false"}</Text>
        <Text className="text-white text-xs">chatStarted: {chatStarted ? "true" : "false"}</Text>
        <Text className="text-white text-xs">canSendMessages: {canSendMessages ? "true" : "false"}</Text>
        <Text className="text-white text-xs">Total messages: {messages.length}</Text>
        <Text className="text-white text-xs">System messages: {messages.filter((m) => m.is_system).length}</Text>
        <Text className="text-white text-xs">Non-system messages: {nonSystemMessages.length}</Text>
        <TouchableOpacity onPress={() => setShowDebugInfo(false)} className="bg-red-500 p-2 rounded mt-2">
          <Text className="text-white text-center">Close Debug</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <DebugInfo />

      <View className="bg-[#0D9F70] pt-12 pb-4 px-4 rounded-b-3xl shadow-md">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-2 rounded-full mr-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft color="white" size={24} />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center flex-1" onPress={() => setShowJobDetails(true)}>
            <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
              <Text className="text-[#0D9F70] font-pbold">{otherUser?.full_name?.charAt(0) || "?"}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-xl font-pbold">{otherUser?.full_name || "Chat"}</Text>
              <Text className="text-white text-sm opacity-80">
                {(chat?.offline_job?.title || chat?.job?.title) ?? "Discussion"}
              </Text>
            </View>
            <Info size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Add permanent Start Chat button for job owners when there are only system messages */}
      {isJobOwner && hasOnlySystemMessages && (
        <View className="bg-yellow-50 p-3 mx-4 mt-3 rounded-lg border border-yellow-200">
          <Text className="text-yellow-800 text-center mb-2">
            You need to start the chat to communicate with the freelancer
          </Text>
          <TouchableOpacity
            onPress={startChat}
            disabled={isStartingChat}
            className="bg-[#0D9F70] py-2 rounded-full flex-row items-center justify-center"
          >
            {isStartingChat ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MessageCircle size={18} color="#fff" className="mr-2" />
                <Text className="text-white font-pmedium">Start Chat</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Debug button */}
      <TouchableOpacity
        onPress={() => setShowDebugInfo(!showDebugInfo)}
        className="absolute top-2 right-2 z-50 bg-gray-800 p-1 rounded opacity-50"
      >
        <Text className="text-white text-xs">Debug</Text>
      </TouchableOpacity>

      {proposal && (
        <TouchableOpacity
          className="mx-4 mt-3 mb-1 p-3 bg-[#E7F7F1] rounded-xl flex-row items-center"
          onPress={() => setShowProposalDetails(true)}
        >
          <View className="w-8 h-8 rounded-full bg-[#0D9F70] items-center justify-center mr-3">
            <Info size={16} color="white" />
          </View>
          <View className="flex-1">
            <Text className="text-[#0D9F70] font-pbold">Proposal Details</Text>
            <Text className="text-gray-700 text-sm" numberOfLines={1}>
              {proposal.currency} {proposal.rate} • {proposal.payment_type === "hourly" ? "Hourly rate" : "Fixed price"}
            </Text>
          </View>
          <View
            className={`px-2 py-1 rounded-full ${
              proposal.status === "accepted"
                ? "bg-green-100"
                : proposal.status === "rejected"
                  ? "bg-red-100"
                  : "bg-blue-100"
            }`}
          >
            <Text
              className={`text-xs font-pmedium ${
                proposal.status === "accepted"
                  ? "text-green-700"
                  : proposal.status === "rejected"
                    ? "text-red-700"
                    : "text-blue-700"
              }`}
            >
              {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {job && (
        <JobDetails
          isVisible={showJobDetails}
          onClose={() => setShowJobDetails(false)}
          job={chat?.offline_job || chat?.job}
          isJobOwner={isJobOwner}
        />
      )}

      {proposal && (
        <ProposalDetails
          isVisible={showProposalDetails}
          onClose={() => setShowProposalDetails(false)}
          proposal={proposal}
          jobTitle={chat?.job?.title}
          isJobOwner={isJobOwner}
          onAccept={acceptProposal}
          isAccepting={isAcceptingProposal}
        />
      )}

      {isJobOwner && proposal?.status === "pending" && chatStarted && !agreementExists && (
        <TouchableOpacity
          className="absolute right-4 bottom-20 z-10 flex-row items-center bg-[#0D9F70] px-5 py-3 rounded-full shadow-lg"
          onPress={() => setShowAgreementModal(true)}
          style={{ elevation: 5 }}
        >
          <CheckCircle size={24} color="#fff" className="mr-2" />
          <Text className="text-white font-pbold">Accept Proposal</Text>
        </TouchableOpacity>
      )}

      {agreementExists && (
        <View className="absolute right-4 z-10" style={{ bottom: 85 }}>
          <TouchableOpacity
            className="mb-3 flex-row items-center bg-[#0D9F70] px-5 py-3 rounded-full shadow-lg"
            onPress={() => setShowAgreementModal(true)}
            style={{ elevation: 5 }}
          >
            <Calendar size={24} color="#fff" className="mr-2" />
            <Text className="text-white font-pbold">Agreement</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center bg-blue-500 px-5 py-3 rounded-full shadow-lg"
            onPress={() => setShowMilestonesModal(true)}
            style={{ elevation: 5 }}
          >
            <DollarSign size={24} color="#fff" className="mr-2" />
            <Text className="text-white font-pbold">{agreement?.is_hourly ? "Time & Payments" : "Milestones"}</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
          ListEmptyComponent={() => {
            return (
              <View className="flex-1 justify-center items-center">
                {isJobOwner ? (
                  <View className="w-full px-4">
                    <View className="bg-gray-100 rounded-xl p-4 mb-4">
                      <Text className="text-gray-700 text-center">
                        A new proposal has been submitted. Review the details and start a conversation to negotiate
                        terms.
                      </Text>
                    </View>

                    <View className="mt-4 flex-row justify-center space-x-3">
                      <TouchableOpacity
                        onPress={startChat}
                        disabled={isStartingChat}
                        className="bg-[#0D9F70] px-5 py-2.5 rounded-full flex-row items-center"
                      >
                        {isStartingChat ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <MessageCircle size={18} color="#fff" className="mr-2" />
                            <Text className="text-white font-pmedium">Start Chat</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setShowProposalDetails(true)}
                        className="bg-gray-200 px-5 py-2.5 rounded-full"
                      >
                        <Text className="text-gray-700 font-pmedium">View Details</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View className="items-center px-4">
                    <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
                      <Clock size={24} color="#0D9F70" />
                    </View>
                    <Text className="text-gray-700 font-pmedium text-center mb-2">Your proposal is being reviewed</Text>
                    <Text className="text-gray-500 text-center mb-4">
                      You'll be able to chat once the job poster initiates the conversation
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowProposalDetails(true)}
                      className="mt-2 bg-[#0D9F70] px-5 py-2.5 rounded-full"
                    >
                      <Text className="text-white font-pmedium">View Proposal Details</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )
          }}
        />

        <MediaPreview />

        <View className="border-t border-gray-100 p-3">
          {!canSendMessages && !isJobOwner ? (
            <View className="bg-gray-100 rounded-lg p-3 mb-2">
              <Text className="text-gray-600 text-center text-sm">
                Waiting for the job poster to start the conversation
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2">
              <TextInput
                className="flex-1 text-base text-gray-800"
                placeholder={canSendMessages ? "Type a message..." : "You cannot send messages yet"}
                placeholderTextColor="#9CA3AF"
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={500}
                editable={canSendMessages}
              />

              {/* Only show media button if the user can send messages */}
              {canSendMessages && (
                <TouchableOpacity
                  onPress={() => setIsMediaPickerVisible(true)}
                  className="ml-2 p-2 rounded-full bg-gray-300"
                >
                  <Paperclip size={20} color="#0D9F70" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleSendMessage}
                disabled={(!messageText.trim() && !selectedMedia) || sendingMessage || !canSendMessages}
                className={`ml-2 p-2 rounded-full ${
                  (messageText.trim() || selectedMedia) && canSendMessages ? "bg-[#0D9F70]" : "bg-gray-300"
                }`}
              >
                {sendingMessage ? <ActivityIndicator size="small" color="#fff" /> : <Send color="#fff" size={20} />}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <MediaPickerOverlay />

      <AgreementModal
        isVisible={showAgreementModal}
        onClose={() => setShowAgreementModal(false)}
        chatId={chatId}
        jobId={job?.id}
        proposalId={proposal?.id}
        userId={user?.id}
        proposal={proposal}
        chat={chat}
        isJobOwner={isJobOwner}
        agreementExists={agreementExists}
        onAgreementSubmitted={() => {
          supabase
            .from("messages")
            .insert({
              chat_id: chatId,
              sender_id: user.id,
              content: `${isJobOwner ? "Job poster" : "Freelancer"} created and signed the agreement.`,
              created_at: new Date(),
              read: false,
              is_system: true,
            })
            .then(() => {
              fetchChatData()
              setShowAgreementModal(false)
            })
        }}
      />

      <MilestonesModal
        isVisible={showMilestonesModal}
        onClose={() => setShowMilestonesModal(false)}
        chatId={chatId}
        jobId={job?.id}
        proposalId={proposal?.id}
        isJobOwner={isJobOwner}
        proposal={proposal}
        agreement={agreement}
        onMilestoneAdded={fetchChatData}
      />
    </SafeAreaView>
  )
}
