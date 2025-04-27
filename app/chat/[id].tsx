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
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { ArrowLeft, Send, Info, MessageCircle, Clock } from "lucide-react-native"
import { format } from "date-fns"
import { ProposalDetails } from "@/components/chats/proposal-details"
import { ChatScreenSkeleton } from "@/components/chats/chat-screen-skeleton"
import { createChatForProposal, markMessagesAsRead, sendMessage } from "@/lib/chat-service"
import { JobDetails } from "@/components/chats/job-details" // We'll create this component

export default function ChatScreen() {
  // Get parameters from route
  const params = useLocalSearchParams()
  const chatId = params.id as string
  const jobId = params.jobId as string
  const proposalId = params.proposalId as string

  const router = useRouter()
  const { user } = useAuth()

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
  const [job, setJob] = useState(null) // Add state for job details
  const [showProposalDetails, setShowProposalDetails] = useState(false)
  const [showJobDetails, setShowJobDetails] = useState(false) // Add state for showing job details
  const [isStartingChat, setIsStartingChat] = useState(false)
  const [isAcceptingProposal, setIsAcceptingProposal] = useState(false)
  const [canSendMessages, setCanSendMessages] = useState(false)
  const [chatStarted, setChatStarted] = useState(false)

  const flatListRef = useRef(null)
  const subscription = useRef(null)

  useEffect(() => {
    console.log("ChatScreen mounted with params:", { chatId, jobId, proposalId })

    if (user) {
      if (chatId) {
        fetchChatData()
        setupMessagesSubscription()
        // Mark messages as read when viewing the chat
        if (chatId) {
          markMessagesAsRead(chatId, user.id).catch((err) => console.error("Error marking messages as read:", err))
        }
      } else if (jobId && proposalId) {
        // If no chatId but we have job and proposal, try to find or create a chat
        findOrCreateChat()
      }
    }

    return () => {
      // Clean up subscription when component unmounts
      if (subscription.current) {
        supabase.removeChannel(subscription.current)
      }
    }
  }, [chatId, jobId, proposalId, user])

  // Check subscription status periodically
  useEffect(() => {
    if (!chatId || !user) return

    const checkSubscription = setInterval(() => {
      if (!subscription.current) {
        console.log("Subscription not found, reconnecting...")
        setupMessagesSubscription()
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(checkSubscription)
  }, [chatId, user])

  // Update the findOrCreateChat function to use the new service function
  const findOrCreateChat = async () => {
    try {
      setLoading(true)
      console.log("Finding or creating chat for job:", jobId, "and proposal:", proposalId)

      if (!user) {
        Alert.alert("Error", "You must be logged in to view this chat")
        router.back()
        return
      }

      // Make sure we're passing the parameters in the correct order
      // jobId first, then proposalId
      const newChat = await createChatForProposal(jobId, proposalId, user.id)

      if (newChat) {
        console.log("Chat found or created:", newChat)
        // Update route params with new chat ID
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

      // Fetch chat data
      const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .select(`
    *, 
    job:job_id(
      id, 
      user_id, 
      title, 
      description, 
      images, 
      payment_type, 
      amount, 
      currency, 
      time_required, 
      time_unit, 
      skill_level, 
      location_address, 
      required_skills, 
      status
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
      setJob(chatData.job) // Store the job details

      // Check if chat is already started by looking for non-system messages
      const { data: existingMessages, error: existingMessagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", id)
        .eq("is_system", false)
        .limit(1)

      if (!existingMessagesError && existingMessages && existingMessages.length > 0) {
        setChatStarted(true)
      }

      // Determine if user can send messages
      const isJobOwner = user.id === chatData.job_owner_id
      setCanSendMessages(isJobOwner || chatStarted)

      // Fetch proposal data
      const { data: proposalData, error: proposalError } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", chatData.proposal_id)
        .single()

      if (proposalError) {
        console.error("Error fetching proposal:", proposalError)
        // Create a minimal proposal object if we can't fetch the real one
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

        // If we need the proposer's name, fetch it separately
        if (proposalData) {
          const { data: proposerData } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", proposalData.user_id)
            .single()

          if (proposerData) {
            // Add the proposer's name to the proposal object
            setProposal({
              ...proposalData,
              proposer_name: proposerData.full_name,
            })
          }
        }
      }

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", id)
        .order("created_at", { ascending: true })

      if (messagesError) {
        console.error("Error fetching messages:", messagesError)
      } else {
        // Don't include system messages in the messages list
        // They will be handled separately in the UI based on user role
        const filteredMessages = messagesData.filter((msg) => !msg.is_system) || []
        setMessages(filteredMessages)
        console.log("Fetched messages:", filteredMessages.length, filteredMessages)

        // Check if there are any non-system messages to determine if chat has started
        setChatStarted(filteredMessages.length > 0)

        // If job owner, can always send messages. If not job owner, can only send if chat started
        setCanSendMessages(isJobOwner || filteredMessages.length > 0)
      }

      // Get profile data for other user
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
        // Fallback if no profile is found
        setOtherUser({
          full_name: `User ${otherUserIdToFetch.substring(0, 4)}`,
          user_id: otherUserIdToFetch,
        })
        console.log("No profile found for user:", otherUserIdToFetch)
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

            // Only add non-system messages to the messages list
            if (!payload.new.is_system) {
              // Replace any temporary message with the real one from the database
              setMessages((currentMessages) => {
                // Check if this is a message we sent (replace temp version)
                if (payload.new.sender_id === user.id) {
                  return currentMessages.map((msg) =>
                    msg.id.toString().startsWith("temp-") && msg.content === payload.new.content ? payload.new : msg,
                  )
                } else {
                  // This is a message from the other user, just add it
                  return [...currentMessages, payload.new]
                }
              })

              console.log("Updated messages state with real-time data")
            }

            // If job owner sends a message, enable messaging for proposal owner
            if (!chatStarted && !payload.new.is_system) {
              setChatStarted(true)
              setCanSendMessages(true)
            }

            // Mark message as read if user is viewing the chat
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

  const handleSendMessage = async () => {
    if (!messageText.trim() || !chatId || !canSendMessages) return

    try {
      setSendingMessage(true)

      // Create a temporary message object for optimistic UI update
      const tempMessage = {
        id: `temp-${Date.now()}`,
        chat_id: chatId,
        sender_id: user.id,
        content: messageText.trim(),
        created_at: new Date().toISOString(),
        read: false,
        is_system: false,
      }

      // Add message to UI immediately (optimistic update)
      setMessages((currentMessages) => [...currentMessages, tempMessage])

      // Clear the input right away for better UX
      setMessageText("")

      // Scroll to the new message
      setTimeout(() => scrollToBottom(), 100)

      // Then send to database
      const result = await sendMessage(chatId, user.id, tempMessage.content)

      if (!result) {
        throw new Error("Failed to send message")
      }

      console.log("Message sent successfully")

      // If this is the first non-system message, mark chat as started
      if (!chatStarted) {
        setChatStarted(true)
        setCanSendMessages(true)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      Alert.alert("Error", "Failed to send message. Please try again.")

      // If there was an error, revert the optimistic update
      setMessages((currentMessages) => currentMessages.filter((msg) => !msg.id.toString().startsWith("temp-")))
    } finally {
      setSendingMessage(false)
    }
  }

  const startChat = async () => {
    try {
      setIsStartingChat(true)

      // Send a system message that chat has been started
      const { error } = await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        content: "Chat has been started. You can now discuss the proposal details.",
        created_at: new Date(),
        read: false,
        is_system: true,
      })

      if (error) throw error

      // Send the first actual message to initiate the chat
      const result = await sendMessage(
        chatId,
        user.id,
        "Hello! I've reviewed your proposal and would like to discuss further.",
      )

      if (!result) {
        throw new Error("Failed to send initial message")
      }

      setChatStarted(true)
      setCanSendMessages(true)
    } catch (error) {
      console.error("Error starting chat:", error)
      Alert.alert("Error", "Failed to start chat. Please try again.")
    } finally {
      setIsStartingChat(false)
    }
  }

  const acceptProposal = async () => {
    if (!proposal || !chat) return

    try {
      setIsAcceptingProposal(true)

      // Update proposal status
      const { error: updateError } = await supabase
        .from("proposals")
        .update({ status: "accepted" })
        .eq("id", proposal.id)

      if (updateError) throw updateError

      // Send a system message about proposal acceptance
      const { error: messageError } = await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        content: "Proposal has been accepted! Work can now begin.",
        created_at: new Date(),
        read: false,
        is_system: true,
      })

      if (messageError) {
        console.error("Error creating system message:", messageError)
        throw messageError
      }

      // Refresh proposal data
      const { data: updatedProposal } = await supabase.from("proposals").select("*").eq("id", proposal.id).single()

      setProposal(updatedProposal)
      setShowProposalDetails(false)
    } catch (error) {
      console.error("Error accepting proposal:", error)
      Alert.alert("Error", "Failed to accept proposal. Please try again.")
    } finally {
      setIsAcceptingProposal(false)
    }
  }

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true })
    }
  }

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender_id === user.id

    return (
      <View className={`mb-3 max-w-[80%] ${isMyMessage ? "self-end" : "self-start"}`}>
        <View
          className={`p-3 rounded-xl ${isMyMessage ? "bg-[#0D9F70] rounded-tr-none" : "bg-gray-100 rounded-tl-none"}`}
        >
          <Text className={`${isMyMessage ? "text-white" : "text-gray-800"}`}>{item.content}</Text>
        </View>
        <Text className={`text-xs text-gray-500 mt-1 ${isMyMessage ? "text-right" : "text-left"}`}>
          {format(new Date(item.created_at), "HH:mm")}
        </Text>
      </View>
    )
  }

  if (loading) {
    return <ChatScreenSkeleton />
  }

  const isJobOwner = user && chat && user.id === chat.job_owner_id

  return (
    <SafeAreaView className="flex-1 bg-white">
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
              <Text className="text-white text-sm opacity-80">{chat?.job?.title || "Discussion"}</Text>
            </View>
            <Info size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Proposal Banner */}
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

      {/* Job Details Modal */}
      {job && (
        <JobDetails
          isVisible={showJobDetails}
          onClose={() => setShowJobDetails(false)}
          job={job}
          isJobOwner={isJobOwner}
        />
      )}

      {/* Proposal Details Modal */}
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
          ListEmptyComponent={() =>
            messages.length === 0 ? (
              <View className="flex-1 justify-center items-center">
                {isJobOwner ? (
                  // For job poster - show start chat button and proposal info
                  <View className="w-full px-4">
                    <View className="bg-gray-100 rounded-xl p-4 mb-4">
                      <Text className="text-gray-700 text-center">
                        A new proposal has been submitted. Review the details and start a conversation to negotiate
                        terms.
                      </Text>
                    </View>

                    <View className="mt-4 flex-row justify-center space-x-3">
                      {!chatStarted ? (
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
                      ) : proposal?.status !== "accepted" ? (
                        <TouchableOpacity
                          onPress={acceptProposal}
                          disabled={isAcceptingProposal}
                          className="bg-[#0D9F70] px-5 py-2.5 rounded-full flex-row items-center"
                        >
                          {isAcceptingProposal ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text className="text-white font-pmedium">Accept Proposal</Text>
                          )}
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        onPress={() => setShowProposalDetails(true)}
                        className="bg-gray-200 px-5 py-2.5 rounded-full"
                      >
                        <Text className="text-gray-700 font-pmedium">View Details</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  // For proposal sender - show waiting message with icon
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
            ) : null
          }
        />

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
              <TouchableOpacity
                onPress={handleSendMessage}
                disabled={!messageText.trim() || sendingMessage || !canSendMessages}
                className={`ml-2 p-2 rounded-full ${
                  messageText.trim() && canSendMessages ? "bg-[#0D9F70]" : "bg-gray-300"
                }`}
              >
                {sendingMessage ? <ActivityIndicator size="small" color="#fff" /> : <Send color="#fff" size={20} />}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
