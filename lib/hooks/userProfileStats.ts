"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface ProfileStats {
  bidsPending: number
  jobsCompleted: number
  totalEarned: number
  isLoading: boolean
}

export function useProfileStats(userId?: string): ProfileStats {
  const { user } = useAuth()
  const [stats, setStats] = useState<ProfileStats>({
    bidsPending: 0,
    jobsCompleted: 0,
    totalEarned: 0,
    isLoading: true,
  })

  useEffect(() => {
    const targetUserId = userId || user?.id

    if (!targetUserId) {
      setStats((prev) => ({ ...prev, isLoading: false }))
      return
    }

    const fetchStats = async () => {
      try {
        // 1. Fetch pending proposals count (bids pending) - SEPARATE FETCH
        const { data: pendingProposals, error: pendingError } = await supabase
          .from("proposals")
          .select("id")
          .eq("user_id", targetUserId)
          .eq("status", "pending")

        if (pendingError) {
          console.error("Error fetching pending proposals:", pendingError)
        }

        const bidsPending = pendingProposals?.length || 0

        // 2. Find completed jobs by looking at job_reviews - SEPARATE FETCH
        // If there's a review where this user is the reviewee, it means they completed the job
        const { data: reviews, error: reviewsError } = await supabase
          .from("job_reviews")
          .select("job_id, proposal_id")
          .eq("reviewee_id", targetUserId)

        if (reviewsError) {
          console.error("Error fetching job reviews:", reviewsError)
        }

        const jobsCompleted = reviews?.length || 0

        // 3. Calculate total earnings - SEPARATE FETCH
        // For each job that has a review, fetch the job details to get the amount
        let totalEarned = 0
        if (reviews && reviews.length > 0) {
          // Get unique job IDs
          const jobIds = [...new Set(reviews.map((review) => review.job_id))]

          // Fetch job details for these jobs
          const { data: jobsData, error: jobsError } = await supabase.from("jobs").select("id, amount").in("id", jobIds)

          if (jobsError) {
            console.error("Error fetching job details:", jobsError)
          } else if (jobsData) {
            // Sum up the amounts
            totalEarned = jobsData.reduce((sum, job) => sum + Number(job.amount), 0)
          }
        }

        // 4. Set all stats
        setStats({
          bidsPending,
          jobsCompleted,
          totalEarned,
          isLoading: false,
        })
      } catch (error) {
        console.error("Error fetching profile stats:", error)
        setStats((prev) => ({ ...prev, isLoading: false }))
      }
    }

    fetchStats()
  }, [userId, user?.id])

  return stats
}
