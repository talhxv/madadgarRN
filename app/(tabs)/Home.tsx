"use client"

import { useEffect, useState, useRef } from "react"
import { View, Text, TouchableOpacity, Image, Animated } from "react-native"
import { Bell, MessageCircle, Link, MapPin } from "lucide-react-native"
import { supabase } from "@/supabaseClient"
import { useRouter } from "expo-router"

export default function Home() {
    const [user, setUser] = useState<any>(null)
    const [greeting, setGreeting] = useState("")
    const [showLocationModal, setShowLocationModal] = useState(false)
    const router = useRouter()
    const scrollY = useRef(new Animated.Value(0)).current

    useEffect(() => {
        getUser()
        setGreetingTime()
    }, [])

    const getUser = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser()
        if (user) {
            const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single()

            setUser(profile)
        }
    }

    const setGreetingTime = () => {
        const hour = new Date().getHours()
        if (hour < 12) setGreeting("Good morning")
        else if (hour < 18) setGreeting("Good afternoon")
        else setGreeting("Good evening")
    }

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [1, 0.97],
        extrapolate: "clamp",
    })

    return (
        <View className="flex-1 bg-white">
            <Animated.View
                className="bg-[#53F3AE] pt-12 pb-4 px-4 absolute top-0 left-0 right-0 z-10"
                style={{
                    opacity: headerOpacity,
                    borderBottomRightRadius: 70,
                }}
            >
                <View className="flex-row justify-between items-center">
                    <View>
                        <Text className="text-white text-lg font-semibold">{greeting},</Text>
                        <Text className="text-white text-3xl font-semibold flex-row items-center">
                            {(user?.full_name || "User").split(" ")[0]} 👋
                        </Text>
                    </View>
                    <View className="flex-row gap-4">
                        <TouchableOpacity>
                            <View className="relative">
                                <Bell size={24} color="white" />
                                <View className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity>
                            <MessageCircle size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>

            <Animated.ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingTop: 100 }}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                scrollEventThrottle={16}
            >
                {/* Location Section */}
                <TouchableOpacity onPress={() => setShowLocationModal(true)} className="px-4 py-6">
                    <Text className="text-gray-500 text-base">Current Location</Text>
                    <View className="flex-row items-center mt-1">
                        <MapPin size={20} color="#374151" />
                        <Text className="text-gray-800 text-lg font-semibold ml-2">{user?.address || "Set your location"}</Text>
                    </View>
                </TouchableOpacity>

                {/* View Jobs Section */}
                <View className="px-4">
                    <Text className="text-2xl font-bold text-gray-800">View Jobs</Text>
                    <Text className="text-gray-500 text-base mt-1 mb-4">Browse active Jobs near you</Text>

                    <View className="bg-[#53F3AE]/20 p-6 rounded-3xl flex-row items-center relative">
                        <View className="flex-1 flex-row space-x-4">
                            <TouchableOpacity
                                className="bg-white p-4 rounded-full items-center justify-center w-16 h-16"
                                onPress={() => router.push("/online-jobs")}
                            >
                                <Link size={24} color="#53F3AE" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="bg-white p-4 rounded-full items-center justify-center w-16 h-16"
                                onPress={() => router.push("/physical-jobs")}
                            >
                                <Image source={require("@/assets/images/physicalicon.png")} className="w-6 h-6" tintColor="#53F3AE" />
                            </TouchableOpacity>
                        </View>

                        <Image
                            source={require("@/assets/images/personstanding.png")}
                            className="w-32 h-32 absolute right-2 bottom-0"
                            resizeMode="contain"
                        />
                    </View>
                </View>

                {/* Categories Section */}
                <View className="px-4 mb-20">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-2xl font-bold text-gray-800">Top Categories near you</Text>
                        <Text className="text-[#53F3AE] font-semibold">See All</Text>
                    </View>

                    <Text className="text-gray-600 mb-4">Find your category of service</Text>

                    <View className="flex-row flex-wrap justify-between gap-y-4">
                        {[
                            { title: "Electrician", icon: "⚡" },
                            { title: "Web Developer", icon: "💻" },
                            { title: "Plumber", icon: "🔧" },
                            { title: "Carpenter", icon: "🔨" },
                        ].map((category, index) => (
                            <TouchableOpacity
                                key={index}
                                className="w-[48%] aspect-square bg-[#53F3AE] rounded-3xl p-4 justify-between"
                                onPress={() => router.push(`/category/${category.title.toLowerCase()}`)}
                            >
                                <Text className="text-4xl">{category.icon}</Text>
                                <View className="bg-white rounded-full py-2 px-4 self-start">
                                    <Text className="text-gray-800 font-semibold">{category.title}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Animated.ScrollView>
        </View>
    )
}

