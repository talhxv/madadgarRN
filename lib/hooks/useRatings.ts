"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface RatingStats {
  averageRating: number
  totalReviews: number
  isLoading: boolean
}

export function useRatings(userId?: string): RatingStats {
  const { user } = useAuth()
  const [stats, setStats] = useState<RatingStats>({
    averageRating: 0,
    totalReviews: 0,
    isLoading: true,
  })

  useEffect(() => {
    const targetUserId = userId || user?.id

    if (!targetUserId) {
      setStats((prev) => ({ ...prev, isLoading: false }))
      return
    }

    const fetchRatings = async () => {
      try {
        const { data, error } = await supabase.from("job_reviews").select("rating").eq("reviewee_id", targetUserId)

        if (error) {
          console.error("Error fetching ratings:", error)
          setStats((prev) => ({ ...prev, isLoading: false }))
          return
        }

        if (data && data.length > 0) {
          const total = data.reduce((sum, review) => sum + review.rating, 0)
          const average = Number.parseFloat((total / data.length).toFixed(1))

          setStats({
            averageRating: average,
            totalReviews: data.length,
            isLoading: false,
          })
        } else {
          // No reviews yet
          setStats({
            averageRating: 0,
            totalReviews: 0,
            isLoading: false,
          })
        }
      } catch (error) {
        console.error("Error fetching ratings:", error)
        setStats((prev) => ({ ...prev, isLoading: false }))
      }
    }

    fetchRatings()
  }, [userId, user?.id])

  return stats
}
