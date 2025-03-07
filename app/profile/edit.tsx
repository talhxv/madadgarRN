import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Animated, Modal } from "react-native";
import { BlurView } from 'expo-blur';
import { Pencil, ArrowLeft, Plus } from "lucide-react-native";
import { supabase } from "@/supabaseClient";
import { useRouter } from "expo-router";
import SkillSelector from "@/components/SkillSelector";
import { EducationExperienceSection } from '@/components/Experience';

interface ProfileData {
    full_name: string | null;
    phone_number: string | null;
    bio: string | null;
    profession: string | null;
    hourly_fee: number | null;
    minimum_visit_fee: number | null;
    skills: string[] | null;
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
    });
    const [initialProfile, setInitialProfile] = useState<ProfileData | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const router = useRouter();
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingFee, setEditingFee] = useState<{ hourly_fee: number | null, minimum_visit_fee: number | null }>({ hourly_fee: null, minimum_visit_fee: null });
    const [isSaving, setIsSaving] = useState(false);
    const [educations, setEducations] = useState([]);
    const [experiences, setExperiences] = useState([]);
    const [isEducationExperienceChanged, setIsEducationExperienceChanged] = useState(false);

    const formatPhoneNumber = (phoneNumber: string | null) => {
        if (!phoneNumber) return "+92 000 0000000";
        return `+92 ${phoneNumber.slice(2)}`;
    };

    const scrollY = useRef(new Animated.Value(0)).current;
    const headerHeight = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [260, 75],
        extrapolate: 'clamp'
    });
    const headerPaddingTop = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [12, 8],
        extrapolate: 'clamp'
    });
    const headerPaddingBottom = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [60, 8],
        extrapolate: 'clamp'
    });
    const profileOpacity = scrollY.interpolate({
        inputRange: [0, 60, 100],
        outputRange: [1, 0.5, 0],
        extrapolate: 'clamp'
    });
    const profileTranslateY = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [0, 10],
        extrapolate: 'clamp'
    });
    const borderRadius = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [40, 0],
        extrapolate: 'clamp'
    });
    const infoOpacity = scrollY.interpolate({
        inputRange: [0, 80, 120],
        outputRange: [1, 0.5, 0],
        extrapolate: 'clamp'
    });

    useEffect(() => {
        getUser();
    }, []);

    const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUserId(user.id);

            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("user_id", user.id)
                .single();

            const { data: extendedProfileData } = await supabase
                .from("extended_profiles")
                .select("*")
                .eq("user_id", user.id)
                .single();

            const initialSkills = extendedProfileData?.skills || [];
            const initialProfileData = {
                full_name: profileData?.full_name || null,
                phone_number: profileData?.phone_number || null,
                bio: extendedProfileData?.bio || null,
                profession: extendedProfileData?.profession || null,
                hourly_fee: extendedProfileData?.hourly_fee || null,
                minimum_visit_fee: extendedProfileData?.minimum_visit_fee || null,
                skills: initialSkills,
            };

            setProfile(initialProfileData);
            setInitialProfile(initialProfileData);
            setSelectedSkills(initialSkills);

            fetchEducationAndExperience(user.id);
        }
    };

    const fetchEducationAndExperience = async (userId: string) => {
        try {
            const [{ data: educationData }, { data: experienceData }] = await Promise.all([
                supabase
                    .from('user_education')
                    .select('*')
                    .eq('user_id', userId)
                    .order('start_date', { ascending: false }),
                supabase
                    .from('user_experience')
                    .select('*')
                    .eq('user_id', userId)
                    .order('start_date', { ascending: false })
            ]);

            setEducations(educationData || []);
            setExperiences(experienceData || []);
            // Indicate changes have been made
        } catch (error) {
            console.error('Error fetching education and experience:', error);
            Alert.alert('Error', 'Failed to load education and experience data');
        }
    };

    const updateProfile = async () => {
        if (!userId) return;

        setIsSaving(true);

        try {
            const { data: existingProfile } = await supabase
                .from("extended_profiles")
                .select("id")
                .eq("user_id", userId)
                .single();

            let result;

            if (existingProfile) {
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
                    .eq("user_id", userId);
            } else {
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
                    });
            }

            if (result.error) {
                console.error("Update error:", result.error);
                Alert.alert("Error", result.error.message || "Failed to update profile");
                setIsSaving(false);
                return;
            }

            const { data: verifyUpdate } = await supabase
                .from("extended_profiles")
                .select("*")
                .eq("user_id", userId)
                .single();

            console.log("Updated profile:", verifyUpdate);

            // Reset the flag after saving
            setIsEducationExperienceChanged(false);

            Alert.alert("Success", "Profile updated successfully");
            router.back();
        } catch (error: any) {
            console.error("Error:", error);
            Alert.alert("Error", error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const openModal = () => {
        setEditingFee({ hourly_fee: profile.hourly_fee, minimum_visit_fee: profile.minimum_visit_fee });
        setIsModalVisible(true);
    };

    const saveFees = () => {
        setProfile(prev => ({
            ...prev,
            hourly_fee: editingFee.hourly_fee,
            minimum_visit_fee: editingFee.minimum_visit_fee
        }));
        setIsModalVisible(false);
    };

    const isProfileChanged = () => {
        const isBasicInfoChanged = JSON.stringify(profile) !== JSON.stringify(initialProfile);
        const isSkillsChanged = JSON.stringify(selectedSkills) !== JSON.stringify(initialProfile?.skills || []);
        const isEducationExperienceChangedFlag = isEducationExperienceChanged;

        return isBasicInfoChanged || isSkillsChanged || isEducationExperienceChangedFlag;
    };

    return (
        <View className="flex-1 bg-white">
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
                <View className="px-4 flex-row mt-6 items-center">
                    <TouchableOpacity onPress={() => router.back()}>
                        <ArrowLeft size={24} color="white" />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold ml-4">Edit Profile</Text>
                </View>

                <Animated.View
                    className="items-center mt-3"
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

                    <Text className="text-white font-bold text-lg mt-2">{profile.full_name || "User Name"}</Text>
                    <Text className="text-white/80">{formatPhoneNumber(profile.phone_number)}</Text>
                </Animated.View>

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

            <Animated.ScrollView
                className="flex-1 bg-white"
                contentContainerStyle={{ paddingTop: 280 }}
                scrollEventThrottle={16}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
            >
                <View className="px-4 py-6">
                    <View className="mb-4">
                        <Text className="text-gray-700 mb-1 font-medium">Profession</Text>
                        <TextInput
                            className="border border-gray-300 rounded-md px-3 py-2 bg-white"
                            value={profile.profession || ""}
                            onChangeText={(text) => setProfile(prev => ({ ...prev, profession: text }))}
                            placeholder="e.g. Web Developer, Designer, etc."
                        />
                    </View>

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

                    <View className="mb-6">
                        <Text className="text-gray-700 mb-1 font-medium">Skills</Text>
                        <SkillSelector
                            onSkillsChange={setSelectedSkills}
                            initialSkills={profile.skills || []}
                        />
                    </View>
                    <EducationExperienceSection
                        userId={userId!}
                        educations={educations}
                        experiences={experiences}
                        fetchEducationAndExperience={fetchEducationAndExperience}
                        setIsEducationExperienceChanged={setIsEducationExperienceChanged}
                    />
                    <TouchableOpacity
                        className={`py-3 rounded-md items-center mb-8 ${isProfileChanged() ? 'bg-[#53F3AE]' : 'bg-gray-300'}`}
                        onPress={updateProfile}
                        disabled={!isProfileChanged() || isSaving}
                    >
                        <Text className="text-white font-bold text-lg">{isSaving ? 'Saving Changes...' : 'Save Changes'}</Text>
                    </TouchableOpacity>
                </View>
            </Animated.ScrollView>

            <Modal
                visible={isModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center">
                    <BlurView
                        intensity={20}m
                        className="absolute top-0 left-0 right-0 bottom-0"
                        tint="dark"
                    />
                    <View className="w-11/12 bg-white rounded-2xl px-6 pt-6 pb-8 items-stretch shadow-lg">
                        <Text className="text-2xl font-semibold text-gray-900 mb-6 text-center">Set Your Fee</Text>

                        <View className="mb-5">
                            <Text className="text-sm font-medium text-gray-600 mb-2">Hourly Fee</Text>
                            <View>
                                <TextInput
                                    className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-gray-50 text-gray-900"
                                    value={editingFee.hourly_fee?.toString() || ""}
                                    onChangeText={(text) => setEditingFee(prev => ({
                                        ...prev,
                                        hourly_fee: text ? Number(text) : null
                                    }))}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    placeholderTextColor="#9CA3AF"
                                />
                                <Text className="absolute right-4 top-3.5 text-gray-500 text-base">PKR</Text>
                            </View>
                        </View>

                        <View className="mb-5">
                            <Text className="text-sm font-medium text-gray-600 mb-2">Minimum Visit Fee</Text>
                            <View>
                                <TextInput
                                    className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-gray-50 text-gray-900"
                                    value={editingFee.minimum_visit_fee?.toString() || ""}
                                    onChangeText={(text) => setEditingFee(prev => ({
                                        ...prev,
                                        minimum_visit_fee: text ? Number(text) : null
                                    }))}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    placeholderTextColor="#9CA3AF"
                                />
                                <Text className="absolute right-4 top-3.5 text-gray-500 text-base">PKR</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            className="bg-[#53F3AE] py-4 rounded-lg mt-2 shadow-md"
                            onPress={saveFees}
                            activeOpacity={0.8}
                        >
                            <Text className="text-white text-lg font-semibold text-center">Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}