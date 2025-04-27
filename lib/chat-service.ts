import { supabase } from "@/lib/supabase"

/**
 * Get the count of unread messages for a user
 * @param userId The user ID to check unread messages for
 * @returns The count of unread messages
 */
export async function getUnreadMessageCount(userId: string): Promise<number> {
  try {
    // First get all chats where the user is a participant
    const { data: chats, error: chatsError } = await supabase
      .from("chats")
      .select("id")
      .or(`job_owner_id.eq.${userId},proposal_owner_id.eq.${userId}`)

    if (chatsError) throw chatsError
    if (!chats || chats.length === 0) return 0

    // Get the chat IDs
    const chatIds = chats.map((chat) => chat.id)

    // Count unread messages in those chats where the user is not the sender
    const { count, error: countError } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("chat_id", chatIds)
      .eq("read", false)
      .neq("sender_id", userId)

    if (countError) throw countError

    return count || 0
  } catch (error) {
    console.error("Error getting unread message count:", error)
    return 0
  }
}

/**
 * Mark all messages in a chat as read for a specific user
 * @param chatId The chat ID
 * @param userId The user ID who is reading the messages
 */
export const markMessagesAsRead = async (chatId, userId) => {
  try {
    const { error } = await supabase
      .from("messages")
      .update({ read: true })
      .eq("chat_id", chatId)
      .neq("sender_id", userId)
      .eq("read", false)

    if (error) {
      console.error("Error marking messages as read:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Error in markMessagesAsRead:", error)
    return false
  }
}

/**
 * Send a message in a chat
 * @param chatId The chat ID
 * @param userId The sender's user ID
 * @param messageText The message content
 * @returns The created message or null if there was an error
 */
export const sendMessage = async (chatId, userId, messageText) => {
  try {
    // Fix: Use 'content' instead of 'message'
    const { data, error } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        sender_id: userId,
        content: messageText, // Using 'content' as in your schema
        created_at: new Date(),
        read: false
      })
      .select()
      .single()

    if (error) {
      console.error("Error sending message:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("Error in sendMessage:", error)
    return null
  }
}

/**
 * Create a new chat for a proposal
 * This function can be called with different parameter orders:
 * - From chat screen: (jobId, proposalId, currentUserId)
 * - From proposal modal: (jobId, proposalId, jobOwnerId, proposalOwnerId)
 *
 * @param jobId The job ID
 * @param proposalId The proposal ID
 * @param param3 Either the current user ID or the job owner ID
 * @param param4 Optional proposal owner ID
 * @returns The created chat or null if there was an error
 */
export async function createChatForProposal(jobId: string, proposalId: string, param3?: string, param4?: string) {
  try {
    // Log the parameters to help with debugging
    console.log(`Creating chat for proposal: {
      jobId: "${jobId}",
      proposalId: "${proposalId}",
      param3: "${param3 || ""}",
      param4: "${param4 || ""}"
    }`)

    // First check if a chat already exists - don't use single() here
    const { data: existingChats, error: findError } = await supabase
      .from("chats")
      .select("*")
      .eq("job_id", jobId)
      .eq("proposal_id", proposalId)

    if (findError) {
      console.error("Error checking for existing chat:", findError)
      throw findError
    }

    // If we found an existing chat, return it
    if (existingChats && existingChats.length > 0) {
      console.log("Found existing chat:", existingChats[0])
      return existingChats[0]
    }

    console.log("No existing chat found, creating a new one")

    // Try to get the job first
    const { data: jobs, error: jobError } = await supabase.from("jobs").select("*").eq("id", jobId)

    if (jobError) {
      console.error("Error fetching job:", jobError)
      throw jobError
    }

    if (!jobs || jobs.length === 0) {
      console.error("Job not found:", jobId)
      throw new Error(`Job with ID ${jobId} not found`)
    }

    const job = jobs[0]

    // Determine job owner ID
    let jobOwnerId = job.user_id

    // If param4 exists, then param3 is the job owner ID (called from proposal modal)
    if (param4) {
      jobOwnerId = param3
    }

    // Try to get the proposal
    const { data: proposals, error: proposalError } = await supabase.from("proposals").select("*").eq("id", proposalId)

    // Determine proposal owner ID
    let proposalOwnerId = null

    if (proposalError || !proposals || proposals.length === 0) {
      console.warn("Proposal not found or error:", proposalId, proposalError)

      // If param4 exists, use it as the proposal owner ID (called from proposal modal)
      if (param4) {
        proposalOwnerId = param4
      }
      // If param3 exists and it's not the job owner, assume it's the proposal owner (called from chat screen)
      else if (param3 && param3 !== jobOwnerId) {
        proposalOwnerId = param3
      } else {
        console.error("Cannot determine proposal owner")
        throw new Error(`Proposal with ID ${proposalId} not found and cannot determine owner`)
      }
    } else {
      proposalOwnerId = proposals[0].user_id
    }

    console.log(`Creating chat between job owner ${jobOwnerId} and proposal owner ${proposalOwnerId}`)

    // Create a new chat
    const { data: newChats, error: createError } = await supabase
      .from("chats")
      .insert({
        job_id: jobId,
        proposal_id: proposalId,
        job_owner_id: jobOwnerId,
        proposal_owner_id: proposalOwnerId,
        created_at: new Date(),
        is_active: true,
      })
      .select()

    if (createError) {
      console.error("Error creating chat:", createError)
      throw createError
    }

    if (!newChats || newChats.length === 0) {
      console.error("Failed to create chat")
      throw new Error("Failed to create chat")
    }

    const newChat = newChats[0]
    console.log("Created new chat:", newChat)

    // Create initial system message
    const { error: messageError } = await supabase.from("messages").insert({
      chat_id: newChat.id,
      sender_id: proposalOwnerId,
      content: "A new proposal has been submitted. Review the details and respond to start the conversation.", // Changed from 'message' to 'content'
      created_at: new Date(),
      read: false,
      is_system: true,
    })

    if (messageError) {
      console.error("Error creating system message:", messageError)
      // Don't throw here, we still want to return the chat
    }

    return newChat
  } catch (error) {
    console.error("Error creating chat for proposal:", error)
    return null
  }
}
