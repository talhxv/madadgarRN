"use client"

import { useEffect, useState, useRef } from "react"
import { View, Text, TouchableOpacity, Image, Animated, Alert } from "react-native"
import { Bell, MessageCircle, Link, MapPin } from "lucide-react-native"
import { supabase } from "@/supabaseClient"
import { useRouter } from "expo-router"
import { locationService, type UserLocation } from "@/lib/LocationService"
import LocationPicker from "@/components/LocationPicker"
import * as Location from "expo-location"

export default function Home() {
    const [user, setUser] = useState<any>(null)
    const [greeting, setGreeting] = useState("")
    const [showLocationModal, setShowLocationModal] = useState(false)
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
    const [isSavingLocation, setIsSavingLocation] = useState(false)
    const [formattedAddress, setFormattedAddress] = useState("Set your location");
    const router = useRouter()
    const scrollY = useRef(new Animated.Value(0)).current

    // This function will be called when a location is selected on the map
    const handleLocationSelected = (location: UserLocation) => {
        console.log("Location selected:", location)
        setUserLocation(location)
        console.log("After setting location, userLocation state:", userLocation) // This will show the previous state due to closure
    }
    const updateFormattedAddress = async () => {
        if (userLocation) {
            const address = await getFormattedAddress(userLocation.latitude, userLocation.longitude);
            setFormattedAddress(address);
        }
    };
    // This function will save the location to Supabase when the confirm button is pressed
    const saveLocationToDatabase = async () => {
        try {
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

            if (authError || !authUser) {
                console.error("Auth error or no user:", authError);
                Alert.alert("Error", "You need to be logged in");
                return;
            }

            let locationToSave = userLocation;
            if (!locationToSave) {
                locationToSave = await locationService.getCurrentLocation();
            }

            if (!locationToSave) {
                Alert.alert("Error", "No location selected");
                return;
            }

            const address = await getFormattedAddress(locationToSave.latitude, locationToSave.longitude);
            const point = `POINT(${locationToSave.longitude} ${locationToSave.latitude})`;

            const { error: insertError } = await supabase.from("locations").insert({
                user_id: authUser.id,
                geom: point,
                accuracy: locationToSave.accuracy || 0,
                address
            });

            if (insertError) {
                console.error("Error inserting location:", insertError);
                Alert.alert("Error", "Failed to save location");
                return;
            }

            setUserLocation(locationToSave);
            setFormattedAddress(address);
            Alert.alert("Success", "Your location has been updated");
            setShowLocationModal(false);
        } catch (error) {
            console.error("Error in saveLocationToDatabase:", error);
            Alert.alert("Error", "Failed to save location. Please try again.");
        } finally {
            setIsSavingLocation(false);
        }
    };

    useEffect(() => {
        console.log("userLocation state changed:", userLocation);
        if (userLocation) {
            updateFormattedAddress();
        }
    }, [userLocation]);

    // Helper function to get a formatted address
    const getFormattedAddress = async (latitude: number, longitude: number): Promise<string> => {
        if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
            console.error("Invalid coordinates:", { latitude, longitude });
            return "Location unavailable";
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
        getUser()
        setGreetingTime()
    }, [])

    const getUser = async () => {
        try {
            // Get the authenticated user
            const {
                data: { user: authUser },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError) {
                throw authError;
            }

            if (authUser) {
                // Fetch the user's profile
                const { data: profile, error: profileError } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("user_id", authUser.id)
                    .single();

                if (profileError) {
                    throw profileError;
                }

                setUser(profile);

                // Fetch the latest location for the user
                const { data: latestLocation, error: locationError } = await supabase
                    .from("locations")
                    .select("*")
                    .eq("user_id", authUser.id)
                    .order("updated_at", { ascending: false })
                    .limit(1)
                    .single();

                if (locationError) {
                    console.error("Error fetching latest location:", locationError);
                } else if (latestLocation) {
                    console.log("Latest location data:", latestLocation);

                    // If we already have the address, use it directly
                    if (latestLocation.address) {
                        setFormattedAddress(latestLocation.address);
                    }

                    // Try to extract coordinates from the geom field
                    if (latestLocation.geom) {
                        let lat, lng;

                        // Handle different possible formats
                        try {
                            if (typeof latestLocation.geom === 'string') {
                                // If it's a string like "POINT(lng lat)"
                                const match = latestLocation.geom.match(/POINT\(([^ ]+) ([^)]+)\)/);
                                if (match) {
                                    lng = parseFloat(match[1]);
                                    lat = parseFloat(match[2]);
                                }
                            } else if (latestLocation.geom.coordinates) {
                                // If it's a GeoJSON format
                                lng = latestLocation.geom.coordinates[0];
                                lat = latestLocation.geom.coordinates[1];
                            } else if (latestLocation.geom.value) {
                                // Some PostGIS formats include a "value" property
                                const match = latestLocation.geom.value.match(/POINT\(([^ ]+) ([^)]+)\)/);
                                if (match) {
                                    lng = parseFloat(match[1]);
                                    lat = parseFloat(match[2]);
                                }
                            }

                            if (lat && lng) {
                                setUserLocation({ latitude: lat, longitude: lng });

                                // If we don't have an address yet, get it
                                if (!latestLocation.address) {
                                    getFormattedAddress(lat, lng)
                                        .then(address => setFormattedAddress(address))
                                        .catch(err => console.error("Error formatting address:", err));
                                }
                            }
                        } catch (error) {
                            console.error("Error parsing geom data:", error, latestLocation.geom);
                        }
                    }
                }
            }

        } catch (error) {
            console.error("Failed to get user data:", error);
        }
    };

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
                {/* Header content remains the same */}
                <View className="flex-row justify-between items-center">
                    <View>
                        <Text className="text-white text-lg font-psemibold">{greeting},</Text>
                        <Text className="text-white text-3xl font-psemibold flex-row items-center">
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
                    <Text className="text-gray-500 font-pregular text-base">Current Location</Text>
                    <View className="flex-row items-center mt-1">
                        <MapPin size={20} color="#374151" />
                        <Text className="text-gray-800 text-lg font-psemibold ml-2">
                            {formattedAddress}
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Location Modal with fixed confirm button */}
                {showLocationModal && (
                    <View
                        className="absolute top-0 left-0 right-0 bottom-0 bg-black/50 z-50 flex items-center"
                        style={{ paddingTop: 120, paddingBottom: 80 }}
                    >
                        <View className="bg-white rounded-2xl w-[90%] max-w-md" style={{ height: "75%" }}>
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
                                                : undefined
                                        }
                                    />
                                </View>

                                {/* Confirm Button */}
                                <TouchableOpacity
                                    className={`bg-[#53F3AE] py-3 rounded-xl mb-2 ${isSavingLocation ? "opacity-70" : ""}`}
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
                )}

                {/* View Jobs Section */}
                <View className="px-4">
                    <Text className="text-2xl font-psemibold text-gray-800">View Jobs</Text>
                    <Text className="text-gray-500 font-pregular text-base mt-1 mb-4">Browse active Jobs near you</Text>

                    <View className="bg-[#53F3AE] p-6 rounded-3xl relative">
                        {/* Left section with icons - limit width to leave room for image */}
                        <View className="w-2/3">
                            <View className="flex-row">
                                {/* Online icon */}
                                <View className="items-center mr-8">
                                    <TouchableOpacity
                                        className="bg-white ml-4 p-4 rounded-full items-center justify-center w-16 h-16 mb-2"
                                        onPress={() => router.push("/online-jobs")}
                                    >
                                        <Link size={24} color="#000000" />
                                    </TouchableOpacity>
                                    <Text className="text-white ml-4 font-pmedium">Online</Text>
                                </View>

                                {/* Physical icon */}
                                <View className="items-center">
                                    <TouchableOpacity
                                        className="bg-white ml-4 p-4 rounded-full items-center justify-center w-16 h-16 mb-2"
                                        onPress={() => router.push("/physical-jobs")}
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
                <View className="px-4 mb-20">
                    <View className="flex-row justify-between items-center mb-1">
                        <Text className="text-2xl mt-2 font-psemibold text-gray-800">Top Categories near you</Text>
                        <Text className="text-[#53F3AE] font-psemibold">See All</Text>
                    </View>

                    <Text className="text-gray-600 font-pregular mb-4">Find your category of service</Text>

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
                                    <Text className="text-gray-800 font-psemibold">{category.title}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Animated.ScrollView>
        </View>
    )
}