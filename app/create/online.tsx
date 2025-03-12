import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase'; // Adjust the import path based on your project structure

const OnlineJobCreationScreen = ({ navigation }) => {
    const [step, setStep] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [topCategories, setTopCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch categories from Supabase backend
    const fetchCategories = async () => {
        try {
            setLoading(true);

            // Fetch all categories
            const { data, error } = await supabase
                .from('job_categories')
                .select('*')
                .order('popularity_score', { ascending: false });

            if (error) throw error;

            setCategories(data || []);

            // Get top categories with highest popularity scores
            const onlineCategories = data.filter(cat => cat.type === 'online');
            setTopCategories(onlineCategories.slice(0, 4));

        } catch (error) {
            console.error('Error fetching categories:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleNext = () => {
        if (selectedCategory) {
            // Store the selection in state management (Redux, Context, etc.)
            console.log("Selected category:", selectedCategory);
            setStep(step + 1);
            // navigation.navigate('EnterDetails', { selectedCategory });
        } else {
            // Show validation error
            alert("Please select a category");
        }
    };

    const handleCategorySelect = (category) => {
        setSelectedCategory(category);
    };

    const filteredCategories = searchQuery
        ? categories.filter(cat =>
            cat.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            cat.type === 'online')
        : [];

    // Custom progress step component
    const ProgressStep = ({ number, title, active }) => (
        <View className="items-center">
            <View className={`rounded-full h-8 w-8 items-center justify-center ${active ? 'bg-[#53F3AE]' : 'border-2 border-gray-400'}`}>
                <Text className={active ? 'text-white font-bold' : 'text-gray-400 font-bold'}>
                    {number}
                </Text>
            </View>
            <Text className={active ? 'text-[#53F3AE] font-pregular text-xs mt-1' : 'text-gray-400 text-xs font-pregular mt-1'}>
                {title}
            </Text>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="bg-[#53F3AE] rounded-b-3xl pt-6 pb-6 px-6">
                <Text className="text-white text-center mt-4 text-xl font-psemibold">
                    Online Job Creation
                </Text>
            </View>

            {/* Custom Progress Steps */}
            <View className="flex-row justify-center items-center mx-10 mt-4">
                <ProgressStep number={1} title="Select Category" active={step === 1} />

                <View className="flex-1 h-px bg-gray-300 mx-1" />

                <ProgressStep number={2} title="Enter Details" active={step === 2} />

                <View className="flex-1 h-px bg-gray-300 mx-1" />

                <ProgressStep number={3} title="" active={step === 3} />

                <View className="flex-1 h-px bg-gray-300 mx-1" />

                <ProgressStep number={4} title="" active={step === 4} />
            </View>

            {/* Main content - only shown on step 1 */}
            {step === 1 && (
                <>
                    {/* Search Bar */}
                    <View className="mx-6 mt-8">
                        <Text className="text-lg font-psemibold mb-1 flex-row items-center">
                            🔍 Search
                        </Text>
                        <Text className="text-gray-500 font-pregular mb-3">Find and select your job category</Text>
                        <TextInput
                            className="bg-gray-100 rounded-lg p-3 text-gray-600"
                            placeholder="Type here to Search..."
                            placeholderTextColor="#A0AEC0"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    {/* Search Results (only show when searching) */}
                    {searchQuery.length > 0 && (
                        <ScrollView className="mx-6 mt-2 max-h-32">
                            {filteredCategories.map((category) => (
                                <TouchableOpacity
                                    key={category.id}
                                    className="py-2 border-b border-gray-100"
                                    onPress={() => handleCategorySelect(category)}
                                >
                                    <Text className="font-pregular">{category.name}</Text>
                                </TouchableOpacity>
                            ))}
                            {filteredCategories.length === 0 && (
                                <Text className="text-gray-500 font-pregular py-2">No matching categories found</Text>
                            )}
                        </ScrollView>
                    )}

                    {/* Popular Categories */}
                    <View className="mx-6 mt-6">
                        <Text className="text-lg font-psemibold mb-1 flex-row items-center">
                            🔥 Popular Categories Right Now
                        </Text>
                        <Text className="text-gray-500 font-pregular mb-4">Most searched for in your area</Text>

                        {loading ? (
                            <Text className="text-center py-4">Loading categories...</Text>
                        ) : error ? (
                            <Text className="text-center text-red-500 py-4">Error: {error}</Text>
                        ) : (
                            topCategories.map((category) => (
                                <TouchableOpacity
                                    key={category.id}
                                    className="bg-[#53F3AE] rounded-lg p-4 mb-3 items-center"
                                    onPress={() => handleCategorySelect(category)}
                                >
                                    <Text className="text-white font-pmedium">{category.name}</Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>

                    {/* Next Button */}
                    <View className="mx-6 mt-auto mb-8">
                        <TouchableOpacity
                            className="bg-[#53F3AE] rounded-lg p-4 items-center"
                            onPress={handleNext}
                            disabled={!selectedCategory}
                        >
                            <Text className="text-white font-psemibold text-lg">Next</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </SafeAreaView>
    );
};

export default OnlineJobCreationScreen;