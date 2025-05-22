"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

type ProposalCount = {
  total: number
  pending: number
  accepted: number
  rejected: number
}

export function useProposalsSent() {
  const { user } = useAuth()
  const [counts, setCounts] = useState<ProposalCount>({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchProposalCounts = async () => {
      setIsLoading(true)
      try {
        // Get online proposals count
        const { count: onlineTotal, error: onlineError } = await supabase
          .from("proposals")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)

        if (onlineError) throw onlineError

        // Get online pending proposals count
        const { count: onlinePending, error: onlinePendingError } = await supabase
          .from("proposals")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "pending")

        if (onlinePendingError) throw onlinePendingError

        // Get online accepted proposals count
        const { count: onlineAccepted, error: onlineAcceptedError } = await supabase
          .from("proposals")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "accepted")

        if (onlineAcceptedError) throw onlineAcceptedError

        // Get online rejected proposals count
        const { count: onlineRejected, error: onlineRejectedError } = await supabase
          .from("proposals")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "rejected")

        if (onlineRejectedError) throw onlineRejectedError

        // Get offline proposals count
        const { count: offlineTotal, error: offlineError } = await supabase
          .from("offline_proposals")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)

        if (offlineError) throw offlineError

        // Get offline pending proposals count
        const { count: offlinePending, error: offlinePendingError } = await supabase
          .from("offline_proposals")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "pending")

        if (offlinePendingError) throw offlinePendingError

        // Get offline accepted proposals count
        const { count: offlineAccepted, error: offlineAcceptedError } = await supabase
          .from("offline_proposals")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "accepted")

        if (offlineAcceptedError) throw offlineAcceptedError

        // Get offline rejected proposals count
        const { count: offlineRejected, error: offlineRejectedError } = await supabase
          .from("offline_proposals")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "rejected")

        if (offlineRejectedError) throw offlineRejectedError

        // Combine counts
        setCounts({
          total: (onlineTotal || 0) + (offlineTotal || 0),
          pending: (onlinePending || 0) + (offlinePending || 0),
          accepted: (onlineAccepted || 0) + (offlineAccepted || 0),
          rejected: (onlineRejected || 0) + (offlineRejected || 0),
        })
      } catch (error) {
        console.error("Error fetching proposal counts:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProposalCounts()
  }, [user])

  return { ...counts, isLoading }
}
