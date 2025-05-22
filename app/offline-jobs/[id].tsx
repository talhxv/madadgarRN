"use client"

import { useEffect, useState } from "react"
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, Image } from "react-native"
import { ArrowLeft, Calendar, MapPin, User, Banknote, Clock, Calendar as CalendarIcon, Star } from "lucide-react-native"
import { useRouter, useLocalSearchParams } from "expo-router"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"

interface OfflineJobDetails {
  id: string
  title: string
  description: string
  expected_budget: number | null
  currency: string
  created_at: string
  updated_at: string
  status: string
  location_address: string
  location_details: string | null
  category_name: string | null
  client_name: string
  client_id: string
  availability_type: string
  preferred_start_date: string | null
  preferred_end_date: string | null
  professional_certification_required: boolean
  images: string[]
  rating: number | null
  review_text: string | null
  review_date: string | null
}

export default function OfflineJobDetails() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useLocalSearchParams()
  const jobId = params.id as string
  const [job, setJob] = useState<OfflineJobDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return

    const fetchJobDetails = async () => {
      try {
        setLoading(true)

        // Fetch the offline job details
        const { data: jobData, error: jobError } = await supabase
          .from("offline_jobs")
          .select(`
            id, 
            title, 
            description, 
            expected_budget, 
            currency, 
            created_at, 
            updated_at,
            status,
            location_address,
            location_details,
            availability_type,
            preferred_start_date,
            preferred_end_date,
            professional_certification_required,
            images,
            category:category_id(name),
            user_id
          `)
          .eq("id", jobId)
          .single()

        if (jobError) throw jobError
        if (!jobData) {
          setError("Job not found")
          return
        }

        // Get client name
        const { data: clientProfile, error: clientError } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("user_id", jobData.user_id)
          .single()

        if (clientError) throw clientError

        // Get review for this job if the current user is the reviewee
        const { data: reviewData, error: reviewError } = await supabase
          .from("job_reviews")
          .select("rating, review_text, created_at")
          .eq("job_id", jobId)
          .eq("reviewee_id", user?.id)
          .maybeSingle()

        if (reviewError) throw reviewError

        // Combine all the data
        setJob({
          id: jobData.id,
          title: jobData.title,
          description: jobData.description,
          expected_budget: jobData.expected_budget,
          currency: jobData.currency,
          created_at: jobData.created_at,
          updated_at: jobData.updated_at,
          status: jobData.status,
          location_address: jobData.location_address,
          location_details: jobData.location_details,
          category_name: jobData.category?.name || null,
          client_name: clientProfile?.full_name || "Unknown Client",
          client_id: jobData.user_id,
          availability_type: jobData.availability_type,
          preferred_start_date: jobData.preferred_start_date,
          preferred_end_date: jobData.preferred_end_date,
          professional_certification_required: jobData.professional_certification_required,
          images: jobData.images || [],
          rating: reviewData?.rating || null,
          review_text: reviewData?.review_text || null,
          review_date: reviewData?.created_at || null,
        })
      } catch (err) {
        console.error("Error fetching offline job details:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch job details")
      } finally {
        setLoading(false)
      }
    }

    fetchJobDetails()
  }, [jobId, user?.id])

  const renderStars = (rating: number | null) => {
    if (rating === null) return null

    return (
      <View className="flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} size={16} color="#FFB800" fill={star <= rating ? "#FFB800" : "transparent"} />
        ))}
      </View>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-[#0D9F70] text-white"
      case "in_progress":
        return "bg-amber-500 text-white"
      case "completed":
        return "bg-blue-500 text-white"
      case "cancelled":
        return "bg-red-500 text-white"
      default:
        return "bg-gray-500 text-white"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "open":
        return "Open"
      case "in_progress":
        return "In Progress"
      case "completed":
        return "Completed"
      case "cancelled":
        return "Cancelled"
      default:
        return status.replace("_", " ")
    }
  }

  const getAvailabilityText = (type: string) => {
    switch (type) {
      case "flexible":
        return "Flexible"
      case "specific_dates":
        return "Specific Dates"
      case "recurring":
        return "Recurring"
      case "immediate":
        return "Immediate"
      default:
        return type.replace("_", " ")
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "Budget not specified"
    return `${job?.currency} ${amount.toLocaleString()}`
  }

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0D9F70" />
        <Text className="mt-4 text-gray-600 font-pmedium">Loading job details...</Text>
      </View>
    )
  }

  if (error || !job) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-4">
        <Text className="text-red-500 font-pmedium text-lg mb-2">Error</Text>
        <Text className="text-gray-700 text-center mb-6">{error || "Job not found"}</Text>
        <TouchableOpacity className="bg-[#0D9F70] px-6 py-3 rounded-xl" onPress={() => router.back()}>
          <Text className="text-white font-pmedium">Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-[#0D9F70] pt-16 pb-6 px-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-psemibold">Offline Job Details</Text>
      </View>

      {/* Content */}
      <View className="bg-white px-4 py-6 rounded-t-3xl -mt-4">
        <View className="flex-row justify-between items-start mb-4">
          <View className="flex-1 mr-3">
            <Text className="text-2xl font-pbold text-gray-800">{job.title}</Text>
            {job.category_name && (
              <Text className="text-base font-pregular text-gray-500 mt-1">{job.category_name}</Text>
            )}
          </View>
          <View className={`px-3 py-1.5 rounded-full ${getStatusColor(job.status)}`}>
            <Text className="text-xs text-white font-pmedium">{getStatusText(job.status)}</Text>
          </View>
        </View>

        {/* Client Info */}
        <View className="flex-row items-center mb-4 bg-gray-50 p-3 rounded-lg">
          <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
            <User size={20} color="#0D9F70" />
          </View>
          <View className="ml-3">
            <Text className="text-gray-500 text-xs font-pregular">Client</Text>
            <Text className="text-gray-800 font-pmedium">{job.client_name}</Text>
          </View>
        </View>

        {/* Images */}
        {job.images && job.images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            {job.images.map((imageUrl, index) => (
              <Image key={index} source={{ uri: imageUrl }} className="w-32 h-32 rounded-lg mr-2" resizeMode="cover" />
            ))}
          </ScrollView>
        )}

        {/* Description */}
        <View className="mb-4">
          <Text className="text-lg font-pmedium text-gray-800 mb-2">Description</Text>
          <Text className="text-gray-600 font-pregular">{job.description}</Text>
        </View>

        {/* Job Details */}
        <View className="bg-gray-50 p-4 rounded-lg mb-4">
          <Text className="text-lg font-pmedium text-gray-800 mb-3">Job Details</Text>

          <View className="flex-row items-center mb-3">
            <Banknote size={18} color="#0D9F70" />
            <Text className="text-gray-700 font-pmedium ml-2">{formatCurrency(job.expected_budget)}</Text>
          </View>

          <View className="flex-row items-center mb-3">
            <Clock size={18} color="#0D9F70" />
            <Text className="text-gray-700 font-pmedium ml-2">
              {getAvailabilityText(job.availability_type)} availability
            </Text>
          </View>

          {job.preferred_start_date && (
            <View className="flex-row items-center mb-3">
              <Calendar size={18} color="#0D9F70" />
              <Text className="text-gray-700 font-pmedium ml-2">
                Preferred start: {format(new Date(job.preferred_start_date), "MMMM d, yyyy")}
              </Text>
            </View>
          )}

          {job.preferred_end_date && (
            <View className="flex-row items-center mb-3">
              <Calendar size={18} color="#0D9F70" />
              <Text className="text-gray-700 font-pmedium ml-2">
                Preferred end: {format(new Date(job.preferred_end_date), "MMMM d, yyyy")}
              </Text>
            </View>
          )}

          <View className="flex-row items-center mb-3">
            <MapPin size={18} color="#0D9F70" />
            <Text className="text-gray-700 font-pmedium ml-2">{job.location_address}</Text>
          </View>

          {job.location_details && (
            <View className="bg-white p-3 rounded-lg mb-3">
              <Text className="text-gray-600 font-pregular">{job.location_details}</Text>
            </View>
          )}

          {job.professional_certification_required && (
            <View className="bg-amber-50 p-3 rounded-lg mb-3">
              <Text className="text-amber-700 font-pmedium">Professional certification required</Text>
            </View>
          )}

          <View className="flex-row items-center">
            <CalendarIcon size={18} color="#0D9F70" />
            <Text className="text-gray-700 font-pmedium ml-2">
              Posted on {format(new Date(job.created_at), "MMMM d, yyyy")}
            </Text>
          </View>
        </View>

        {/* Review Section */}
        {job.rating !== null && (
          <View className="bg-[#E7F7F1] p-4 rounded-lg mb-4">
            <Text className="text-lg font-pmedium text-gray-800 mb-2">Your Review</Text>

            <View className="flex-row items-center mb-2">
              <Text className="text-gray-800 font-pbold mr-2">{job.rating}/5</Text>
              {renderStars(job.rating)}
              {job.review_date && (
                <Text className="text-gray-500 text-xs ml-auto">
                  {format(new Date(job.review_date), "MMM d, yyyy")}
                </Text>
              )}
            </View>

            {job.review_text && <Text className="text-gray-600 font-pregular">"{job.review_text}"</Text>}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
