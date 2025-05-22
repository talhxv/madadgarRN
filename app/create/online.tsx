import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    SafeAreaView,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

// Define types for your data structures
type User = {
    id: string;
};

type Category = {
    id: string;
    name: string;
    type: string;
    popularity_score: number;
};

type Skill = {
    id: string;
    name: string;
};

type Location = {
    id: string;
    address: string;
    updated_at: string;
};

type JobDetails = {
    title: string;
    description: string;
    images: string[];
    paymentType: "hourly" | "project";
    amount: string;
    currency: string;
    timeRequired: string;
    timeUnit: string;
    skillLevel: "amateur" | "intermediate" | "professional";
    user_id: string;
    location_address: string;
    category_id: string | null;
};

const OnlineJobCreationScreen: React.FC = () => {
    const params = useLocalSearchParams();
    const user = JSON.parse(params.user as string) as User; // Parse the user object from the JSON string
    const router = useRouter();
    const [step, setStep] = useState<number>(1);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [topCategories, setTopCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const navigation = useNavigation();

    // Job details state
    const [jobDetails, setJobDetails] = useState<JobDetails>({
        title: "",
        description: "",
        images: [],
        paymentType: "hourly",
        amount: "",
        currency: "PKR",
        timeRequired: "",
        timeUnit: "Weeks",
        skillLevel: "intermediate",
        user_id: user.id,
        location_address: "",
        category_id: null,
    });

    const [skills, setSkills] = useState<Skill[]>([]);
    const [skillSearchQuery, setSkillSearchQuery] = useState<string>("");
    const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
    const [isLoadingSkills, setIsLoadingSkills] = useState<boolean>(false);

    // Handle back navigation
    const handleBack = () => {
        if (navigation) {
            navigation.goBack();
        } else {
            router.back(); // Use router.back() as fallback
        }
    };

    // Navigate to a specific step
    const navigateToStep = (targetStep: number) => {
        if (targetStep > step && targetStep !== step + 1) {
            return;
        }

        // Validation for moving to next steps
        if (targetStep > 1 && !selectedCategory) {
            alert("Please select a category first");
            return;
        }

        if (targetStep > 2 && (!jobDetails.title || !jobDetails.description)) {
            alert("Please complete the description section first");
            return;
        }

        // Special case for step 2.5 (photos)
        if (step === 2 && targetStep === 3) {
            setStep(2.5); // Go to photos sub-step
            return;
        }

        // Allow going back to any previous step
        if (targetStep <= step) {
            setStep(targetStep);
            return;
        }

        // Normal progression
        setStep(targetStep);
    };

    // Fetch categories from Supabase backend
    const fetchCategories = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from("job_categories")
                .select("*")
                .order("popularity_score", { ascending: false });

            if (error) throw error;

            setCategories(data || []);

            // Get top categories with highest popularity scores
            const onlineCategories = data.filter((cat) => cat.type === "online");
            setTopCategories(onlineCategories.slice(0, 4));
        } catch (error) {
            console.error("Error fetching categories:", error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchSkills = async (searchQuery: string = "") => {
        try {
            setIsLoadingSkills(true);

            let query = supabase.from("skills").select("*");

            if (searchQuery) {
                query = query.ilike("name", `%${searchQuery}%`);
            }

            const { data, error } = await query.order("name").limit(10);

            if (error) throw error;

            if (searchQuery) {
                setFilteredSkills(data || []);
            } else {
                setSkills(data || []);
            }
        } catch (error) {
            console.error("Error fetching skills:", error);
        } finally {
            setIsLoadingSkills(false);
        }
    };

    // Fetch user's saved locations
    const fetchLocations = async () => {
        try {
            const { data, error } = await supabase
                .from("locations")
                .select("*")
                .eq("user_id", user.id)
                .order("updated_at", { ascending: false });

            if (error) throw error;

            setLocations(data || []);
            // Set default to the latest location if available
            if (data.length > 0) setSelectedLocation(data[0]);
        } catch (error) {
            console.error("Error fetching locations:", error);
        }
    };

    // Add this to the useEffect hook that calls fetchCategories and fetchLocations
    useEffect(() => {
        fetchCategories();
        fetchLocations();
        fetchSkills(); // Add this line to fetch skills on component mount
    }, []);

    const handleNext = () => {
        if (step === 1 && !selectedCategory) {
            alert("Please select a category");
            return;
        }

        if (step === 2 && (!jobDetails.title || !jobDetails.description)) {
            alert("Please enter job title and description");
            return;
        }

        if (step === 2.5) {
            // Photos are optional, so we can proceed even if no images
            setStep(3);
            return;
        }

        if (step === 3) {
            if (!jobDetails.amount) {
                alert("Please fill all required fields");
                return;
            }
            setStep(4); // Go to review step
            return;
        }

        if (step === 4) {
            handleSubmitJob();
            return;
        }

        if (step === 2) {
            setStep(2.5); // Go to photos sub-step
        } else {
            setStep(step + 1);
        }
    };

    const handleCategorySelect = (category: Category) => {
        setSelectedCategory(category);
    };

    const pickImages = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.granted === false) {
            alert("Permission to access camera roll is required!");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            const newImages = [...jobDetails.images];
            if (newImages.length < 5) {
                newImages.push(result.assets[0].uri);
                setJobDetails({ ...jobDetails, images: newImages });
            } else {
                alert("Maximum 5 images allowed");
            }
        }
    };

    // Handle skill search
    const handleSkillSearch = (text: string) => {
        setSkillSearchQuery(text);
        if (text.length > 1) {
            fetchSkills(text);
        } else {
            setFilteredSkills([]);
        }
    };

    // Add skill to selected skills
    const addSkill = (skill: Skill) => {
        if (!selectedSkills.some((s) => s.id === skill.id)) {
            setSelectedSkills([...selectedSkills, skill]);
            setSkillSearchQuery("");
            setFilteredSkills([]);
        }
    };

    // Remove skill from selected skills
    const removeSkill = (skillId: string) => {
        setSelectedSkills(selectedSkills.filter((skill) => skill.id !== skillId));
    };

    const removeImage = (index: number) => {
        const newImages = [...jobDetails.images];
        newImages.splice(index, 1);
        setJobDetails({ ...jobDetails, images: newImages });
    };

    const handleSubmitJob = async () => {
        try {
            setSubmitting(true);

            if (!user) {
                alert("You must be logged in to create a job");
                return;
            }

            // Use the selected location instead of expecting locations to be a single object
            if (!selectedLocation) {
                alert("Please select a location");
                setSubmitting(false);
                return;
            }

            // 1. First upload images to storage
            const imageUrls = await uploadImages();

            // 2. Insert job data into database
            const { data, error } = await supabase
                .from("jobs")
                .insert([
                    {
                        user_id: user.id,
                        category_id: selectedCategory?.id,
                        title: jobDetails.title,
                        description: jobDetails.description,
                        images: imageUrls,
                        payment_type: jobDetails.paymentType,
                        amount: Number.parseFloat(jobDetails.amount),
                        currency: jobDetails.currency,
                        time_required: Number.parseInt(jobDetails.timeRequired),
                        time_unit: jobDetails.timeUnit,
                        skill_level: jobDetails.skillLevel,
                        location_id: selectedLocation.id,
                        status: "open", // Initial status
                        created_at: new Date(),
                        required_skills: selectedSkills.map((skill) => skill.id),
                        location_address: selectedLocation.address, // Use the address from selectedLocation
                    },
                ])
                .select();

            if (error) throw error;

            // 3. Use router to navigate instead of navigation
            router.push({
                pathname: "/Home",
                params: { jobId: data[0].id },
            });
        } catch (error) {
            console.error("Error creating job:", error);
            alert(`Failed to create job: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const uploadImages = async (): Promise<string[]> => {
        try {
            // Early return if no images to upload
            if (jobDetails.images.length === 0) return [];

            const uploadedImageUrls: string[] = [];

            for (let i = 0; i < jobDetails.images.length; i++) {
                const image = jobDetails.images[i];
                setUploadProgress((i / jobDetails.images.length) * 100);

                // Create a unique file name
                const fileExt = image.split(".").pop();
                const fileName = `${user.id}/${uuidv4()}.${fileExt}`;
                const filePath = `${fileName}`;

                // Read the file as base64
                const fileInfo = await FileSystem.getInfoAsync(image);
                if (!fileInfo.exists) {
                    console.error("File doesn't exist");
                    continue;
                }

                const base64 = await FileSystem.readAsStringAsync(image, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                // Upload to Supabase Storage
                const { data, error } = await supabase.storage
                    .from("job_photos")
                    .upload(filePath, decode(base64), {
                        contentType: "image/jpeg",
                        upsert: false,
                    });

                if (error) {
                    console.error("Error uploading image:", error);
                    continue;
                }

                // Get the public URL
                const { data: { publicUrl } } = supabase.storage
                    .from("job_photos")
                    .getPublicUrl(filePath);

                uploadedImageUrls.push(publicUrl);
            }

            setUploadProgress(100);
            return uploadedImageUrls;
        } catch (error) {
            console.error("Error uploading images:", error);
            Alert.alert("Error", "Could not upload images");
            return [];
        }
    };

    // Helper function to decode base64
    const decode = (base64: string): Uint8Array => {
        return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    };

    const filteredCategories = searchQuery
        ? categories.filter((cat) => cat.name.toLowerCase().includes(searchQuery.toLowerCase()) && cat.type === "online")
        : [];

    // Custom progress step component
    const ProgressStep = ({ number, title, active, stepNumber }: { number: number; title: string; active: boolean; stepNumber: number }) => (
        <TouchableOpacity className="items-center" onPress={() => navigateToStep(stepNumber)} activeOpacity={0.7}>
            <View
                className={`rounded-full h-8 w-8 items-center justify-center ${active ? "bg-[#00684A]" : "border-2 border-gray-400"}`}
            >
                <Text className={active ? "text-white font-bold" : "text-gray-400 font-bold"}>{number}</Text>
            </View>
            <Text
                className={active ? "text-[#00684A] font-pitalic text-xs mt-1" : "text-gray-400 text-xs font-pregular mt-1"}
            >
                {title}
            </Text>
        </TouchableOpacity>
    );

    const renderJobDetailsStep = () => (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <ScrollView className="flex-1 px-6">
                {/* Sub-step indicators */}
                <View className="flex-row justify-center mt-2 mb-4">
                    <TouchableOpacity className="mx-1" onPress={() => setStep(2)} activeOpacity={0.7}>
                        <View className={`h-2 w-2 rounded-full ${step === 2 ? "bg-[#00684A]" : "bg-gray-300"}`} />
                    </TouchableOpacity>
                    <TouchableOpacity className="mx-1" onPress={() => navigateToStep(2.5)} activeOpacity={0.7}>
                        <View className={`h-2 w-2 rounded-full ${step === 2.5 ? "bg-[#00684A]" : "bg-gray-300"}`} />
                    </TouchableOpacity>
                </View>

                {/* Job Title */}
                <View className="mt-2">
                    <Text className="text-lg font-psemibold mb-1">Job Title</Text>
                    <Text className="text-gray-500 font-pmediumitalic mb-2">Create a clear, specific title</Text>
                    <TextInput
                        className="bg-gray-100 rounded-lg p-3 text-gray-600"
                        placeholder="e.g. Logo Design for Tech Startup"
                        value={jobDetails.title}
                        onChangeText={(text) => setJobDetails({ ...jobDetails, title: text })}
                    />
                </View>

                {/* Job Description */}
                <View className="mt-6">
                    <Text className="text-lg font-psemibold mb-1">Job Description</Text>
                    <Text className="text-gray-500 font-pmediumitalic mb-2">Describe the job requirements in detail</Text>
                    <TextInput
                        className="bg-gray-100 rounded-lg p-3 text-gray-600 h-32"
                        placeholder="Describe your job requirements, expectations, and any specific details..."
                        multiline
                        textAlignVertical="top"
                        value={jobDetails.description}
                        onChangeText={(text) => setJobDetails({ ...jobDetails, description: text })}
                    />
                </View>
            </ScrollView>

            {/* Next Button */}
            <View className="mx-6 mt-auto mb-8">
                <TouchableOpacity className="bg-[#0D9F6F] rounded-lg p-4 items-center" onPress={handleNext}>
                    <Text className="text-white font-psemibold text-lg">Next</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );

    const renderPhotosStep = () => (
        <View className="flex-1 px-6">
            {/* Sub-step indicators */}
            <View className="flex-row justify-center mt-2 mb-4">
                <TouchableOpacity className="mx-1" onPress={() => navigateToStep(2)} activeOpacity={0.7}>
                    <View className={`h-2 w-2 rounded-full ${step === 2 ? "bg-[#00684A]" : "bg-gray-300"}`} />
                </TouchableOpacity>
                <TouchableOpacity className="mx-1" onPress={() => navigateToStep(2.5)} activeOpacity={0.7}>
                    <View className={`h-2 w-2 rounded-full ${step === 2.5 ? "bg-[#00684A]" : "bg-gray-300"}`} />
                </TouchableOpacity>
            </View>

            <View className="mt-2">
                <Text className="text-2xl font-bold mb-1">Add photos</Text>
                <Text className="text-gray-500 text-lg mb-6">Add photos to better describe your job</Text>

                {/* Skip button */}
                <TouchableOpacity className="absolute top-0 right-0" onPress={() => setStep(3)}>
                    <Text className="text-[#0D9F6F] text-lg font-pmedium">Skip</Text>
                </TouchableOpacity>

                {/* Image preview grid */}
                {jobDetails.images.length > 0 ? (
                    <View className="flex-row flex-wrap">
                        {jobDetails.images.map((img, index) => (
                            <View key={index} className="w-1/3 p-1 relative">
                                <Image source={{ uri: img }} className="w-full h-24 rounded-md" />
                                <TouchableOpacity
                                    className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1"
                                    onPress={() => removeImage(index)}
                                >
                                    <Ionicons name="close" size={18} color="white" />
                                </TouchableOpacity>
                            </View>
                        ))}

                        {jobDetails.images.length < 5 && (
                            <TouchableOpacity
                                className="w-1/3 h-24 bg-gray-100 rounded-md p-1 items-center justify-center"
                                onPress={pickImages}
                            >
                                <Ionicons name="add" size={30} color="gray" />
                                <Text className="text-gray-500 text-xs">Add Photo</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <TouchableOpacity
                        className="border-2 border-[#0D9F6F] border-dashed rounded-xl p-10 items-center justify-center"
                        style={{ borderColor: "#0D9F6F" }}
                        onPress={pickImages}
                    >
                        <View className="bg-gray-200 rounded-full p-4 mb-4">
                            <Ionicons name="arrow-up" size={24} color="#666" />
                        </View>
                        <Text className="text-[#0D9F6F] text-lg font-pmedium mb-2">Tap to upload photo</Text>
                        <Text className="text-gray-500 text-sm">JPG or PNG (Max 1200x800px)</Text>
                    </TouchableOpacity>
                )}

                {/* Upload Progress Indicator */}
                {uploadProgress > 0 && (
                    <View className="mt-4">
                        <Text className="text-center mb-2">Uploading: {Math.round(uploadProgress)}%</Text>
                        <View style={{
                            height: 10,
                            backgroundColor: '#e0e0e0',
                            borderRadius: 5,
                        }}>
                            <View style={{
                                height: '100%',
                                width: `${uploadProgress}%`,
                                backgroundColor: '#0D9F6F',
                                borderRadius: 5,
                            }} />
                        </View>
                    </View>
                )}
            </View>

            {/* Next Button */}
            <View className="mx-6 mt-auto mb-8">
                <TouchableOpacity className="bg-[#0D9F6F] rounded-lg p-4 items-center" onPress={handleNext}>
                    <Text className="text-white font-psemibold text-lg">Next</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderPaymentDetailsStep = () => (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <ScrollView className="flex-1 px-6">
                {/* Payment Type Selection */}
                <View className="mt-6">
                    <Text className="text-lg font-psemibold mb-2">Payment Type</Text>
                    <View className="flex-row">
                        <TouchableOpacity
                            className={`flex-1 p-3 rounded-l-lg ${jobDetails.paymentType === "hourly" ? "bg-[#00684A]" : "bg-gray-200"}`}
                            onPress={() => setJobDetails({ ...jobDetails, paymentType: "hourly" })}
                        >
                            <Text
                                className={`text-center font-psemibold ${jobDetails.paymentType === "hourly" ? "text-white" : "text-gray-600"}`}
                            >
                                Hourly Rate
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 p-3 rounded-r-lg ${jobDetails.paymentType === "project" ? "bg-[#00684A]" : "bg-gray-200"}`}
                            onPress={() => setJobDetails({ ...jobDetails, paymentType: "project" })}
                        >
                            <Text
                                className={`text-center font-pmedium ${jobDetails.paymentType === "project" ? "text-white" : "text-gray-600"}`}
                            >
                                Project Based
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Amount */}
                <View className="mt-6 flex-row items-center">
                    <Text className="text-lg font-psemibold mb-1">
                        {jobDetails.paymentType === "hourly" ? "Hourly Rate" : "Project Budget"}
                    </Text>
                    <TouchableOpacity
                        onPress={() => Alert.alert("Estimated Budget", "This is your estimated budget for the job. The final amount may change after negotiations.")}
                        className="ml-2"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="information-circle-outline" size={16} color="#888" />
                    </TouchableOpacity>
                </View>
                <View className="flex-row items-center">
                    <TextInput
                        className="bg-gray-100 rounded-lg p-3 text-gray-600 flex-1"
                        placeholder="0.00"
                        keyboardType="numeric"
                        value={jobDetails.amount}
                        onChangeText={(text) => setJobDetails({ ...jobDetails, amount: text })}
                    />
                    <View className="ml-2 bg-gray-100 rounded-lg p-3 w-24">
                        <Text className="text-gray-600 text-center">PKR</Text>
                    </View>
                </View>

                {/* Time Required */}
                <View className="mt-6 flex-row items-center">
                    <Text className="text-lg font-psemibold mb-1">Time Required</Text>
                    <TouchableOpacity
                        onPress={() => Alert.alert("Estimated Time Required", "This is your estimated time required for the job. The final duration may change after negotiations.")}
                        className="ml-2"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="information-circle-outline" size={16} color="#888" />
                    </TouchableOpacity>
                </View>
                <View className="flex-row items-center">
                    <TextInput
                        className="bg-gray-100 rounded-lg p-3 text-gray-600 flex-1"
                        placeholder="e.g. 2"
                        keyboardType="numeric"
                        value={jobDetails.timeRequired}
                        onChangeText={(text) => setJobDetails({ ...jobDetails, timeRequired: text })}
                    />
                    <View className="ml-2 bg-gray-100 rounded-lg p-3 w-24">
                        <Text className="text-gray-600 text-center">{jobDetails.timeUnit}</Text>
                    </View>
                </View>
                {/* Skills Required */}
                <View className="mt-6 mb-6">
                    <Text className="text-lg font-psemibold mb-1">Skills Required</Text>
                    <Text className="text-gray-500 font-pmediumitalic mb-2">Search and add skills needed for this job</Text>
                    {/* Skills search input */}
                    <View className="relative z-10">
                        <TextInput
                            className="bg-gray-100 rounded-lg p-3 text-gray-600"
                            placeholder="Search skills..."
                            value={skillSearchQuery}
                            onChangeText={handleSkillSearch}
                        />

                        {/* Skills dropdown */}
                        {skillSearchQuery.length > 1 && filteredSkills.length > 0 && (
                            <View className="absolute top-full left-0 right-0 bg-white rounded-lg shadow-md z-20 mt-1 max-h-40 border border-gray-200">
                                <ScrollView>
                                    {filteredSkills.map((skill) => (
                                        <TouchableOpacity
                                            key={skill.id}
                                            className="p-3 border-b border-gray-100"
                                            onPress={() => addSkill(skill)}
                                        >
                                            <Text>{skill.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {isLoadingSkills && (
                            <View className="absolute right-3 top-3">
                                <Text>Loading...</Text>
                            </View>
                        )}
                    </View>

                    {/* Selected skills pills */}
                    {selectedSkills.length > 0 && (
                        <View className="flex-row flex-wrap mt-3">
                            {selectedSkills.map((skill) => (
                                <View key={skill.id} className="bg-[#E6F7F1] rounded-full px-3 py-1 mr-2 mb-2 flex-row items-center">
                                    <Text className="text-[#00684A] mr-1">{skill.name}</Text>
                                    <TouchableOpacity onPress={() => removeSkill(skill.id)}>
                                        <Ionicons name="close-circle" size={16} color="#00684A" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
                {/* Skill Level */}
                <View className="mt-2 mb-8">
                    <Text className="text-lg font-semibold mb-2">Skill Level</Text>
                    <View className="flex-row h-10 rounded-lg overflow-hidden">
                        <TouchableOpacity
                            className={`flex-1 justify-center items-center ${
                                jobDetails.skillLevel === "amateur" ? "bg-[#00684A]" : "bg-gray-200"
                            }`}
                            onPress={() => setJobDetails({ ...jobDetails, skillLevel: "amateur" })}
                        >
                            <Text
                                className={`text-center font-pmedium ${
                                    jobDetails.skillLevel === "amateur" ? "text-white" : "text-gray-600"
                                }`}
                            >
                                Amateur
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className={`flex-1 justify-center items-center border-x border-white ${
                                jobDetails.skillLevel === "intermediate" ? "bg-[#00684A]" : "bg-gray-200"
                            }`}
                            onPress={() => setJobDetails({ ...jobDetails, skillLevel: "intermediate" })}
                        >
                            <Text
                                className={`text-center font-pmedium ${
                                    jobDetails.skillLevel === "intermediate" ? "text-white" : "text-gray-600"
                                }`}
                            >
                                Intermediate
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className={`flex-1 justify-center items-center ${
                                jobDetails.skillLevel === "professional" ? "bg-[#00684A]" : "bg-gray-200"
                            }`}
                            onPress={() => setJobDetails({ ...jobDetails, skillLevel: "professional" })}
                        >
                            <Text
                                className={`text-center font-pmedium ${
                                    jobDetails.skillLevel === "professional" ? "text-white" : "text-gray-600"
                                }`}
                            >
                                Professional
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Next Button */}
            <View className="mx-6 mt-auto mb-8">
                <TouchableOpacity className="bg-[#0D9F6F] rounded-lg p-4 items-center" onPress={handleNext}>
                    <Text className="text-white font-psemibold text-lg">Next</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );

    const renderReviewStep = () => (
        <View className="flex-1">
            <ScrollView className="flex-1 px-6">
                <View className="mt-6">
                    <Text className="text-2xl font-psemibold mb-4">Review Job Details</Text>

                    {/* Category */}
                    <View className="mb-4">
                        <Text className="text-gray-500 font-pmedium mb-1">Category</Text>
                        <Text className="text-lg font-semibold">{selectedCategory?.name || "Not selected"}</Text>
                    </View>

                    {/* Title */}
                    <View className="mb-4">
                        <Text className="text-gray-500 font-pmedium mb-1">Job Title</Text>
                        <Text className="text-lg font-semibold">{jobDetails.title}</Text>
                    </View>

                    {/* Description */}
                    <View className="mb-4">
                        <Text className="text-gray-500 font-pmedium mb-1">Description</Text>
                        <Text className="text-base">{jobDetails.description}</Text>
                    </View>

                    {/* Images */}
                    {jobDetails.images.length > 0 && (
                        <View className="mb-4">
                            <Text className="text-gray-500 font-pmedium mb-2">Photos</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {jobDetails.images.map((uri, index) => (
                                    <Image key={index} source={{ uri }} className="w-20 h-20 rounded-md mr-2" />
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Payment */}
                    <View className="mb-4">
                        <Text className="text-gray-500 font-pmedium mb-1">Payment</Text>
                        <Text className="text-lg font-semibold">
                            {jobDetails.amount} PKR ({jobDetails.paymentType === "hourly" ? "Hourly Rate" : "Project Based"})
                        </Text>
                    </View>

                    {/* Time Required */}
                    <View className="mb-4">
                        <Text className="text-gray-500 font-psemibold mb-1">Time Required</Text>
                        <Text className="text-lg font-semibold">
                            {jobDetails.timeRequired} {jobDetails.timeUnit}
                        </Text>
                    </View>

                    {/* Skill Level */}
                    <View className="mb-4">
                        <Text className="text-gray-500 font-pmedium mb-1">Skill Level</Text>
                        <Text className="text-lg font-semibold capitalize">{jobDetails.skillLevel}</Text>
                    </View>

                    {/* Location */}
                    <View className="mb-4">
                        <Text className="text-gray-500 font-pmedium mb-1">Location</Text>
                        <Text className="text-lg font-semibold">
                            {selectedLocation ? selectedLocation.address : "Your primary location"}
                        </Text>
                    </View>

                    {/* Skills */}
                    {selectedSkills.length > 0 && (
                        <View className="mb-4">
                            <Text className="text-gray-500 font-pmedium mb-1">Skills Required</Text>
                            <View className="flex-row flex-wrap">
                                {selectedSkills.map((skill) => (
                                    <View key={skill.id} className="bg-[#E6F7F1] rounded-full px-3 py-1 mr-2 mb-2">
                                        <Text className="text-[#00684A]">{skill.name}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Add some padding at the bottom to ensure content doesn't get hidden behind the button */}
                    <View className="h-20" />
                </View>
            </ScrollView>

            {/* Submit Button - Now outside the ScrollView */}
            <View className="px-6 absolute bottom-8 left-0 right-0 bg-white">
                <TouchableOpacity
                    className="bg-[#0D9F6F] rounded-lg p-4 items-center"
                    onPress={handleNext}
                    disabled={submitting}
                >
                    <Text className="text-white font-psemibold text-lg">{submitting ? "Submitting..." : "Post Job"}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                   <View className="flex-1 px-6">
        <Text className="text-lg font-psemibold mb-4">Select a Category</Text>
        <TextInput
            className="bg-gray-100 rounded-lg p-3 text-gray-600 mb-4"
            placeholder="Search categories..."
            value={searchQuery}
            onChangeText={setSearchQuery}
        />
        {/* Add this block for the heading */}
        {!searchQuery && (
            <Text className="text-base font-pmediumitalic mb-2 text-gray-700">
                Popular Categories
            </Text>
        )}
        <FlatList
            data={searchQuery ? filteredCategories : topCategories}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
                <TouchableOpacity
                    className={`p-4 mb-2 rounded-lg ${selectedCategory?.id === item.id ? "bg-[#00684A]" : "bg-gray-100"}`}
                    onPress={() => handleCategorySelect(item)}
                >
                    <Text className={`font-pmedium ${selectedCategory?.id === item.id ? "text-white" : "text-gray-600"}`}>
                        {item.name}
                    </Text>
                </TouchableOpacity>
            )}
        />
        <View className="mx-6 mt-auto mb-8">
            <TouchableOpacity className="bg-[#0D9F6F] rounded-lg p-4 items-center" onPress={handleNext}>
                <Text className="text-white font-psemibold text-lg">Next</Text>
            </TouchableOpacity>
        </View>
    </View>
                );
            case 2:
                return renderJobDetailsStep();
            case 2.5:
                return renderPhotosStep();
            case 3:
                return renderPaymentDetailsStep();
            case 4:
                return renderReviewStep();
            default:
                return null;
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="light-content" />

            {/* Custom Header with Back Button - Reverted to original color */}
            <View className="bg-[#0D9F6F] pt-7 pb-6 rounded-b-[40px]">
                <View className="flex-row items-center px-6 pt-2">
                    <TouchableOpacity onPress={handleBack} className="p-2">
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <Text className="flex-1 text-center text-white text-xl font-psemibold mr-10">Online Job Creation</Text>
                </View>
            </View>

            <View className="flex-1">
                {/* Progress Steps */}
                <View className="flex-row justify-between px-6 mt-3 mb-3 ">
                    <ProgressStep number={1} title="Category" active={step === 1} stepNumber={1} />
                    <ProgressStep number={2} title="Description" active={step === 2 || step === 2.5} stepNumber={2} />
                    <ProgressStep number={3} title="Details" active={step === 3} stepNumber={3} />
                    <ProgressStep number={4} title="Review" active={step === 4} stepNumber={4} />
                </View>

                {/* Step Content */}
                {renderStepContent()}
            </View>
        </SafeAreaView>
    );
};

export default OnlineJobCreationScreen;