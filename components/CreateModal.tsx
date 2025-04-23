"use client"

import { useEffect } from "react"
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Modal, StyleSheet } from "react-native"
import { Link, X } from "lucide-react-native"
import { BlurView } from "expo-blur"
import { supabase } from "@/supabaseClient"
import { useRouter } from "expo-router"
import { useModal } from "@/contexts/ModalContext"

export default function CreateModal() {
    const { isCreateModalVisible, hideCreateModal, hasCompleteProfile, setProfileStatus, isCheckingProfile, setCheckingStatus } = useModal()
    const router = useRouter()

    useEffect(() => {
        if (isCreateModalVisible) checkExtendedProfile()
    }, [isCreateModalVisible])

    const checkExtendedProfile = async () => {
        try {
            setCheckingStatus(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: extendedProfile, error } = await supabase.from("extended_profiles").select("id").eq("user_id", user.id).single()
                setProfileStatus(!!extendedProfile && !error)
            }
        } catch (error) {
            console.error("Error checking extended profile:", error)
        } finally {
            setCheckingStatus(false)
        }
    }

    const navigateToCompleteProfile = () => {
        hideCreateModal()
        router.push("/Profile")
    }

    const handleJobTypeSelection = async (type) => {
        try {
            hideCreateModal();

            // Fetch the current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.error("No user found");
                return;
            }

            // Navigate to the job creation screen with the `user` object
            router.push({
                pathname: `/create/${type}`,
                params: { user: JSON.stringify(user) }, // Pass the user object as a JSON string
            });
        } catch (error) {
            console.error("Error navigating to job creation screen:", error);
        }
    };

    const closeModal = () => {
        hideCreateModal()
    }

    return (
        <Modal visible={isCreateModalVisible} transparent={true} animationType="fade" onRequestClose={closeModal}>
            <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark">
                <View className="flex-1 justify-center items-center p-4">
                    <View className="bg-white w-full max-w-md rounded-3xl p-6 shadow-lg">
                        <TouchableOpacity className="absolute right-4 mt-3 top-4 z-10" onPress={closeModal}>
                            <X size={24} color="#374151" />
                        </TouchableOpacity>
                        {isCheckingProfile ? (
                            <View className="py-8 justify-center items-center">
                                <ActivityIndicator size="large" color="#0D9F6F" />
                            </View>
                        ) : hasCompleteProfile ? (
                            <View>
                                <Text className="text-2xl font-psemibold text-gray-800 mb-6 text-center">Create New Job</Text>
                                <Text className="text-gray-600 mb-6 text-center font-pregular">Select the type of job you want to create</Text>
                                <View className="flex-row justify-between gap-6">
                                    <View className="flex-1 items-center">
                                        <TouchableOpacity className="bg-[#0D9F6F] p-5 rounded-2xl mb-3 items-center justify-center" style={styles.iconButton} onPress={() => handleJobTypeSelection("online")}>
                                            <Link size={32} color="white" />
                                        </TouchableOpacity>
                                        <Text className="font-psemibold mt-2 text-gray-800 text-center">Online Job</Text>
                                    </View>
                                    <View className="flex-1 items-center">
                                        <TouchableOpacity className="bg-[#0D9F6F] p-5 rounded-2xl mb-3 items-center justify-center" style={styles.iconButton} onPress={() => handleJobTypeSelection("offline")}>
                                            <Image source={require("@/assets/images/physicalicon.png")} style={{ width: 32, height: 32 }} tintColor="white" />
                                        </TouchableOpacity>
                                        <Text className="font-psemibold mt-2 text-gray-800 text-center">Offline Job</Text>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View>
                                <Text className="text-2xl font-psemibold text-gray-800 mb-4 text-center">Complete Your Profile</Text>
                                <Text className="text-gray-600 mb-6 text-center font-pregular">You need to complete your profile before you can create a job posting.</Text>
                                <TouchableOpacity className="bg-[#0D9F6F] py-4 px-6 rounded-xl" onPress={navigateToCompleteProfile}>
                                    <Text className="text-center font-psemibold text-lg text-white">Complete Profile</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </BlurView>
        </Modal>
    )
}

const styles = StyleSheet.create({
    iconButton: {
        width: 80,
        height: 80,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
})