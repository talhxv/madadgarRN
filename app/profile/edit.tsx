"use client"
import { useEffect, useState, useRef } from "react"
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Animated, Modal, StyleSheet } from "react-native"
import { BlurView } from 'expo-blur';
import { Pencil, ArrowLeft, Plus } from "lucide-react-native"
import { supabase } from "@/supabaseClient"
import { useRouter } from "expo-router"
import SkillSelector from "@/components/SkillSelector"

interface ProfileData {
    full_name: string | null
    phone_number: string | null
    bio: string | null
    profession: string | null
    hourly_fee: number | null
    minimum_visit_fee: number | null
    skills: string[] | null
}

export default function EditProfile() {
    const [profile, setProfile] = useState<ProfileData>({
        full_name: null,
        phone_number: null,
        bio: null,
        profession: null,
        hourly_fee: null,
        minimum_visit_fee: null,
        skills: []
    })
    const [userId, setUserId] = useState<string | null>(null)
    const router = useRouter()
    const [selectedSkills, setSelectedSkills] = useState<string[]>([])
    const [isModalVisible, setIsModalVisible] = useState(false)
    const [editingFee, setEditingFee] = useState<{ hourly_fee: number | null, minimum_visit_fee: number | null }>({ hourly_fee: null, minimum_visit_fee: null })
    const formatPhoneNumber = (phoneNumber: string | null) => {
        if (!phoneNumber) return "+92 000 0000000"
        return `+92 ${phoneNumber.slice(2)}`
    }
    // Animation values
    const scrollY = useRef(new Animated.Value(0)).current
    const headerHeight = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [260, 120],  // Increased to accommodate the additional info
        extrapolate: 'clamp'
    })
    const headerPaddingTop = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [12, 8],
        extrapolate: 'clamp'
    })
    const headerPaddingBottom = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [60, 8],  // Increased to accommodate the fee display
        extrapolate: 'clamp'
    })
    const profileOpacity = scrollY.interpolate({
        inputRange: [0, 60, 100],
        outputRange: [1, 0.5, 0],
        extrapolate: 'clamp'
    })
    const profileTranslateY = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [0, 10],
        extrapolate: 'clamp'
    })
    const borderRadius = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [40, 0],
        extrapolate: 'clamp'
    })
    const infoOpacity = scrollY.interpolate({
        inputRange: [0, 80, 120],
        outputRange: [1, 0.5, 0],
        extrapolate: 'clamp'
    })

    useEffect(() => {
        getUser()
    }, [])

    const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            setUserId(user.id)

            // Get basic profile
            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("user_id", user.id)
                .single()

            // Get extended profile
            const { data: extendedProfileData } = await supabase
                .from("extended_profiles")
                .select("*")
                .eq("user_id", user.id)
                .single()

            const initialSkills = extendedProfileData?.skills || [];
            setProfile({
                full_name: profileData?.full_name || null,
                phone_number: profileData?.phone_number || null,
                bio: extendedProfileData?.bio || null,
                profession: extendedProfileData?.profession || null,
                hourly_fee: extendedProfileData?.hourly_fee || null,
                minimum_visit_fee: extendedProfileData?.minimum_visit_fee || null,
                skills: initialSkills,
            });
            setSelectedSkills(initialSkills);
        }
    }

    const updateProfile = async () => {
        if (!userId) return

        try {
            // First check if extended profile exists
            const { data: existingProfile } = await supabase
                .from("extended_profiles")
                .select("id")
                .eq("user_id", userId)
                .single()

            let result;

            if (existingProfile) {
                // Update existing profile
                result = await supabase
                    .from("extended_profiles")
                    .update({
                        bio: profile.bio,
                        profession: profile.profession,
                        hourly_fee: profile.hourly_fee,
                        minimum_visit_fee: profile.minimum_visit_fee,
                        skills: selectedSkills,
                        updated_at: new Date()
                    })
                    .eq("user_id", userId)
            } else {
                // Insert new profile
                result = await supabase
                    .from("extended_profiles")
                    .insert({
                        user_id: userId,
                        bio: profile.bio,
                        profession: profile.profession,
                        hourly_fee: profile.hourly_fee,
                        minimum_visit_fee: profile.minimum_visit_fee,
                        skills: selectedSkills,
                        created_at: new Date(),
                        updated_at: new Date()
                    })
            }

            if (result.error) {
                console.error("Update error:", result.error);
                Alert.alert("Error", result.error.message || "Failed to update profile")
                return
            }

            // Add this to verify the update
            const { data: verifyUpdate } = await supabase
                .from("extended_profiles")
                .select("*")
                .eq("user_id", userId)
                .single()

            console.log("Updated profile:", verifyUpdate);

            Alert.alert("Success", "Profile updated successfully")
            router.back()
        } catch (error: any) {
            console.error("Error:", error);
            Alert.alert("Error", error.message)
        }
    }

    const openModal = () => {
        setEditingFee({ hourly_fee: profile.hourly_fee, minimum_visit_fee: profile.minimum_visit_fee })
        setIsModalVisible(true)
    }

    const saveFees = () => {
        setProfile(prev => ({
            ...prev,
            hourly_fee: editingFee.hourly_fee,
            minimum_visit_fee: editingFee.minimum_visit_fee
        }))
        setIsModalVisible(false)
    }

    return (
        <View className="flex-1 bg-white">
            {/* Animated Header */}
            <Animated.View
                className="bg-[#53F3AE] absolute left-0 right-0 top-0 z-10"
                style={{
                    height: headerHeight,
                    paddingTop: headerPaddingTop,
                    paddingBottom: headerPaddingBottom,
                    borderBottomLeftRadius: borderRadius,
                    borderBottomRightRadius: borderRadius,
                }}
            >
                <View className="px-4 flex-row mt-4 items-center">
                    <TouchableOpacity onPress={() => router.back()}>
                        <ArrowLeft size={24} color="white" />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold ml-4">Edit Profile</Text>
                </View>

                {/* Profile Picture and User Info - inside header but with animated opacity */}
                <Animated.View
                    className="items-center mt-6"
                    style={{
                        opacity: profileOpacity,
                        transform: [{ translateY: profileTranslateY }]
                    }}
                >
                    <View className="w-24 h-24 bg-white rounded-full overflow-hidden">
                        <View className="w-full h-full bg-gray-100 items-center justify-center">
                            <Text className="text-2xl text-gray-400">{profile.full_name?.[0] || "U"}</Text>
                        </View>
                        <TouchableOpacity
                            className="absolute bottom-0 right-0 bg-white p-1 rounded-full border border-gray-200"
                            onPress={() => Alert.alert("Coming soon", "Photo upload will be available in future updates")}
                        >
                            <Pencil size={16} color="#374151" />
                        </TouchableOpacity>
                    </View>

                    {/* Non-editable name and phone */}
                    <Text className="text-white font-bold text-lg mt-2">{profile.full_name || "User Name"}</Text>
                    <Text className="text-white/80">{formatPhoneNumber(profile.phone_number)}</Text>
                </Animated.View>

                {/* Fee information */}
                <Animated.View
                    className="flex-row justify-around mt-2 px-4"
                    style={{ opacity: infoOpacity }}
                >
                    <TouchableOpacity onPress={openModal}>
                        <View className="items-center">
                            <Text className="text-white text-sm">Hourly Fee</Text>
                            <Text className="text-white font-bold">{profile.hourly_fee || 0} PKR</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={openModal}>
                        <View className="items-center">
                            <Text className="text-white text-sm">Minimum Visit Fee</Text>
                            <Text className="text-white font-bold">{profile.minimum_visit_fee || 0} PKR</Text>
                        </View>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>

            {/* Content with animated scrollview */}
            <Animated.ScrollView
                className="flex-1 bg-white"
                contentContainerStyle={{ paddingTop: 280 }} // Increased to accommodate the larger header
                scrollEventThrottle={16}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
            >
                {/* Form Fields */}
                <View className="px-4 py-6">
                    {/* Professional Info */}
                    <View className="mb-4">
                        <Text className="text-gray-700 mb-1 font-medium">Profession</Text>
                        <TextInput
                            className="border border-gray-300 rounded-md px-3 py-2 bg-white"
                            value={profile.profession || ""}
                            onChangeText={(text) => setProfile(prev => ({ ...prev, profession: text }))}
                            placeholder="e.g. Web Developer, Designer, etc."
                        />
                    </View>

                    {/* Bio */}
                    <View className="mb-6">
                        <Text className="text-gray-700 mb-1 font-medium">Bio</Text>
                        <TextInput
                            className="border border-gray-300 rounded-md px-3 py-2 bg-white h-24"
                            value={profile.bio || ""}
                            onChangeText={(text) => setProfile(prev => ({ ...prev, bio: text }))}
                            placeholder="Tell us about yourself..."
                            multiline
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Skills */}
                    <View className="mb-6">
                        <Text className="text-gray-700 mb-1 font-medium">Skills</Text>
                        <SkillSelector
                            onSkillsChange={setSelectedSkills}
                            initialSkills={profile.skills || []}
                        />
                    </View>

                    {/* Portfolio, Work History, Education will be added in future updates */}
                    <Text className="text-gray-500 mb-6">Portfolio uploads and history sections will be available in future updates</Text>

                    {/* Save Button */}
                    <TouchableOpacity
                        className="bg-[#53F3AE] py-3 rounded-md items-center mb-8"
                        onPress={updateProfile}
                    >
                        <Text className="text-white font-bold text-lg">Save Changes</Text>
                    </TouchableOpacity>
                </View>
            </Animated.ScrollView>

            {/* Modal for editing fees */}
            <Modal
                visible={isModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <BlurView
                        intensity={20}
                        style={styles.blurContainer}
                        tint="dark"
                    />
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Set Your Fee</Text>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Hourly Fee</Text>
                            <View>
                                <TextInput
                                    style={styles.input}
                                    value={editingFee.hourly_fee?.toString() || ""}
                                    onChangeText={(text) => setEditingFee(prev => ({
                                        ...prev,
                                        hourly_fee: text ? Number(text) : null
                                    }))}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    placeholderTextColor="#9CA3AF"
                                />
                                <Text style={styles.currencyIndicator}>PKR</Text>
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Minimum Visit Fee</Text>
                            <View>
                                <TextInput
                                    style={styles.input}
                                    value={editingFee.minimum_visit_fee?.toString() || ""}
                                    onChangeText={(text) => setEditingFee(prev => ({
                                        ...prev,
                                        minimum_visit_fee: text ? Number(text) : null
                                    }))}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    placeholderTextColor="#9CA3AF"
                                />
                                <Text style={styles.currencyIndicator}>PKR</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={saveFees}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.saveButtonText}>Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    )
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    blurContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalContent: {
        width: '85%',
        backgroundColor: 'white',
        borderRadius: 20,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 32,
        alignItems: 'stretch',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 24,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#4B5563',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        backgroundColor: '#F9FAFB',
        color: '#111827',
    },
    saveButton: {
        backgroundColor: '#53F3AE',
        paddingVertical: 16,
        borderRadius: 12,
        marginTop: 8,
        shadowColor: '#53F3AE',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
    },
    currencyIndicator: {
        position: 'absolute',
        right: 16,
        top: 16,
        color: '#6B7280',
        fontSize: 16,
    }
});