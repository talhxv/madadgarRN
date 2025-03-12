"use client"

import {useEffect, useState} from "react"
import {ScrollView, Text, TouchableOpacity, View} from "react-native"
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
} from "lucide-react-native"
import {supabase} from "@/supabaseClient"
import {useRouter} from "expo-router"

interface ProfileData {
    full_name: string | null
    phone_number: string | null
}

export default function Profile() {
    const [profile, setProfile] = useState<ProfileData>({
        full_name: null,
        phone_number: null,
    })
    const router = useRouter()

    useEffect(() => {
        getUser()
    }, [])

    const getUser = async () => {
        const {
            data: {user},
        } = await supabase.auth.getUser()
        if (user) {
            const {data: profile} = await supabase.from("profiles").select("*").eq("user_id", user.id).single()

            setProfile(profile)
        }
    }

    const formatPhoneNumber = (phoneNumber: string | null) => {
        if (!phoneNumber) return "+92 000 0000000"
        return `+92 ${phoneNumber.slice(2)}`
    }

    // Placeholder data
    const placeholderData = {
        rewards_points: 700,
        average_rating: 3.5,
        stats: {
            bids_pending: 0,
            jobs_completed: 0,
            total_earned: 0,
        },
    }

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
            title: "Reviews & Ratings",
            icon: Star,
            onPress: () => router.push("/reviews"),
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
            style: {backgroundColor: "red"}
        },
    ]

    return (
        <ScrollView className="flex-1 bg-white">
            {/* Header Section */}
            <View className="bg-[#53F3AE] pt-12 pb-8 rounded-b-[40px]">
                {/* Rewards Points */}
                <View className="px-4 flex-row justify-between items-center">
                    <View className="bg-white/20 px-3 py-1 rounded-full flex-row items-center">
                        <Star size={16} color="white"/>
                        <Text className="text-white ml-1 font-pregular">Rewards {placeholderData.rewards_points} points</Text>
                    </View>
                </View>

                {/* Profile Info */}
                <View className="items-center mt-6">
                    <View className="w-24 h-24 bg-white rounded-full overflow-hidden">
                        <View className="w-full h-full bg-gray-100 items-center justify-center">
                            <Text className="text-2xl text-gray-400 font-pregular">{profile.full_name?.[0] || "U"}</Text>
                        </View>
                    </View>

                    <View className="mt-2 items-center">
                        <View className="flex-row items-center">
                            <Star size={16} color="white" fill="white"/>
                            <Text className="text-white ml-1 font-pregular">{placeholderData.average_rating}/5</Text>
                        </View>
                        <Text className="text-white text-2xl font-psemibold mt-2">{profile.full_name || "User Name"}</Text>
                        <Text className="text-white/80 font-pregular">{formatPhoneNumber(profile.phone_number)}</Text>
                    </View>

                    {/* Stats */}
                    <View className="flex-row justify-between w-full px-8 mt-6">
                        <View className="items-center">
                            <Text className="text-white text-2xl font-psemibold">{placeholderData.stats.bids_pending}</Text>
                            <Text className="text-white/80 text-center font-pregular">Bids{"\n"}Pending</Text>
                        </View>
                        <View className="items-center">
                            <Text
                                className="text-white text-2xl font-psemibold">{placeholderData.stats.jobs_completed}</Text>
                            <Text className="text-white/80 text-center font-pregular">Jobs{"\n"}Completed</Text>
                        </View>
                        <View className="items-center">
                            <Text className="text-white text-2xl font-psemibold">{placeholderData.stats.total_earned}</Text>
                            <Text className="text-white/80 text-center font-pregular">PKR{"\n"}Earned</Text>
                        </View>
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
                            className={`w-10 h-10 rounded-full items-center justify-center ${item.title === "Logout" ? "bg-red-300" : "bg-gray-100"}`}>
                            <item.icon size={20} color="#374151"/>
                        </View>
                        <Text className="flex-1 ml-3 text-gray-800 font-pmedium">{item.title}</Text>
                        <ChevronRight size={20} color="#374151"/>
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    )
}