import { supabase } from "@/lib/supabase"
import { decode } from 'base64-arraybuffer'

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
 * Send a message with optional media attachment
 * @param chatId The chat ID
 * @param userId The sender's user ID
 * @param messageText The message content
 * @param mediaUrl Optional URL to media file
 * @param mediaType Optional media type (image, video, etc)
 * @returns The created message or null if there was an error
 */
export const sendMessageWithMedia = async (
  chatId: string, 
  userId: string, 
  messageText: string, 
  mediaUrl: string | null = null, 
  mediaType: string | null = null
) => {
  try {
    const messageData = {
      chat_id: chatId,
      sender_id: userId,
      content: messageText,
      media_url: mediaUrl,
      media_type: mediaType,
      created_at: new Date(),
      read: false
    }

    const { data, error } = await supabase
      .from("messages")
      .insert(messageData)
      .select()
      .single()

    if (error) {
      console.error("Error sending message with media:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("Error in sendMessageWithMedia:", error)
    return null
  }
}

/**
 * Get the URL for a file in the chat-media bucket
 * @param path Path to file
 * @param download Whether to force download
 * @returns URL to the media file
 */
export const getChatMediaUrl = (path: string, download: boolean = false) => {
  try {
    const { data } = supabase.storage
      .from('chat-media')
      .getPublicUrl(path, download ? { download: true } : undefined)
    
    return data?.publicUrl || null
  } catch (error) {
    console.error("Error getting media URL:", error)
    return null
  }
}

/**
 * Upload media to chat-media bucket
 * @param chatId Chat ID
 * @param userId User ID uploading the file
 * @param base64Data Base64-encoded file data
 * @param fileExt File extension (jpg, png, etc)
 * @returns Path to the uploaded file or null on error
 */
export const uploadChatMedia = async (
  chatId: string, 
  userId: string, 
  base64Data: string, 
  fileExt: string
) => {
  try {
    if (!base64Data) {
      return null
    }

    const filePath = `${chatId}/${userId}-${Date.now()}.${fileExt}`
    
    // Import this function at the top of your file if needed
    // import { decode } from 'base64-arraybuffer'
    const { error } = await supabase.storage
      .from('chat-media')
      .upload(filePath, decode(base64Data), {
        contentType: `image/${fileExt}`
      })

    if (error) throw error

    const { data } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath)

    return data?.publicUrl || null
  } catch (error) {
    console.error("Error uploading media:", error)
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
 * @param jobType The job type ("online" or "offline")
 * @param currentUserId Optional current user ID for logging
 * @returns The created chat or null if there was an error
 */
export async function createChatForProposal(
  jobId: string,
  proposalId: string,
  jobType: "online" | "offline",
  currentUserId?: string // Optional - just for logging
) {
  try {
    console.log(`Creating chat for ${jobType} job with ID: ${jobId}, proposal ID: ${proposalId}`);
    
    // 1. First, determine the ACTUAL job type by checking both tables
    let actualJobType = jobType;
    let job, proposal;
    
    // Check if job exists in the expected table
    const { data: primaryJobCheck, error: primaryJobError } = await supabase
      .from(jobType === "online" ? "jobs" : "offline_jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();
    
    if (primaryJobError) {
      console.error("Error checking primary job table:", primaryJobError);
    }
    
    // If not found in the expected table, check the other table
    if (!primaryJobCheck) {
      console.log(`Job not found in ${jobType} table, trying the other table...`);
      const alternateType = jobType === "online" ? "offline" : "online";
      const { data: alternateJobCheck, error: alternateJobError } = await supabase
        .from(alternateType === "online" ? "jobs" : "offline_jobs")
        .select("id")
        .eq("id", jobId)
        .maybeSingle();
        
      if (!alternateJobError && alternateJobCheck) {
        console.log(`Found job in ${alternateType} table instead!`);
        actualJobType = alternateType;
      } else if (alternateJobError) {
        console.error("Error checking alternate job table:", alternateJobError);
      }
    }
    
    console.log(`Using job type: ${actualJobType} for job ID: ${jobId}`);
    
    // 2. Check if chat already exists with the confirmed job type
    let chatCheckQuery = supabase.from("chats").select("*");
    
    if (actualJobType === "online") {
      chatCheckQuery = chatCheckQuery.eq("job_id", jobId);
    } else {
      chatCheckQuery = chatCheckQuery.eq("offline_job_id", jobId);
    }
    
    // Check for proposal in the right field - also need to check proposal in both tables
    // For now, check with the expected job type's proposal field
    if (actualJobType === "online") {
      chatCheckQuery = chatCheckQuery.eq("proposal_id", proposalId);
    } else {
      chatCheckQuery = chatCheckQuery.eq("offline_proposal_id", proposalId);
    }

    const { data: existingChats, error: findError } = await chatCheckQuery;

    if (findError) throw findError;
    if (existingChats && existingChats.length > 0) {
      console.log("Chat already exists, returning existing chat:", existingChats[0]);
      return existingChats[0];
    }

    // 3. Now fetch the job and proposal from the correct tables
    const jobTable = actualJobType === "online" ? "jobs" : "offline_jobs";
    const proposalTable = actualJobType === "online" ? "proposals" : "offline_proposals";

    // Get job
    const { data: jobs, error: jobError } = await supabase
      .from(jobTable)
      .select("*")
      .eq("id", jobId);

    if (jobError) throw jobError;
    if (!jobs || jobs.length === 0) {
      throw new Error(`${actualJobType === "online" ? "Online" : "Offline"} job with ID ${jobId} not found`);
    }

    job = jobs[0];

    // Get proposal - try both tables if needed
    const { data: proposals, error: proposalError } = await supabase
      .from(proposalTable)
      .select("*")
      .eq("id", proposalId);

    if (proposalError) throw proposalError;
    if (!proposals || proposals.length === 0) {
      const alternateProposalTable = actualJobType === "online" ? "offline_proposals" : "proposals";
      console.log(`Proposal not found in ${proposalTable}, checking ${alternateProposalTable}...`);
      
      const { data: alternateProposals, error: alternateProposalError } = await supabase
        .from(alternateProposalTable)
        .select("*")
        .eq("id", proposalId);
        
      if (alternateProposalError) throw alternateProposalError;
      if (!alternateProposals || alternateProposals.length === 0) {
        throw new Error(`Proposal with ID ${proposalId} not found in any table`);
      }
      
      proposal = alternateProposals[0];
      // Update actualJobType if needed based on where we found the proposal
      actualJobType = alternateProposalTable === "proposals" ? "online" : "offline";
      console.log(`Found proposal in ${alternateProposalTable}, updating job type to ${actualJobType}`);
    } else {
      proposal = proposals[0];
    }

    // 4. Extract the owner IDs from the records
    const jobOwnerId = job.user_id;
    const proposalOwnerId = proposal.user_id;

    // Debug log to verify correct IDs
    console.log(`Job owner ID: ${jobOwnerId}, Proposal owner ID: ${proposalOwnerId}`);
    
    // 5. Validation - prevent same-user chats
    if (jobOwnerId === proposalOwnerId) {
      console.error("Cannot create chat: Job owner and proposal owner are the same user", {
        jobId, proposalId, userId: jobOwnerId
      });
      throw new Error("Cannot create chat - job owner and proposal owner are the same user");
    }
    
    console.log("Creating chat with owners:", {
      jobOwnerId,
      proposalOwnerId,
      currentUserId
    });

    // 6. Prepare chat data using correct field names based on the ACTUAL job type
    const chatData = {
      job_id: actualJobType === "online" ? jobId : null,
      offline_job_id: actualJobType === "offline" ? jobId : null,
      proposal_id: actualJobType === "online" ? proposalId : null, 
      offline_proposal_id: actualJobType === "offline" ? proposalId : null,
      job_owner_id: jobOwnerId,
      proposal_owner_id: proposalOwnerId,
      created_at: new Date(),
      is_active: true,
      job_type: actualJobType
    };

    console.log("Creating chat with data:", chatData);

    // 7. Insert the chat
    const { data: newChats, error: createError } = await supabase
      .from("chats")
      .insert(chatData)
      .select();

    if (createError) throw createError;
    if (!newChats || newChats.length === 0) throw new Error("Failed to create chat");

    const newChat = newChats[0];
    console.log("Chat created successfully:", newChat);

    // 8. Create initial system message
    await supabase.from("messages").insert({
      chat_id: newChat.id,
      sender_id: proposalOwnerId, 
      content: "A new proposal has been submitted. Review the details and respond to start the conversation.",
      created_at: new Date(),
      read: false,
      is_system: true,
    });

    return newChat;
  } catch (error) {
    console.error("Error creating chat for proposal:", error);
    throw error;
  }
}
