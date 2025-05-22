"use client"

import { useEffect, useState, useRef } from "react"
import { View, Text, TouchableOpacity, Image, Animated, Alert, ActivityIndicator, Modal, RefreshControl } from "react-native"
import { Bell, Link, MapPin, ChevronDown } from "lucide-react-native"
import { supabase } from "@/supabaseClient"
import { useRouter } from "expo-router"
import { locationService, type UserLocation } from "@/lib/LocationService"
import LocationPicker from "@/components/LocationPicker"
import * as Location from "expo-location"
import { LinearGradient } from "expo-linear-gradient"
import { useAuth } from "@/contexts/AuthContext" // Adjust the path as needed
import ChatButton from "@/components/chat-button" // Import the ChatButton component

export default function Home() {
    const { user, profile } = useAuth()
    const [greeting, setGreeting] = useState("")
    const [showLocationModal, setShowLocationModal] = useState(false)
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
    const [isSavingLocation, setIsSavingLocation] = useState(false)
    const [categories, setCategories] = useState<any[]>([])
    const [isLoadingCategories, setIsLoadingCategories] = useState(true)
    const [formattedAddress, setFormattedAddress] = useState("Set your location")
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter()
    const scrollY = useRef(new Animated.Value(0)).current

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [1, 0.97],
        extrapolate: "clamp",
    })

    const headerHeight = scrollY.interpolate({
        inputRange: [0, 120],
        outputRange: [180, 110], // Try 64 or higher for collapsed height
        extrapolate: "clamp",
    });
    const headerPaddingTop = scrollY.interpolate({
        inputRange: [0, 120],
        outputRange: [48, 8], // Reduce to 8 or even 0
        extrapolate: "clamp",
    });
    const headerPaddingBottom = scrollY.interpolate({
        inputRange: [0, 120],
        outputRange: [24, 8], // Reduce to 8 or even 0
        extrapolate: "clamp",
    });
    const headerContentOpacity = scrollY.interpolate({
        inputRange: [0, 60],
        outputRange: [1, 0],
        extrapolate: "clamp",
    });

    const addressBarTranslateY = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, -10], 
    extrapolate: "clamp",
    });
    // This function will be called when a location is selected on the map
    const handleLocationSelected = (location: UserLocation) => {
        console.log("Location selected:", location)
        setUserLocation(location)
        console.log("After setting location, userLocation state:", userLocation) // This will show the previous state due to closure
    }

    const updateFormattedAddress = async () => {
        if (userLocation) {
            const address = await getFormattedAddress(userLocation.latitude, userLocation.longitude)
            setFormattedAddress(address)
        }
    }

    // Get category icon based on category name
    const getCategoryIcon = (categoryName: string): string => {
        const iconMap: { [key: string]: string } = {
            // Online categories -> need to add moreeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
            "Web Development": "💻",
            "Full Stack Development": "👨‍💻",
            "Mobile App Development": "📱",
            "Cloud Engineering": "☁️",
            "Graphic Designer": "🎨",
            "Content Writer": "✍️",
            "Front-end Development": "🖥️",
            "Digital Marketing": "📱",
            "Video Editor": "🎬",
            "Data Entry": "📊",
            "Virtual Assistant": "📆",
            "Social Media Manager": "📲",

            // Offline/physical categories
            Electrician: "⚡",
            Plumber: "🔧",
            "Interior Design": "🏠",
            Carpenter: "🔨",
            "House Cleaner": "🧹",
            Gardener: "🌱",
            Painter: "🖌️",
            Handyman: "🛠️",
            Mechanic: "🔩",
            Mover: "📦",
            "Personal Trainer": "💪",
        }

        return iconMap[categoryName] || "🔍" // Default icon if not found
    }

    // Fetch categories from Supabase
    const fetchCategories = async (): Promise<void> => {
        try {
            setIsLoadingCategories(true)

            // Fetch online categories sorted by popularity
            const { data: onlineCategories, error: onlineError } = await supabase
                .from("job_categories")
                .select("id, name, type, popularity_score")
                .eq("type", "online")
                .order("popularity_score", { ascending: false })
                .limit(6)

            if (onlineError) throw onlineError

            // Fetch offline categories sorted by popularity
            const { data: offlineCategories, error: offlineError } = await supabase
                .from("job_categories")
                .select("id, name, type, popularity_score")
                .eq("type", "offline")
                .order("popularity_score", { ascending: false })
                .limit(6)

            if (offlineError) throw offlineError

            // Mix online and offline categories
            const mixedCategories = [...onlineCategories, ...offlineCategories].sort(
                (a, b) => b.popularity_score - a.popularity_score,
            )

            // Ensure at least one offline category
            const hasOffline = mixedCategories.slice(0, 6).some((cat) => cat.type === "offline")

            if (!hasOffline && offlineCategories.length > 0) {
                // Find the highest ranked offline category
                const topOffline = offlineCategories[0]
                // Replace the lowest ranked category in the top 6 with this offline category
                if (mixedCategories.length >= 6) {
                    mixedCategories[5] = topOffline
                } else {
                    mixedCategories.push(topOffline)
                }
            }

            // Get the top 6 categories after mixing
            const finalCategories = mixedCategories.slice(0, 6).map((category) => ({
                ...category,
                icon: getCategoryIcon(category.name),
            }))

            setCategories(finalCategories)
        } catch (error) {
            console.error("Error fetching categories:", error)
            // Fallback to default categories if there's an error
            setCategories([
                { name: "Web Developer", icon: "💻", type: "online" },
                { name: "Electrician", icon: "⚡", type: "offline" },
                { name: "Plumber", icon: "🔧", type: "offline" },
                { name: "Graphic Designer", icon: "🎨", type: "online" },
                { name: "Carpenter", icon: "🔨", type: "offline" },
                { name: "Content Writer", icon: "✍️", type: "online" },
            ])
        } finally {
            setIsLoadingCategories(false)
        }
    }

    // New function to fetch location data
    const fetchUserLocation = async (): Promise<void> => {
        try {
            if (!user) return

            // Fetch the latest location for the user
            const { data: latestLocation, error: locationError } = await supabase
                .from("locations")
                .select("*")
                .eq("user_id", user.id)
                .order("updated_at", { ascending: false })
                .limit(1)
                .single()

            if (locationError) {
                // For first-time users, set a default message instead of showing an error
                if (locationError.code === 'PGRST116') { // No rows returned error
                    setFormattedAddress("Set your first location")
                    return
                }
                console.error("Error fetching latest location:", locationError)
            } else if (latestLocation) {
                console.log("Latest location data:", latestLocation)

                // If we already have the address, use it directly
                if (latestLocation.address) {
                    setFormattedAddress(latestLocation.address)
                }

                // Try to extract coordinates from the geom field
                if (latestLocation.geom) {
                    let lat, lng

                    // Handle different possible formats
                    try {
                        if (typeof latestLocation.geom === "string") {
                            // If it's a string like "POINT(lng lat)"
                            const match = latestLocation.geom.match(/POINT$$([^ ]+) ([^)]+)$$/)
                            if (match) {
                                lng = Number.parseFloat(match[1])
                                lat = Number.parseFloat(match[2])
                            }
                        } else if (latestLocation.geom.coordinates) {
                            // If it's a GeoJSON format
                            lng = latestLocation.geom.coordinates[0]
                            lat = latestLocation.geom.coordinates[1]
                        } else if (latestLocation.geom.value) {
                            // Some PostGIS formats include a "value" property
                            const match = latestLocation.geom.value.match(/POINT$$([^ ]+) ([^)]+)$$/)
                            if (match) {
                                lng = Number.parseFloat(match[1])
                                lat = Number.parseFloat(match[2])
                            }
                        }

                        if (lat && lng) {
                            setUserLocation({ latitude: lat, longitude: lng })

                            // If we don't have an address yet, get it
                            if (!latestLocation.address) {
                                getFormattedAddress(lat, lng)
                                    .then((address) => setFormattedAddress(address))
                                    .catch((err) => console.error("Error formatting address:", err))
                            }
                        }
                    } catch (error) {
                        console.error("Error parsing geom data:", error, latestLocation.geom)
                    }
                }
            }
        } catch (error) {
            console.error("Failed to get location data:", error)
        }
    }

    // This function will save the location to Supabase when the confirm button is pressed
    const saveLocationToDatabase = async () => {
        try {
            if (!user) {
                Alert.alert("Error", "You need to be logged in")
                return
            }

            let locationToSave = userLocation
            if (!locationToSave) {
                locationToSave = await locationService.getCurrentLocation()
            }

            if (!locationToSave) {
                Alert.alert("Error", "No location selected")
                return
            }

            const address = await getFormattedAddress(locationToSave.latitude, locationToSave.longitude)
            const point = `POINT(${locationToSave.longitude} ${locationToSave.latitude})`

            const { error: insertError } = await supabase.from("locations").insert({
                user_id: user.id,
                geom: point,
                accuracy: locationToSave.accuracy || 0,
                address,
            })

            if (insertError) {
                console.error("Error inserting location:", insertError)
                Alert.alert("Error", "Failed to save location")
                return
            }

            setUserLocation(locationToSave)
            setFormattedAddress(address)
            Alert.alert("Success", "Your location has been updated")
            setShowLocationModal(false)
        } catch (error) {
            console.error("Error in saveLocationToDatabase:", error)
            Alert.alert("Error", "Failed to save location. Please try again.")
        } finally {
            setIsSavingLocation(false)
        }
    }

    useEffect(() => {
        console.log("userLocation state changed:", userLocation)
        if (userLocation) {
            updateFormattedAddress()
        }
    }, [userLocation])

    // Helper function to get a formatted address
    const getFormattedAddress = async (latitude: number, longitude: number): Promise<string> => {
        if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
            console.error("Invalid coordinates:", { latitude, longitude })
            return "Location unavailable"
        }
        try {
            const reverseGeocode = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            })

            if (reverseGeocode.length > 0) {
                const location = reverseGeocode[0]
                return [location.name, location.street, location.city, location.region, location.postalCode, location.country]
                    .filter(Boolean)
                    .join(", ")
            }

            return "Location selected"
        } catch (error) {
            console.error("Error getting address:", error)
            return "Location selected"
        }
    }

    useEffect(() => {
        setGreetingTime()
        fetchCategories()

        // Call fetchUserLocation when user changes
        if (user) {
            fetchUserLocation()
        } else {
            // Try to refresh user data if not available
            const checkUserSession = async () => {
                try {
                    const { data } = await supabase.auth.getSession()
                    if (data.session) {
                        // If we have a session but no user in context, refresh the auth context
                        const { refreshUser } = useAuth()
                        if (refreshUser) await refreshUser()
                    }
                } catch (error) {
                    console.error("Error checking session:", error)
                }
            }
            checkUserSession()
        }
    }, [user]) // This will run the effect when user changes

    const setGreetingTime = () => {
        const hour = new Date().getHours()
        if (hour < 12) setGreeting("Good morning")
        else if (hour < 18) setGreeting("Good afternoon")
        else setGreeting("Good evening")
    }

    // Render skeleton loading UI for categories
    const renderCategorySkeleton = () => {
        // Create an array of 6 items to match the number of categories
        return (
            <View className="flex-row flex-wrap justify-between gap-y-4">
                {[...Array(6)].map((_, index) => (
                    <View
                        key={index}
                        className="w-[48%] aspect-square rounded-3xl bg-gray-200 p-4 justify-between overflow-hidden"
                    >
                        <View className="h-8 w-8 bg-gray-300 rounded-md self-end" />
                        <View className="h-8 w-24 bg-gray-300 rounded-2xl self-start" />
                    </View>
                ))}
            </View>
        )
    }

    // Create a refresh function that calls all your data fetching functions
    const onRefresh = async () => {
      try {
        setRefreshing(true);
        
        // Refresh greeting based on time of day
        setGreetingTime();
        
        // Refetch categories
        await fetchCategories();
        
        // Refetch user location if user is available
        if (user) {
          await fetchUserLocation();
        }
        
        // You can add more refresh logic here
        
      } catch (error) {
        console.error("Error refreshing data:", error);
        Alert.alert("Error", "Failed to refresh data. Please try again.");
      } finally {
        setRefreshing(false);
      }
    };

    return (
        <View className="flex-1 bg-white">
            <Animated.View
                className="px-4 absolute top-0 left-0 right-0"
                style={{
                    height: headerHeight,
                    paddingTop: headerPaddingTop,
                    paddingBottom: 18,
                    borderBottomRightRadius: 70,
                    backgroundColor: undefined,
                    zIndex: 10,          // Ensure this is lower than the refresh control's z-index
                }}
            >
                <LinearGradient
                    colors={["#0D9F6F", "#0F766E"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderBottomRightRadius: 70 }}
                />
                {/* Only fade out this section */}
                <Animated.View style={{ opacity: headerContentOpacity }}>
                    <View className="flex-row justify-between items-center">
                        <View>
                            <Text className="text-white text-lg font-psemibolditalic">{greeting},</Text>
                            <Text className="text-white text-3xl font-psemibold flex-row items-center">
                                {(profile?.full_name || "User").split(" ")[0]} 👋
                            </Text>
                        </View>
                        <View className="flex-row gap-4">
                            <TouchableOpacity>
                                <View className="relative">
                                    <Bell size={24} color="white" />
                                    <View className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
                                </View>
                            </TouchableOpacity>
                            <ChatButton />
                        </View>
                    </View>
                </Animated.View>
                {/* This section is always visible */}
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <Animated.View style={{ transform: [{ translateY: addressBarTranslateY }] }}>
                        <TouchableOpacity
                            onPress={() => setShowLocationModal(true)}
                            className="bg-white/20 px-4 py-2.5 rounded-full w-2/3 flex-row items-center mt-3"
                            activeOpacity={0.7}
                        >
                            <MapPin size={18} color="white" />
                            <View className="flex-1 ml-2 mr-1">
                                <Text className="text-white/80 text-xs font-pmedium">Current Location</Text>
                                <Text className="text-white font-psemibold" numberOfLines={1}>
                                    {formattedAddress}
                                </Text>
                            </View>
                            <ChevronDown size={16} color="white" />
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Animated.View>

            <Modal
                visible={showLocationModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowLocationModal(false)}
            >
                <View className="flex-1 bg-black/50 justify-center items-center px-4">
                    <View className="bg-white rounded-2xl w-full max-w-md" style={{ height: "75%" }}>
                        <View className="p-4 flex-1">
                            {/* Modal Header */}
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-xl font-pbold">Set Your Location</Text>
                                <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                                    <Text className="text-gray-500 text-lg">Cancel</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Location Picker */}
                            <View className="flex-1 mb-4">
                                <LocationPicker
                                    userId={user?.id}
                                    onLocationSelected={handleLocationSelected}
                                    initialRegion={
                                        userLocation
                                            ? {
                                                latitude: userLocation.latitude,
                                                longitude: userLocation.longitude,
                                                latitudeDelta: 0.0922,
                                                longitudeDelta: 0.0421,
                                            }
                                            : undefined // Will use default region from LocationPicker
                                    }
                                />
                            </View>

                            {/* Confirm Button */}
                            <TouchableOpacity
                                className={`bg-[#0D9F6F] py-3 rounded-xl mb-2 ${isSavingLocation ? "opacity-70" : ""}`}
                                onPress={saveLocationToDatabase}
                                disabled={isSavingLocation || !userLocation}
                            >
                                <Text className="text-center font-psemibold text-lg text-white">
                                    {isSavingLocation ? "Saving..." : "Confirm Location"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Scrollable Content */}
            <Animated.ScrollView
                className="flex-1"
                contentContainerStyle={{ 
                  paddingTop: 220,       // Increase from 201 to 220
                  paddingBottom: 100 
                }}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                scrollEventThrottle={16}
                contentInset={{ top: 10 }}  // Add this line to create space for the indicator
                contentOffset={{ y: -10 }}  // Add this line to prevent initial scroll offset
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#0D9F6F"
                    colors={["#0D9F6F", "#0F766E"]}
                    progressBackgroundColor="#ffffff"
                    progressViewOffset={100}  // Increase this value from 60 to 100
                    style={{ zIndex: 99 }}    // Increase z-index to ensure it's above everything
                    android_offsetTop={60} // For Android compatibility
                  />
                }
            >
                {/* You can update your header section to show when data is refreshing
                This is optional but provides more visual feedback */}
                {refreshing && (
                  <View className="absolute top-0 left-0 right-0 items-center bg-[#0D9F6F]/10 py-1">
                    <Text className="text-[#0D9F6F] font-pmedium">Updating...</Text>
                  </View>
                )}

                {/* View Jobs Section */}
                <View className="px-4">
                    <Text className="text-xl font-psemibold text-[#333333]">View Jobs</Text>
                    <Text className="text-gray-500 font-pmediumitalic text-base mt-1 mb-4">Browse active Jobs near you</Text>

                    <View className="bg-[#00684A] p-5 rounded-3xl relative">
                        {/* Left section with icons - limit width to leave room for image */}
                        <View className="w-2/3">
                            <View className="flex-row">
                                {/* Online icon */}
                                <View className="items-center mr-8">
                                    <TouchableOpacity
                                        className="bg-white ml-4 p-4 rounded-full items-center justify-center w-16 h-16 mb-2"
                                        onPress={() => router.push("/view/online-jobs")}
                                    >
                                        <Link size={24} color="#000000" />
                                    </TouchableOpacity>
                                    <Text className="text-white ml-4 font-pmedium">Online</Text>
                                </View>

                                {/* Physical icon */}
                                <View className="items-center">
                                    <TouchableOpacity
                                        className="bg-white ml-4 p-4 rounded-full items-center justify-center w-16 h-16 mb-2"
                                        onPress={() => router.push("/view/offline-jobs")}
                                    >
                                        <Image
                                            source={require("@/assets/images/physicalicon.png")}
                                            style={{ width: 32, height: 32 }}
                                            tintColor="#000000"
                                        />
                                    </TouchableOpacity>
                                    <Text className="text-white ml-4 font-pmedium">Physical</Text>
                                </View>
                            </View>
                        </View>

                        {/* Person image on the right */}
                        <Image
                            source={require("@/assets/images/personstanding.png")}
                            style={{ width: 180, height: 200, right: -20 }}
                            className="absolute bottom-0"
                            resizeMode="contain"
                        />
                    </View>
                </View>

                {/* Categories Section */}
                <View className="px-4 mt-3 mb-6">
                    <View className="flex-row justify-between items-center mb-1">
                        <Text className="text-xl mt-2 font-psemibold text-[#333333]">Top Categories near you</Text>
                        <Text className="text-[#4A90E2] font-psemibold">See All</Text>
                    </View>

                    <Text className="text-gray-600 font-pmediumitalic mb-4">Find your category of service</Text>

                    {isLoadingCategories ? (
                        <View>
                            <View className="items-center mb-4">
                                <ActivityIndicator size="large" color="#0D9F6F" />
                            </View>
                            {renderCategorySkeleton()}
                        </View>
                    ) : (
                        <View className="flex-row flex-wrap justify-between gap-y-4">
                            {categories.map((category, index) => (
                                <TouchableOpacity
                                    key={index}
                                    className="w-[48%] aspect-square rounded-3xl p-4 justify-between overflow-hidden"
                                    onPress={() => {
                                        if (category.type === "online") {
                                            router.push("/view/online-jobs")
                                        } else if (category.type === "offline") {
                                            router.push("/view/offline-jobs")
                                        }
                                    }}
                                >
                                    <LinearGradient
                                        colors={index % 2 === 0 ? ["#0D9F6F", "#0F766E"] : ["#0F766E", "#0D9F6F"]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
                                    />
                                    <Text className="text-3xl self-end text-left">{category.icon}</Text>
                                    <View className="bg-white rounded-2xl py-1 px-3 self-start">
                                        <Text className="text-gray-800 font-psemibold text-md">{category.name}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </Animated.ScrollView>
        </View>
    )
}
