"use client"

import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl } from "react-native"
import { ArrowLeft, Banknote, Calendar, ChevronRight, DollarSign, TrendingUp, Briefcase } from "lucide-react-native"
import { useRouter } from "expo-router"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { format } from "date-fns"

type EarningJob = {
  id: string
  title: string
  client_name: string
  amount: number
  currency: string
  completed_at: string
  job_type: "online" | "offline"
}

export default function EarningsDashboard() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedJobs, setCompletedJobs] = useState<EarningJob[]>([])
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [averageJobValue, setAverageJobValue] = useState(0)
  const [currency, setCurrency] = useState("PKR") // Default currency

  useEffect(() => {
    if (user) {
      fetchEarnings()
    }
  }, [user])

  const fetchEarnings = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Fetch completed online jobs for this user
      const { data: onlineJobs, error: onlineError } = await supabase
        .from("jobs")
        .select("id, title, amount, currency, updated_at")
        .eq("user_id", user.id)
        .eq("status", "completed")

      if (onlineError) throw onlineError

      // Fetch completed offline jobs for this user
      const { data: offlineJobs, error: offlineError } = await supabase
        .from("offline_jobs")
        .select("id, title, expected_budget, currency, updated_at")
        .eq("user_id", user.id)
        .eq("status", "completed")

      if (offlineError) throw offlineError

      // Build earnings array
      const onlineEarnings: EarningJob[] = (onlineJobs || []).map((job) => ({
        id: job.id,
        title: job.title,
        client_name: "N/A",
        amount: Number(job.amount),
        currency: job.currency,
        completed_at: job.updated_at,
        job_type: "online",
      }))

      const offlineEarnings: EarningJob[] = (offlineJobs || []).map((job) => ({
        id: job.id,
        title: job.title,
        client_name: "N/A",
        amount: Number(job.expected_budget),
        currency: job.currency,
        completed_at: job.updated_at,
        job_type: "offline",
      }))

      // Combine and sort
      const allEarnings = [...onlineEarnings, ...offlineEarnings].sort(
        (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      )

      // Calculate totals
      const total = allEarnings.reduce((sum, job) => sum + (job.amount || 0), 0)
      const average = allEarnings.length > 0 ? total / allEarnings.length : 0

      setTotalEarnings(total)
      setAverageJobValue(average)
      setCompletedJobs(allEarnings)
      if (allEarnings.length > 0) setCurrency(allEarnings[0].currency)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch earnings")
      setTotalEarnings(0)
      setAverageJobValue(0)
      setCompletedJobs([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchEarnings()
  }

  const formatCurrency = (amount: number) => {
    return `${currency} ${amount.toLocaleString()}`
  }

  const renderJobItem = ({ item }: { item: EarningJob }) => (
    <TouchableOpacity
      className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
      onPress={() => {
        if (item.id === "placeholder") return // Don't navigate for placeholder jobs
        if (item.job_type === "online") {
          router.push(`/jobs/${item.id}`)
        } else {
          router.push(`/offline-jobs/${item.id}`)
        }
      }}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-2">
          <Text className="text-lg font-pmedium text-gray-800" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-gray-500 text-sm mt-1 font-pregular">Client: {item.client_name}</Text>
        </View>
        <View className="bg-[#E7F7F1] px-3 py-1.5 rounded-full">
          <Text className="text-[#0D9F70] text-xs font-pmedium capitalize">{item.job_type}</Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center mt-3">
        <View className="flex-row items-center">
          <Banknote size={16} color="#0D9F70" />
          <Text className="text-gray-800 font-pbold ml-1">
            {item.currency} {item.amount.toLocaleString()}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Calendar size={16} color="#0D9F70" />
          <Text className="text-gray-600 text-sm ml-1 font-pregular">
            {format(new Date(item.completed_at), "MMM dd, yyyy")}
          </Text>
        </View>
      </View>

      {item.id !== "placeholder" && (
        <View className="flex-row items-center justify-end mt-2">
          <Text className="text-[#0D9F70] font-pmedium mr-1">View Details</Text>
          <ChevronRight size={16} color="#0D9F70" />
        </View>
      )}
    </TouchableOpacity>
  )

  const EmptyState = () => (
    <View className="flex-1 justify-center items-center p-6">
      <Briefcase size={48} color="#ccc" />
      <Text className="text-xl font-pbold text-gray-800 mb-2 mt-4">No earnings yet</Text>
      <Text className="text-gray-600 text-center mb-6 font-pregular">
        Complete jobs to start tracking your earnings here
      </Text>
      <TouchableOpacity className="bg-[#0D9F70] py-3 px-6 rounded-xl" onPress={() => router.push("/jobs")}>
        <Text className="text-white font-pmedium">Browse Jobs</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-[#0D9F70] pt-12 pb-6 px-4">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-psemibold">Earnings Dashboard</Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0D9F70" />
          <Text className="mt-4 text-gray-600 font-pmedium">Loading your earnings...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-red-500 mb-2 font-pmedium">Error loading earnings</Text>
          <Text className="text-gray-600 mb-4 font-pregular">{error}</Text>
          <TouchableOpacity className="bg-[#0D9F70] px-6 py-3 rounded-xl" onPress={fetchEarnings}>
            <Text className="text-white font-pmedium">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Earnings Summary */}
          <View className="bg-white mx-4 -mt-4 rounded-xl shadow-sm p-5 border border-gray-100">
            <View className="flex-row items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-[#E7F7F1] items-center justify-center">
                <DollarSign size={24} color="#0D9F70" />
              </View>
              <View className="ml-3">
                <Text className="text-gray-500 text-sm font-pregular">Total Earnings</Text>
                <Text className="text-2xl font-pbold text-gray-800">{formatCurrency(totalEarnings)}</Text>
              </View>
            </View>

            <View className="flex-row justify-between">
              <View className="flex-1 bg-gray-50 rounded-lg p-3 mr-2">
                <View className="flex-row items-center">
                  <Briefcase size={16} color="#0D9F70" />
                  <Text className="text-gray-500 text-xs ml-1 font-pregular">Completed Jobs</Text>
                </View>
                <Text className="text-lg font-pbold text-gray-800 mt-1">{completedJobs.length}</Text>
              </View>

              <View className="flex-1 bg-gray-50 rounded-lg p-3 ml-2">
                <View className="flex-row items-center">
                  <TrendingUp size={16} color="#0D9F70" />
                  <Text className="text-gray-500 text-xs ml-1 font-pregular">Average Job Value</Text>
                </View>
                <Text className="text-lg font-pbold text-gray-800 mt-1">{formatCurrency(averageJobValue)}</Text>
              </View>
            </View>
          </View>

          {/* Completed Jobs List */}
          <View className="flex-1 px-4 mt-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-pbold text-gray-800">Completed Jobs</Text>
              <Text className="text-gray-500 text-sm font-pregular">{completedJobs.length} jobs</Text>
            </View>

            {completedJobs.length === 0 ? (
              <EmptyState />
            ) : (
              <FlatList
                data={completedJobs}
                renderItem={renderJobItem}
                keyExtractor={(item) => `${item.job_type}-${item.id}`}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0D9F70"]} />}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </View>
        </>
      )}
    </View>
  )
}
