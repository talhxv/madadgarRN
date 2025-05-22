"use client"

import { useEffect, useState } from "react"
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from "react-native"
import { ArrowLeft, Calendar, MapPin, Star, Banknote } from "lucide-react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"

interface CompletedJob {
  id: string
  title: string
  description: string
  amount: number
  currency: string
  created_at: string
  completed_at: string
  status: string
  location_address: string | null
  category_name: string | null
  client_name: string
  rating: number | null
  review_text: string | null
}

export default function CompletedJobs() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useLocalSearchParams()
  const userId = (params.userId as string) || user?.id
  const [jobs, setJobs] = useState<CompletedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return

    const fetchCompletedJobs = async () => {
      try {
        setLoading(true)

        // First, find all proposals by this user that were accepted
        const { data: proposals, error: proposalsError } = await supabase
          .from("proposals")
          .select("id, job_id, created_at")
          .eq("user_id", userId)
          .eq("status", "accepted")

        if (proposalsError) throw proposalsError
        if (!proposals || proposals.length === 0) {
          setJobs([])
          return
        }

        // Get all job IDs from these proposals
        const jobIds = proposals.map((p) => p.job_id)

        // Fetch the completed jobs
        const { data: jobsData, error: jobsError } = await supabase
          .from("jobs")
          .select(`
            id, 
            title, 
            description, 
            amount, 
            currency, 
            created_at, 
            updated_at,
            status,
            location_address,
            category:category_id(name),
            user_id
          `)
          .in("id", jobIds)
          .eq("status", "completed")

        if (jobsError) throw jobsError
        if (!jobsData || jobsData.length === 0) {
          setJobs([])
          return
        }

        // Get client names (job owners)
        const clientIds = [...new Set(jobsData.map((job) => job.user_id))]
        const { data: clientProfiles, error: clientsError } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", clientIds)

        if (clientsError) throw clientsError

        // Create a map of client IDs to names
        const clientMap = Object.fromEntries(
          (clientProfiles || []).map((profile) => [profile.user_id, profile.full_name || "Unknown Client"]),
        )

        // Get reviews for these jobs where the user is the reviewee
        const { data: reviews, error: reviewsError } = await supabase
          .from("job_reviews")
          .select("job_id, rating, review_text, created_at")
          .in("job_id", jobIds)
          .eq("reviewee_id", userId)

        if (reviewsError) throw reviewsError

        // Create a map of job IDs to reviews
        const reviewMap = Object.fromEntries(
          (reviews || []).map((review) => [
            review.job_id,
            {
              rating: review.rating,
              review_text: review.review_text,
              created_at: review.created_at,
            },
          ]),
        )

        // Combine all the data
        const completedJobsWithData = jobsData.map((job) => ({
          id: job.id,
          title: job.title,
          description: job.description,
          amount: job.amount,
          currency: job.currency,
          created_at: job.created_at,
          completed_at: job.updated_at,
          status: job.status,
          location_address: job.location_address,
          category_name: job.category?.name || null,
          client_name: clientMap[job.user_id] || "Unknown Client",
          rating: reviewMap[job.id]?.rating || null,
          review_text: reviewMap[job.id]?.review_text || null,
        }))

        // Sort by completion date (most recent first)
        completedJobsWithData.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())

        setJobs(completedJobsWithData)
      } catch (err) {
        console.error("Error fetching completed jobs:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch completed jobs")
      } finally {
        setLoading(false)
      }
    }

    fetchCompletedJobs()
  }, [userId])

  const renderStars = (rating: number | null) => {
    if (rating === null) return null

    return (
      <View className="flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} size={14} color="#FFB800" fill={star <= rating ? "#FFB800" : "transparent"} />
        ))}
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-emerald-600 pt-16 pb-6 px-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-psemibold">Completed Jobs</Text>
      </View>

      {/* Content */}
      <View className="bg-white px-4 py-6 rounded-t-3xl -mt-4">
        {loading ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#0D9F6F" />
            <Text className="text-gray-500 font-pmedium mt-4">Loading completed jobs...</Text>
          </View>
        ) : error ? (
          <View className="items-center py-8">
            <Text className="text-red-500 font-pmedium">{error}</Text>
          </View>
        ) : jobs.length === 0 ? (
          <View className="items-center py-8">
            <Text className="text-gray-500 font-pmedium">No completed jobs found</Text>
          </View>
        ) : (
          <>
            <Text className="text-gray-700 font-pmedium mb-4">
              Showing {jobs.length} completed job{jobs.length !== 1 ? "s" : ""}
            </Text>

            {jobs.map((job) => (
              <View key={job.id} className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
                <View className="p-4">
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1 mr-2">
                      <Text className="text-lg font-pbold text-gray-800">{job.title}</Text>
                      {job.category_name && (
                        <Text className="text-sm font-pregular text-gray-500">{job.category_name}</Text>
                      )}
                    </View>

                    <View className="bg-blue-500 px-3 py-1 rounded-full">
                      <Text className="text-xs text-white font-pmedium">Completed</Text>
                    </View>
                  </View>

                  <View className="flex-row items-center mt-1 mb-3">
                    <Text className="text-gray-600 font-pmedium">Client: {job.client_name}</Text>
                  </View>

                  <View className="h-px bg-gray-100 my-2" />

                  <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-row items-center">
                      <Banknote size={16} color="#0D9F70" />
                      <Text className="text-gray-700 font-pmedium ml-1">
                        {job.currency} {job.amount}
                      </Text>
                    </View>

                    <View className="flex-row items-center">
                      <Calendar size={16} color="#0D9F70" />
                      <Text className="text-gray-700 font-pmedium ml-1">
                        {format(new Date(job.completed_at), "MMM dd, yyyy")}
                      </Text>
                    </View>
                  </View>

                  {job.location_address && (
                    <View className="flex-row items-center mb-3">
                      <MapPin size={16} color="#0D9F70" />
                      <Text className="text-gray-700 font-pmedium ml-1 flex-1">{job.location_address}</Text>
                    </View>
                  )}

                  {job.rating !== null && (
                    <View className="bg-gray-50 p-3 rounded-lg mt-2">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="font-pmedium text-gray-700">Client Review</Text>
                        <View className="flex-row items-center">
                          <Text className="text-gray-700 font-pbold mr-1">{job.rating}/5</Text>
                          {renderStars(job.rating)}
                        </View>
                      </View>

                      {job.review_text && <Text className="text-gray-600 font-pregular">"{job.review_text}"</Text>}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  )
}
