"use client"

import { useState, useEffect, useRef } from "react"
import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'
import { Image } from 'expo-image'
import FastImage from 'react-native-fast-image';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { BlurView } from "expo-blur"
import { Pencil, ArrowLeft, X, Check, Briefcase, GraduationCap, User, Banknote, Camera } from "lucide-react-native"
import { supabase } from "@/supabaseClient"
import { useRouter } from "expo-router"
import SkillSelector from "@/components/SkillSelector"
import { EducationExperienceSection } from "@/components/Experience"
import { useAuth } from "@/contexts/AuthContext"
import { FlashList } from "@shopify/flash-list";
import { MaterialIcons } from '@expo/vector-icons';

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
  const { user, profile: authProfile } = useAuth()
  const [profile, setProfile] = useState<ProfileData>({
    full_name: null,
    phone_number: null,
    bio: null,
    profession: null,
    hourly_fee: null,
    minimum_visit_fee: null,
    skills: [],
  })
  const [initialProfile, setInitialProfile] = useState<ProfileData | null>(null)
  const router = useRouter()
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingFee, setEditingFee] = useState<{ hourly_fee: number | null; minimum_visit_fee: number | null }>({
    hourly_fee: null,
    minimum_visit_fee: null,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [educations, setEducations] = useState([])
  const [experiences, setExperiences] = useState([])
  const [isEducationExperienceChanged, setIsEducationExperienceChanged] = useState(false)
  const [modalAnimation] = useState(new Animated.Value(0))
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [isUploadingPortfolio, setIsUploadingPortfolio] = useState(false);
  const MAX_PORTFOLIO_IMAGES = 5;

  // Animation for modal
  useEffect(() => {
    if (isModalVisible) {
      Animated.spring(modalAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 7,
      }).start()
    } else {
      Animated.timing(modalAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [isModalVisible])

  const formatPhoneNumber = (phoneNumber: string | null) => {
    if (!phoneNumber) return "+92 000 0000000"
    return `+92 ${phoneNumber.slice(2)}`
  }

  const scrollY = useRef(new Animated.Value(0)).current
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [290, 75],  // Increased from 260 to 290
    extrapolate: "clamp",
  })
  const headerPaddingTop = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [12, 8],
    extrapolate: "clamp",
  })
  const headerPaddingBottom = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [60, 8],
    extrapolate: "clamp",
  })
  const profileOpacity = scrollY.interpolate({
    inputRange: [0, 60, 100],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  })
  const profileTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 10],
    extrapolate: "clamp",
  })
  const borderRadius = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [40, 0],
    extrapolate: "clamp",
  })
  const infoOpacity = scrollY.interpolate({
    inputRange: [0, 80, 120],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  })

  const fetchAllUserData = async () => {
    if (!user) return

    setIsLoading(true)

    try {
      // Fetch all data in parallel
      const [
        { data: extendedProfileData, error: profileError },
        { data: educationData, error: eduError },
        { data: experienceData, error: expError },
      ] = await Promise.all([
        supabase.from("extended_profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("user_education").select("*").eq("user_id", user.id).order("start_date", { ascending: false }),
        supabase.from("user_experience").select("*").eq("user_id", user.id).order("start_date", { ascending: false }),
      ])

      // Handle "no rows" error gracefully for first-time users
      if (
        profileError &&
        (profileError.code === "PGRST116" ||
          profileError.message?.includes("multiple (or no) rows returned"))
      ) {
        // No extended profile yet, so leave extendedProfileData as undefined/null
      } else if (profileError) {
        console.error("Error fetching profile:", profileError)
      }

      if (eduError) console.error("Error fetching education:", eduError)
      if (expError) console.error("Error fetching experience:", expError)

      // Set all state in one go
      const initialSkills = extendedProfileData?.skills || []
      const initialProfileData = {
        full_name: authProfile?.full_name || null,
        phone_number: authProfile?.phone_number || null,
        bio: extendedProfileData?.bio || null,
        profession: extendedProfileData?.profession || null,
        hourly_fee: extendedProfileData?.hourly_fee || null,
        minimum_visit_fee: extendedProfileData?.minimum_visit_fee || null,
        skills: initialSkills,
      }

      setProfile(initialProfileData)
      setInitialProfile(initialProfileData)
      setSelectedSkills(initialSkills)
      setEducations(educationData || [])
      setExperiences(experienceData || [])
      
      // Check if avatar_url exists in the extended profile
      if (extendedProfileData?.avatar_url) {
        // Get the public URL
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(extendedProfileData.avatar_url);
          
        if (publicUrlData) {
          setProfilePicture(publicUrlData.publicUrl);
          console.log("Profile picture URL:", publicUrlData.publicUrl);
        }
      }

      // Check if portfolio_images exists in the extended profile
      if (extendedProfileData?.portfolio_images && Array.isArray(extendedProfileData.portfolio_images)) {
        // Get the public URLs for all portfolio images
        const portfolioUrls = extendedProfileData.portfolio_images.map(imagePath => {
          const { data: publicUrlData } = supabase.storage
            .from('profileportfolio')
            .getPublicUrl(imagePath);
          return publicUrlData?.publicUrl || null;
        }).filter(url => url !== null);
        
        setPortfolioImages(portfolioUrls);
        console.log("Portfolio images loaded:", portfolioUrls.length);
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
      Alert.alert("Error", "Failed to load profile data. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAllUserData()
  }, [user, authProfile])

  const updateProfile = async () => {
    if (!user) return

    setIsSaving(true)

    try {
      const { data: existingProfile } = await supabase
        .from("extended_profiles")
        .select("id, avatar_url")
        .eq("user_id", user.id)
        .single()

      let result

      if (existingProfile) {
        result = await supabase
          .from("extended_profiles")
          .update({
            bio: profile.bio,
            profession: profile.profession,
            hourly_fee: profile.hourly_fee,
            minimum_visit_fee: profile.minimum_visit_fee,
            skills: selectedSkills,
            // Keep the existing avatar_url
            avatar_url: existingProfile.avatar_url || null,
            updated_at: new Date(),
          })
          .eq("user_id", user.id)
      } else {
        result = await supabase.from("extended_profiles").insert({
          user_id: user.id,
          bio: profile.bio,
          profession: profile.profession,
          hourly_fee: profile.hourly_fee,
          minimum_visit_fee: profile.minimum_visit_fee,
          skills: selectedSkills,
          // Add this line to include avatar_url in new profiles
          avatar_url: null, // Will be updated when user uploads a profile picture
          created_at: new Date(),
          updated_at: new Date(),
        })
      }

      if (result.error) {
        console.error("Update error:", result.error)
        Alert.alert("Error", result.error.message || "Failed to update profile")
        setIsSaving(false)
        return
      }

      const { data: verifyUpdate } = await supabase
        .from("extended_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single()

      console.log("Updated profile:", verifyUpdate)

      // Reset the flag after saving
      setIsEducationExperienceChanged(false)

      Alert.alert("Success", "Profile updated successfully")
      router.back()
    } catch (error: any) {
      console.error("Error:", error)
      Alert.alert("Error", error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const openModal = () => {
    setEditingFee({ hourly_fee: profile.hourly_fee, minimum_visit_fee: profile.minimum_visit_fee })
    setIsModalVisible(true)
  }

  const saveFees = () => {
    setProfile((prev) => ({
      ...prev,
      hourly_fee: editingFee.hourly_fee,
      minimum_visit_fee: editingFee.minimum_visit_fee,
    }))
    setIsModalVisible(false)
  }

  const isProfileChanged = () => {
    const isBasicInfoChanged = JSON.stringify(profile) !== JSON.stringify(initialProfile)
    const isSkillsChanged = JSON.stringify(selectedSkills) !== JSON.stringify(initialProfile?.skills || [])
    const isEducationExperienceChangedFlag = isEducationExperienceChanged

    return isBasicInfoChanged || isSkillsChanged || isEducationExperienceChangedFlag
  }

  // Loading screen
  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50">
        {/* Loading header */}
        <View className="bg-[#0D9F70] h-40 rounded-b-[40px] shadow-md">
          <View className="px-4 flex-row mt-12 items-center">
            <TouchableOpacity onPress={() => router.back()} className="p-2">
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-psemibold ml-2">Edit Profile</Text>
          </View>
        </View>

        {/* Profile Skeleton */}
        <View className="flex-1 px-4 -mt-10">
          <View className="bg-white rounded-3xl p-6 shadow-md items-center">
            {/* Avatar Skeleton */}
            <View className="w-20 h-20 rounded-full bg-gray-200 mb-4" />
            
            {/* Name Skeleton */}
            <View className="h-5 w-32 bg-gray-200 rounded-md mb-2" />
            
            {/* Phone Skeleton */}
            <View className="h-4 w-24 bg-gray-200 rounded-md mb-4" />
            
            {/* Fees Skeleton */}
            <View className="flex-row w-full justify-between mt-2">
              <View className="w-[48%] h-16 bg-gray-200 rounded-xl" />
              <View className="w-[48%] h-16 bg-gray-200 rounded-xl" />
            </View>
          </View>

          {/* Personal Info Section Skeleton */}
          <View className="mt-6 bg-white rounded-2xl p-5">
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 rounded-full bg-gray-200 mr-3" />
              <View className="h-6 w-32 bg-gray-200 rounded-md" />
            </View>
            
            <View className="mb-4">
              <View className="h-4 w-24 bg-gray-200 rounded-md mb-2" />
              <View className="h-12 bg-gray-200 rounded-xl w-full" />
            </View>
            
            <View className="mb-4">
              <View className="h-4 w-16 bg-gray-200 rounded-md mb-2" />
              <View className="h-24 bg-gray-200 rounded-xl w-full" />
            </View>
          </View>
          
          {/* Skills Section Skeleton */}
          <View className="mt-6 bg-white rounded-2xl p-5">
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 rounded-full bg-gray-200 mr-3" />
              <View className="h-6 w-20 bg-gray-200 rounded-md" />
            </View>
            
            <View className="h-12 bg-gray-200 rounded-xl w-full" />
          </View>
          
          {/* Education Section Skeleton */}
          <View className="mt-6 bg-white rounded-2xl p-5 mb-6">
            <View className="flex-row items-center mb-4">
              <View className="w-8 h-8 rounded-full bg-gray-200 mr-3" />
              <View className="h-6 w-48 bg-gray-200 rounded-md" />
            </View>
            
            <View className="h-24 bg-gray-200 rounded-xl w-full" />
          </View>
        </View>
      </View>
    )
  }

  const translateY = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  })

  const handleImageUpload = async () => {
    if (!user) return;
    
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos');
      return;
    }
    
    // Pick the image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    
    if (!result.canceled && result.assets && result.assets[0].base64) {
      try {
        setIsUploadingImage(true);
        
        // Create a unique filename
        const fileExt = result.assets[0].uri.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        
        // Upload image to Supabase using the new "avatars" bucket
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(fileName, decode(result.assets[0].base64), {
            contentType: `image/${fileExt}`,
            upsert: true,
          });
          
        if (error) throw error;
        
        // Get the public URL from the new bucket
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
          
        // Update user profile with the avatar URL
        const { error: updateError } = await supabase
          .from('extended_profiles')
          .update({ avatar_url: fileName })
          .eq('user_id', user.id);
          
        if (updateError) throw updateError;
        
        // Update local state
        setProfilePicture(publicUrlData.publicUrl);
        
        Alert.alert('Success', 'Profile picture updated successfully');
      } catch (error: any) {
        console.error('Upload error:', error);
        Alert.alert('Error', error.message || 'Failed to upload profile picture');
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  // Add this new function
  const handlePortfolioUpload = async () => {
    if (!user) return;
    
    if (portfolioImages.length >= MAX_PORTFOLIO_IMAGES) {
      Alert.alert('Limit reached', `You can only upload up to ${MAX_PORTFOLIO_IMAGES} portfolio images.`);
      return;
    }
    
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos');
      return;
    }
    
    // Pick the image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });
    
    if (!result.canceled && result.assets && result.assets[0].base64) {
      try {
        setIsUploadingPortfolio(true);
        
        // Create a unique filename
        const fileExt = result.assets[0].uri.split('.').pop();
        const fileName = `${user.id}-portfolio-${Date.now()}.${fileExt}`;
        
        // Upload image to Supabase using the profileportfolio bucket
        const { data, error } = await supabase.storage
          .from('profileportfolio')
          .upload(fileName, decode(result.assets[0].base64), {
            contentType: `image/${fileExt}`,
            upsert: true,
          });
          
        if (error) throw error;
        
        // Get the public URL
        const { data: publicUrlData } = supabase.storage
          .from('profileportfolio')
          .getPublicUrl(fileName);
        
        // Fetch current user profile to get existing portfolio images array
        const { data: existingProfile } = await supabase
          .from("extended_profiles")
          .select("portfolio_images")
          .eq("user_id", user.id)
          .single();
        
        // Create or update the portfolio_images array
        const portfolioImagesArray = existingProfile?.portfolio_images || [];
        const updatedPortfolioImages = [...portfolioImagesArray, fileName];
        
        // Update user profile with the new portfolio image
        const { error: updateError } = await supabase
          .from('extended_profiles')
          .update({ portfolio_images: updatedPortfolioImages })
          .eq('user_id', user.id);
          
        if (updateError) throw updateError;
        
        // Update local state
        setPortfolioImages(prev => [...prev, publicUrlData.publicUrl]);
        
        Alert.alert('Success', 'Portfolio image added successfully');
      } catch (error: any) {
        console.error('Upload error:', error);
        Alert.alert('Error', error.message || 'Failed to upload portfolio image');
      } finally {
        setIsUploadingPortfolio(false);
      }
    }
  };

  const handleRemovePortfolioImage = async (index: number) => {
    if (!user) return;
    
    try {
      // Get the current portfolio images from the database
      const { data: existingProfile } = await supabase
        .from("extended_profiles")
        .select("portfolio_images")
        .eq("user_id", user.id)
        .single();
        
      if (!existingProfile?.portfolio_images) return;
      
      // Get the filename to remove
      const filenameToRemove = existingProfile.portfolio_images[index];
      
      // Remove from storage
      const { error: deleteError } = await supabase.storage
        .from('profileportfolio')
        .remove([filenameToRemove]);
        
      if (deleteError) throw deleteError;
      
      // Update the array in the database
      const updatedPortfolioImages = existingProfile.portfolio_images.filter((_, i) => i !== index);
      
      const { error: updateError } = await supabase
        .from('extended_profiles')
        .update({ portfolio_images: updatedPortfolioImages })
        .eq('user_id', user.id);
        
      if (updateError) throw updateError;
      
      // Update local state
      setPortfolioImages(prev => prev.filter((_, i) => i !== index));
      
      Alert.alert('Success', 'Portfolio image removed successfully');
    } catch (error: any) {
      console.error('Remove error:', error);
      Alert.alert('Error', error.message || 'Failed to remove portfolio image');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-gray-50"
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <Animated.View
        className="bg-[#0D9F70] absolute left-0 right-0 top-0 z-10 shadow-md"
        style={{
          height: headerHeight,
          paddingTop: headerPaddingTop,
          paddingBottom: headerPaddingBottom,
          borderBottomLeftRadius: borderRadius,
          borderBottomRightRadius: borderRadius,
        }}
      >
        <View className="px-4 flex-row mt-6 items-center">
          <TouchableOpacity onPress={() => router.back()} className="p-2 rounded-full">
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-psemibold ml-2">Edit Profile</Text>
        </View>

        <Animated.View
          className="items-center mt-3"
          style={{
            opacity: profileOpacity,
            transform: [{ translateY: profileTranslateY }],
          }}
        >
          <View className="w-24 h-24 bg-white rounded-full overflow-hidden shadow-md">
            {profilePicture ? (
              <Image
                source={{ uri: profilePicture }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View className="w-full h-full bg-gray-100 items-center justify-center">
                <Text className="text-2xl text-gray-400 font-pregular">
                  {profile.full_name?.[0] || "U"}
                </Text>
              </View>
            )}
            <TouchableOpacity
              className="absolute bottom-0 right-0 bg-white p-2 rounded-full border border-gray-200 shadow-sm"
              onPress={handleImageUpload}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <ActivityIndicator size="small" color="#0D9F70" />
              ) : (
                <Camera size={16} color="#0D9F70" />
              )}
            </TouchableOpacity>
          </View>

          <Text className="text-white font-psemibold text-lg mt-2">{profile.full_name || "User Name"}</Text>
          <Text className="text-white/80 font-pregular">{formatPhoneNumber(profile.phone_number)}</Text>
        </Animated.View>

        <Animated.View className="flex-row justify-between px-6 mt-2" style={{ opacity: infoOpacity }}>
          <TouchableOpacity onPress={openModal} className="bg-white/10 px-4 py-3 rounded-xl flex-1 mr-3">
            <View className="items-center">
              <Text className="text-white text-xs font-pregular">Hourly Fee</Text>
              <Text className="text-white font-psemibold" numberOfLines={1} adjustsFontSizeToFit>
                {profile.hourly_fee?.toLocaleString() || 0} PKR
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={openModal} className="bg-white/10 px-4 py-3 rounded-xl flex-1">
            <View className="items-center">
              <Text className="text-white text-xs font-pregular">Minimum Visit Fee</Text>
              <Text className="text-white font-psemibold" numberOfLines={1} adjustsFontSizeToFit>
                {profile.minimum_visit_fee?.toLocaleString() || 0} PKR
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingTop: 280, paddingBottom: 40 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 py-6">
          {/* Profile Section Card */}
          <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden border border-gray-100">
            <View className="p-5">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                  <User size={16} color="#0D9F70" />
                </View>
                <Text className="text-gray-800 font-pbold text-lg">Psersonal Info</Text>
              </View>

              <View className="mb-4">
                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Profession</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-800"
                  value={profile.profession || ""}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, profession: text }))}
                  placeholder="e.g. Web Developer, Designer, etc."
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View className="mb-4">
                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Bio</Text>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-800 h-24"
                  value={profile.bio || ""}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, bio: text }))}
                  placeholder="Tell us about yourself..."
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
          </View>

          {/* Skills Section Card */}
          <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden border border-gray-100">
            <View className="p-5">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                  <Briefcase size={16} color="#0D9F70" />
                </View>
                <Text className="text-gray-800 font-pbold text-lg">Skills</Text>
              </View>

              <SkillSelector onSkillsChange={setSelectedSkills} initialSkills={profile.skills || []} />
            </View>
          </View>

          {/* Education & Experience Section Card */}
          <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden border border-gray-100">
            <View className="p-5">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                  <GraduationCap size={16} color="#0D9F70" />
                </View>
                <Text className="text-gray-800 font-pbold text-lg">Education & Experience</Text>
              </View>

              <EducationExperienceSection
                userId={user?.id!}
                educations={educations}
                experiences={experiences}
                fetchEducationAndExperience={() => fetchAllUserData()}
                setIsEducationExperienceChanged={setIsEducationExperienceChanged}
              />
            </View>
          </View>

          {/* Portfolio Section Card */}
          <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden border border-gray-100">
            <View className="p-5">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                  <MaterialIcons name="work" size={16} color="#0D9F70" />
                </View>
                <Text className="text-gray-800 font-pbold text-lg">Portfolio</Text>
                <Text className="text-gray-400 ml-auto">
                  {portfolioImages.length}/{MAX_PORTFOLIO_IMAGES}
                </Text>
              </View>
              
              {/* Portfolio grid */}
              <View className="flex-row flex-wrap">
                {portfolioImages.map((imageUrl, index) => (
                  <View key={index} className="w-[31%] aspect-square m-1 rounded-lg overflow-hidden bg-gray-100 relative">
                    <Image
                      source={{ uri: imageUrl }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                    <TouchableOpacity
                      className="absolute top-1 right-1 bg-black/50 rounded-full p-1"
                      onPress={() => handleRemovePortfolioImage(index)}
                    >
                      <X size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
                
                {portfolioImages.length < MAX_PORTFOLIO_IMAGES && (
                  <TouchableOpacity
                    className="w-[31%] aspect-square m-1 bg-gray-100 rounded-lg items-center justify-center border border-dashed border-gray-300"
                    onPress={handlePortfolioUpload}
                    disabled={isUploadingPortfolio}
                  >
                    {isUploadingPortfolio ? (
                      <ActivityIndicator color="#0D9F70" />
                    ) : (
                      <MaterialIcons name="add-photo-alternate" size={24} color="#0D9F70" />
                    )}
                  </TouchableOpacity>
                )}
              </View>
              
              <Text className="text-gray-500 text-xs mt-3 text-center">
                Upload up to 5 images showcasing your best work
              </Text>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            className={`py-4 rounded-xl items-center mb-8 shadow-sm ${
              isProfileChanged() ? "bg-[#0D9F70]" : "bg-gray-300"
            }`}
            onPress={updateProfile}
            disabled={!isProfileChanged() || isSaving}
          >
            {isSaving ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                <Text className="text-white font-psemibold text-lg">Saving...</Text>
              </View>
            ) : (
              <Text className="text-white font-psemibold text-lg">Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>

      {/* Fee Setting Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View className="flex-1 justify-end">
          <BlurView intensity={20} className="absolute top-0 left-0 right-0 bottom-0" tint="dark" />

          <Animated.View
            style={{
              transform: [{ translateY }],
              backgroundColor: "white",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
              maxHeight: "90%",
            }}
          >
            <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />

            <View className="px-6 pb-8">
              <View className="flex-row justify-between items-center mb-6">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                    <Banknote size={16} color="#0D9F70" />
                  </View>
                  <Text className="text-xl font-pbold text-gray-800">Set Your Fees</Text>
                </View>
                <TouchableOpacity onPress={() => setIsModalVisible(false)} className="p-2 rounded-full bg-gray-100">
                  <X size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View className="mb-5">
                <Text className="text-sm font-pmedium text-gray-600 mb-2">Hourly Fee</Text>
                <View className="relative">
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 text-gray-900 pr-12"
                    value={editingFee.hourly_fee?.toString() || ""}
                    onChangeText={(text) =>
                      setEditingFee((prev) => ({
                        ...prev,
                        hourly_fee: text ? Number(text) : null,
                      }))
                    }
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text className="absolute right-4 top-3.5 text-gray-500 text-base font-pregular">PKR</Text>
                </View>
              </View>

              <View className="mb-8">
                <Text className="text-sm font-pmedium text-gray-600 mb-2">Minimum Visit Fee</Text>
                <View className="relative">
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3.5 text-base bg-gray-50 text-gray-900 pr-12"
                    value={editingFee.minimum_visit_fee?.toString() || ""}
                    onChangeText={(text) =>
                      setEditingFee((prev) => ({
                        ...prev,
                        minimum_visit_fee: text ? Number(text) : null,
                      }))
                    }
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text className="absolute right-4 top-3.5 text-gray-500 text-base font-pregular">PKR</Text>
                </View>
              </View>

              <TouchableOpacity
                className="bg-[#0D9F70] py-4 rounded-xl shadow-sm flex-row items-center justify-center"
                onPress={saveFees}
                activeOpacity={0.8}
              >
                <Check size={20} color="white" className="mr-2" />
                <Text className="text-white text-lg font-psemibold">Save Changes</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}
