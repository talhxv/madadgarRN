"use client"
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from "react-native"
import {
  Bell,
  ChevronRight,
  Clock,
  HelpCircle,
  LogOut,
  MessageSquare,
  Settings,
  Share2,
  Shield,
  Star,
  UserCircle,
  Wallet,
  Send,
  FileText,
} from "lucide-react-native"
import { useRouter } from "expo-router"
import { LinearGradient } from "expo-linear-gradient"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { useRatings } from "@/lib/hooks/useRatings"
import { useProfileStats } from "@/lib/hooks/userProfileStats"
import { useProposalsSent } from "@/lib/hooks/useProposalsSent"
import { useState, useEffect } from "react"
import { Image } from 'expo-image'

interface ProfileData {
  full_name: string | null
  phone_number: string | null
}

export default function Profile() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const { averageRating, totalReviews, isLoading: ratingsLoading } = useRatings()
  const { bidsPending, jobsCompleted, totalEarned, isLoading: statsLoading } = useProfileStats()
  const { total: proposalsSent, isLoading: proposalsLoading } = useProposalsSent()
  const [profilePicture, setProfilePicture] = useState<string | null>(null)

  const formatPhoneNumber = (phoneNumber: string | null) => {
    if (!phoneNumber) return "+92 000 0000000"
    return `+92 ${phoneNumber.slice(2)}`
  }

  // Placeholder data for rewards points only
  const rewardsPoints = 700

  const menuItems = [
    {
      title: "Edit Profile",
      icon: UserCircle,
      onPress: () => router.push("/profile/edit"),
    },
    {
      title: "Earnings Dashboard",
      icon: Wallet,
      onPress: () => router.push("/earnings"),
    },
    {
      title: "Job History",
      icon: Clock,
      onPress: () => router.push("/jobs/history"),
    },
    {
      title: "Proposals Sent",
      icon: FileText, // You might want to use a different icon like FileText or Send
      badge: proposalsLoading ? null : proposalsSent > 0 ? proposalsSent : null,
      onPress: () => router.push("/proposals/sent"),
    },
    {
      title: "Reviews & Ratings",
      icon: Star,
      onPress: () => router.push("/reviews/completed-jobs"),
    },
    {
      title: "Messages",
      icon: MessageSquare,
      onPress: () => router.push("/messages"),
    },
    {
      title: "Notifications",
      icon: Bell,
      onPress: () => router.push("/notifications"),
    },
    {
      title: "Settings",
      icon: Settings,
      onPress: () => router.push("/settings"),
    },
    {
      title: "Privacy & Security",
      icon: Shield,
      onPress: () => router.push("/privacy"),
    },
    {
      title: "Help & Support",
      icon: HelpCircle,
      onPress: () => router.push("/support"),
    },
    {
      title: "Share App",
      icon: Share2,
      onPress: () => {
        /* Implement share functionality */
      },
    },
    {
      title: "Logout",
      icon: LogOut,
      onPress: async () => {
        await supabase.auth.signOut()
        router.replace("/login")
      },
      style: { backgroundColor: "red" },
    },
  ]

  // Format currency with commas
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-PK")
  }

  const fetchProfilePicture = async () => {
    if (!user) return;
    
    try {
      // Get the extended profile to get the avatar_url
      const { data: extendedProfileData, error } = await supabase
        .from("extended_profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .single();
      
      if (error) {
        console.error("Error fetching profile picture:", error);
        return;
      }
      
      // Check if avatar_url exists
      if (extendedProfileData?.avatar_url) {
        // Get the public URL
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(extendedProfileData.avatar_url);
          
        if (publicUrlData) {
          setProfilePicture(publicUrlData.publicUrl);
        }
      }
    } catch (error) {
      console.error("Error fetching profile picture:", error);
    }
  }

  useEffect(() => {
    fetchProfilePicture();
  }, [user]);

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Header Section */}
      <View className="pt-12 pb-8 rounded-b-[40px] overflow-hidden">
        <LinearGradient
          colors={["#0D9F6F", "#0F766E"]} // From emerald to teal
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
        {/* Rewards Points */}
        <View className="px-4 flex-row justify-between items-center">
          <View className="bg-white/20 px-3 py-1 rounded-full flex-row items-center">
            <Star size={16} color="white" />
            <Text className="text-white ml-1 font-pregular">Rewards {rewardsPoints} points</Text>
          </View>
        </View>

        {/* Profile Info */}
        <View className="items-center mt-6">
          <View className="w-24 h-24 bg-white rounded-full overflow-hidden">
            {profilePicture ? (
              <Image
                source={{ uri: profilePicture }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View className="w-full h-full bg-gray-100 items-center justify-center">
                <Text className="text-2xl text-gray-400 font-pregular">{profile?.full_name?.[0] || "U"}</Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View className="mt-2 items-center">
            <TouchableOpacity onPress={() => router.push("/reviews")} className="flex-row items-center">
              {ratingsLoading ? (
                <Text className="text-white ml-1 font-pregular">Loading...</Text>
              ) : totalReviews > 0 ? (
                <View className="bg-white/20 px-3 py-1 rounded-full flex-row items-center">
                  <Text className="text-white font-psemibold">{averageRating}/5</Text>
                  <Text className="text-white ml-1 font-pregular">({totalReviews})</Text>
                </View>
              ) : (
                <View className="bg-white/20 px-3 py-1 rounded-full flex-row items-center">
                  <Star size={16} color="white" fill="white" />
                  <Text className="text-white ml-1 font-pregular">No reviews yet</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text className="text-white text-2xl font-psemibold mt-2">{profile?.full_name || "User Name"}</Text>
            <Text className="text-white/80 font-pregular">{formatPhoneNumber(profile?.phone_number)}</Text>
          </View>

          <View className="flex-row justify-between w-full px-8 mt-6">
            {/* Bids Pending */}
            <TouchableOpacity className="items-center" onPress={() => router.push("/proposals/sent")} activeOpacity={0.7}>
              {statsLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white text-2xl font-psemibold">{bidsPending}</Text>
              )}
              <Text className="text-white/80 text-center font-pregular">Proposals{"\n"}Pending</Text>
            </TouchableOpacity>

            {/* Jobs Completed */}
            <TouchableOpacity
              className="items-center"
              onPress={() => router.push("/reviews/completed-jobs")}
              activeOpacity={0.7}
            >
              {statsLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white text-2xl font-psemibold">{jobsCompleted}</Text>
              )}
              <Text className="text-white/80 text-center font-pregular">Jobs{"\n"}Completed</Text>
            </TouchableOpacity>

            {/* Total Earned */}
            <TouchableOpacity className="items-center" onPress={() => router.push("/earnings/index")} activeOpacity={0.7}>
              {statsLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white text-2xl font-psemibold">
                  {totalEarned > 0 ? formatCurrency(totalEarned) : 0}
                </Text>
              )}
              <Text className="text-white/80 text-center font-pregular">PKR{"\n"}Earned</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Menu Items */}
      <View className="px-4 py-6">
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            onPress={item.onPress}
            className="flex-row items-center py-4 border-b border-gray-100"
          >
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${item.title === "Logout" ? "bg-red-300" : "bg-gray-100"}`}
            >
              <item.icon size={20} color="#374151" />
            </View>
            <Text className="flex-1 ml-3 text-gray-800 font-pmedium">{item.title}</Text>
            <ChevronRight size={20} color="#374151" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}
