"use client"

import { useEffect, useState } from "react"
import { ScrollView, Text, TouchableOpacity, View } from "react-native"
import { ArrowLeft, Star, ExternalLink } from "lucide-react-native"
import { useRouter } from "expo-router"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"

interface Review {
  id: number
  job_id: string
  reviewer_id: string
  rating: number
  review_text: string
  created_at: string
  reviewer_type: "client" | "freelancer"
  reviewer_name: string
  job_title: string
}

export default function Reviews() {
  const { user } = useAuth()
  const router = useRouter()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [averageRating, setAverageRating] = useState(0)
  const [ratingCounts, setRatingCounts] = useState<Record<number, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  })

  useEffect(() => {
    if (!user?.id) return

    const fetchReviews = async () => {
      setLoading(true)
      try {
        // Fetch reviews where the current user is the reviewee
        const { data, error } = await supabase
          .from("job_reviews")
          .select(`
          id,
          job_id,
          reviewer_id,
          rating,
          review_text,
          created_at,
          reviewer_type
        `)
          .eq("reviewee_id", user.id)
          .order("created_at", { ascending: false })

        if (error) throw error

        // Fetch job titles separately
        const jobIds = [...new Set(data.map((review) => review.job_id))]
        const { data: jobsData, error: jobsError } = await supabase.from("jobs").select("id, title").in("id", jobIds)

        if (jobsError) throw jobsError

        // Fetch reviewer names separately - note that profiles uses user_id, not id
        const reviewerIds = [...new Set(data.map((review) => review.reviewer_id))]
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", reviewerIds)

        if (profilesError) throw profilesError

        // Create lookup maps
        const jobMap = Object.fromEntries(jobsData.map((job) => [job.id, job.title]))
        const profileMap = Object.fromEntries(profilesData.map((profile) => [profile.user_id, profile.full_name]))

        // Transform the data to include reviewer name and job title
        const formattedReviews = data.map((review) => ({
          id: review.id,
          job_id: review.job_id,
          reviewer_id: review.reviewer_id,
          rating: review.rating,
          review_text: review.review_text,
          created_at: review.created_at,
          reviewer_type: review.reviewer_type,
          reviewer_name: profileMap[review.reviewer_id] || "Anonymous",
          job_title: jobMap[review.job_id] || "Untitled Job",
        }))

        setReviews(formattedReviews)

        // Calculate average rating
        if (formattedReviews.length > 0) {
          const total = formattedReviews.reduce((sum, review) => sum + review.rating, 0)
          setAverageRating(Number.parseFloat((total / formattedReviews.length).toFixed(1)))

          // Count ratings by star level
          const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
          formattedReviews.forEach((review) => {
            counts[review.rating] = (counts[review.rating] || 0) + 1
          })
          setRatingCounts(counts)
        }
      } catch (error) {
        console.error("Error fetching reviews:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchReviews()
  }, [user?.id])

  const renderStars = (rating: number) => {
    return (
      <View className="flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} size={16} color="#FFB800" fill={star <= rating ? "#FFB800" : "transparent"} />
        ))}
      </View>
    )
  }

  const calculatePercentage = (count: number) => {
    if (reviews.length === 0) return 0
    return (count / reviews.length) * 100
  }

  const viewJobDetails = (jobId: string) => {
    // Navigate to job details page
    router.push(`/jobs/${jobId}`)
  }

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-emerald-600 pt-16 pb-6 px-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-psemibold">Ratings & Reviews</Text>
      </View>

      {/* Rating Summary */}
      <View className="bg-white px-4 py-6 rounded-t-3xl -mt-4">
        {loading ? (
          <View className="items-center py-8">
            <Text className="text-gray-500 font-pmedium">Loading reviews...</Text>
          </View>
        ) : reviews.length === 0 ? (
          <View className="items-center py-8">
            <Text className="text-gray-500 font-pmedium">No reviews yet</Text>
          </View>
        ) : (
          <>
            {/* Average Rating */}
            <View className="items-center mb-8">
              <View className="flex-row items-baseline">
                <Text className="text-5xl font-pbold text-gray-800">{averageRating}</Text>
                <Text className="text-2xl font-pmedium text-gray-600 ml-1">/5</Text>
              </View>
              <View className="my-2">{renderStars(Math.round(averageRating))}</View>
              <Text className="text-gray-500 font-pmedium">Based on {reviews.length} reviews</Text>
            </View>

            {/* Rating Breakdown */}
            <View className="mb-8">
              {[5, 4, 3, 2, 1].map((star) => (
                <View key={star} className="flex-row items-center mb-2">
                  <Text className="w-8 font-pmedium text-gray-700">{star}</Text>
                  <Star size={16} color="#FFB800" fill="#FFB800" />
                  <View className="flex-1 h-2 bg-gray-200 rounded-full mx-3">
                    <View
                      className="h-2 bg-emerald-500 rounded-full"
                      style={{ width: `${calculatePercentage(ratingCounts[star])}%` }}
                    />
                  </View>
                  <Text className="w-8 text-right font-pmedium text-gray-700">{ratingCounts[star]}</Text>
                </View>
              ))}
            </View>

            {/* Reviews List */}
            <Text className="text-xl font-psemibold mb-4">Reviews</Text>
            {reviews.map((review) => (
              <View key={review.id} className="mb-6 pb-6 border-b border-gray-100">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="font-psemibold text-gray-800">{review.reviewer_name}</Text>
                  <Text className="text-gray-500 text-sm font-pregular">
                    {format(new Date(review.created_at), "MMM d, yyyy")}
                  </Text>
                </View>
                <View className="mb-2">{renderStars(review.rating)}</View>
                <Text className="text-gray-600 mb-2">{review.review_text}</Text>

                {/* Make job title clickable */}
                <TouchableOpacity onPress={() => viewJobDetails(review.job_id)} className="flex-row items-center">
                  <Text className="text-sm text-emerald-600 font-pmedium">Job: {review.job_title}</Text>
                  <ExternalLink size={14} color="#0D9F70" className="ml-1" />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  )
}
