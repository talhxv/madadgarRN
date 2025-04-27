import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, TextInput, ScrollView, Switch, Animated } from 'react-native';
import { Plus, Building2, GraduationCap, X, Check, Trash2, Calendar, MapPin, Briefcase } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/supabaseClient';
import { Education, Experience } from '@/types/types'

interface Props {
    userId: string;
    educations: Education[];
    experiences: Experience[];
    fetchEducationAndExperience: (userId: string) => Promise<void>;
    setIsEducationExperienceChanged: (value: boolean) => void;
}

export const EducationExperienceSection = ({ userId, educations, experiences, fetchEducationAndExperience, setIsEducationExperienceChanged }: Props) => {
    const [isEducationModalVisible, setIsEducationModalVisible] = useState(false);
    const [isExperienceModalVisible, setIsExperienceModalVisible] = useState(false);
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [educationModalAnimation] = useState(new Animated.Value(0));
    const [experienceModalAnimation] = useState(new Animated.Value(0));

    const [newEducation, setNewEducation] = useState<Partial<Education>>({
        institution_name: '',
        degree: '',
        field_of_study: '',
        start_date: new Date().toISOString(),
        is_current: false,
        grade: '',
        description: ''
    });

    const [newExperience, setNewExperience] = useState<Partial<Experience>>({
        company_name: '',
        position: '',
        location: '',
        is_remote: false,
        start_date: new Date().toISOString(),
        is_current: false,
        description: '',
        skills: [],
        type: 'offline'
    });

    // Animation for modals
    useEffect(() => {
        if (isEducationModalVisible) {
            Animated.spring(educationModalAnimation, {
                toValue: 1,
                useNativeDriver: true,
                tension: 65,
                friction: 7,
            }).start();
        } else {
            Animated.timing(educationModalAnimation, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [isEducationModalVisible]);

    useEffect(() => {
        if (isExperienceModalVisible) {
            Animated.spring(experienceModalAnimation, {
                toValue: 1,
                useNativeDriver: true,
                tension: 65,
                friction: 7,
            }).start();
        } else {
            Animated.timing(experienceModalAnimation, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [isExperienceModalVisible]);

    const saveEducation = async () => {
        if (!newEducation.institution_name || !newEducation.degree || !newEducation.field_of_study) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        setIsSaving(true);
        try {
            const { data, error } = await supabase
                .from('user_education')
                .insert([
                    {
                        ...newEducation,
                        user_id: userId,
                        end_date: newEducation.is_current ? null : newEducation.end_date
                    }
                ]);

            if (error) throw error;

            // Call the fetch function to refresh the data
            await fetchEducationAndExperience(userId);

            // Notify parent of changes
            setIsEducationExperienceChanged(true);

            setIsEducationModalVisible(false);
            setNewEducation({
                institution_name: '',
                degree: '',
                field_of_study: '',
                start_date: new Date().toISOString(),
                is_current: false,
                grade: '',
                description: ''
            });
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const saveExperience = async () => {
        if (!newExperience.company_name || !newExperience.position) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        setIsSaving(true);
        try {
            const { data, error } = await supabase
                .from('user_experience')
                .insert([
                    {
                        ...newExperience,
                        user_id: userId,
                        end_date: newExperience.is_current ? null : newExperience.end_date
                    }
                ]);

            if (error) throw error;

            // Call the fetch function to refresh the data
            await fetchEducationAndExperience(userId);

            // Notify parent of changes
            setIsEducationExperienceChanged(true);

            setIsExperienceModalVisible(false);
            setNewExperience({
                company_name: '',
                position: '',
                location: '',
                is_remote: false,
                start_date: new Date().toISOString(),
                is_current: false,
                description: '',
                skills: [],
                type: 'offline'
            });
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteEducation = async (educationId: string) => {
        Alert.alert(
            "Delete Education",
            "Are you sure you want to delete this education entry?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            const { error } = await supabase
                                .from('user_education')
                                .delete()
                                .eq('id', educationId)
                                .eq('user_id', userId);

                            if (error) throw error;

                            // Call the fetch function to refresh the data
                            await fetchEducationAndExperience(userId);

                            // Notify parent of changes
                            setIsEducationExperienceChanged(true);
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        } finally {
                            setIsDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    const deleteExperience = async (experienceId: string) => {
        Alert.alert(
            "Delete Experience",
            "Are you sure you want to delete this experience entry?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            const { error } = await supabase
                                .from('user_experience')
                                .delete()
                                .eq('id', experienceId)
                                .eq('user_id', userId);

                            if (error) throw error;

                            // Call the fetch function to refresh the data
                            await fetchEducationAndExperience(userId);

                            // Notify parent of changes
                            setIsEducationExperienceChanged(true);
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        } finally {
                            setIsDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short'
        });
    };

    const educationTranslateY = educationModalAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [300, 0],
    });

    const experienceTranslateY = experienceModalAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [300, 0],
    });

    return (
        <View>
            {/* Education Section */}
            <View className="mb-6">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-gray-800 font-pbold text-base">Education</Text>
                    <TouchableOpacity
                        className="bg-[#0D9F70] p-2 rounded-full"
                        onPress={() => setIsEducationModalVisible(true)}
                    >
                        <Plus size={18} color="white" />
                    </TouchableOpacity>
                </View>

                {educations.length === 0 ? (
                    <View className="bg-gray-50 p-4 rounded-xl mb-3 items-center justify-center">
                        <Text className="text-gray-500 font-pregular">No education entries yet</Text>
                    </View>
                ) : (
                    educations.map((education) => (
                        <View key={education.id} className="bg-white p-4 rounded-xl mb-3 border border-gray-100 shadow-sm">
                            <View className="flex-row items-start">
                                <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                                    <GraduationCap size={18} color="#0D9F70" />
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row justify-between items-start">
                                        <View className="flex-1 mr-2">
                                            <Text className="font-pbold text-gray-900">{education.institution_name}</Text>
                                            <Text className="text-gray-600 font-pregular">{education.degree} in {education.field_of_study}</Text>
                                        </View>
                                        <TouchableOpacity 
                                            onPress={() => deleteEducation(education.id)}
                                            className="p-2 rounded-full bg-red-50"
                                            disabled={isDeleting}
                                        >
                                            <Trash2 size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                    <Text className="text-gray-500 text-sm mt-1 font-pregular">
                                        {formatDate(education.start_date)} - {education.is_current ? 'Present' : formatDate(education.end_date!)}
                                    </Text>
                                    {education.grade && (
                                        <Text className="text-gray-500 text-sm mt-1 font-pregular">Grade: {education.grade}</Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    ))
                )}
            </View>

            {/* Experience Section */}
            <View>
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-gray-800 font-pbold text-base">Experience</Text>
                    <TouchableOpacity
                        className="bg-[#0D9F70] p-2 rounded-full"
                        onPress={() => setIsExperienceModalVisible(true)}
                    >
                        <Plus size={18} color="white" />
                    </TouchableOpacity>
                </View>

                {experiences.length === 0 ? (
                    <View className="bg-gray-50 p-4 rounded-xl mb-3 items-center justify-center">
                        <Text className="text-gray-500 font-pregular">No experience entries yet</Text>
                    </View>
                ) : (
                    experiences.map((experience) => (
                        <View key={experience.id} className="bg-white p-4 rounded-xl mb-3 border border-gray-100 shadow-sm">
                            <View className="flex-row items-start">
                                <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                                    <Briefcase size={18} color="#0D9F70" />
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row justify-between items-start">
                                        <View className="flex-1 mr-2">
                                            <Text className="font-pbold text-gray-900">{experience.position}</Text>
                                            <Text className="text-gray-600 font-pregular">{experience.company_name}</Text>
                                        </View>
                                        <TouchableOpacity 
                                            onPress={() => deleteExperience(experience.id)}
                                            className="p-2 rounded-full bg-red-50"
                                            disabled={isDeleting}
                                        >
                                            <Trash2 size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                    <View className="flex-row items-center mt-1">
                                        <View className={`px-2 py-1 rounded-full mr-2 ${
                                            experience.type === 'online' ? 'bg-blue-100' :
                                                experience.type === 'offline' ? 'bg-[#E7F7F1]' : 'bg-purple-100'
                                        }`}>
                                            <Text className={`text-xs font-pregular ${
                                                experience.type === 'online' ? 'text-blue-800' :
                                                    experience.type === 'offline' ? 'text-[#0D9F70]' : 'text-purple-800'
                                            }`}>
                                                {experience.type.charAt(0).toUpperCase() + experience.type.slice(1)}
                                            </Text>
                                        </View>
                                        {experience.is_remote && (
                                            <View className="px-2 py-1 bg-gray-100 rounded-full">
                                                <Text className="text-xs text-gray-800 font-pregular">Remote</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-gray-500 text-xs mt-1 font-pregular">
                                        {formatDate(experience.start_date)} - {experience.is_current ? 'Present' : formatDate(experience.end_date!)}
                                    </Text>
                                    {experience.location && (
                                        <Text className="text-gray-500 text-xs mt-1 font-pregular">{experience.location}</Text>
                                    )}
                                    {experience.skills && experience.skills.length > 0 && (
                                        <View className="flex-row flex-wrap mt-2">
                                            {experience.skills.map((skill, index) => (
                                                <View key={index} className="bg-gray-100 rounded-full px-2 py-1 mr-2 mb-2">
                                                    <Text className="text-xs text-gray-700 font-pregular">{skill}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    ))
                )}
            </View>

            {/* Education Modal */}
            <Modal
                visible={isEducationModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsEducationModalVisible(false)}
            >
                <View className="flex-1 justify-end">
                    <BlurView
                        intensity={20}
                        className="absolute top-0 left-0 right-0 bottom-0"
                        tint="dark"
                    />
                    <Animated.View
                        style={{
                            transform: [{ translateY: educationTranslateY }],
                            backgroundColor: 'white',
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            overflow: 'hidden',
                            maxHeight: '90%',
                        }}
                    >
                        <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />
                        
                        <View className="flex-row justify-between items-center px-6 pb-4">
                            <View className="flex-row items-center">
                                <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                                    <GraduationCap size={16} color="#0D9F70" />
                                </View>
                                <Text className="text-xl font-pbold text-gray-800">Add Education</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => setIsEducationModalVisible(false)}
                                className="p-2 rounded-full bg-gray-100"
                            >
                                <X size={20} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
                            <View className="mb-4">
                                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Institution Name *</Text>
                                <TextInput
                                    className="border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50 text-gray-800"
                                    value={newEducation.institution_name}
                                    onChangeText={(text) => setNewEducation(prev => ({ ...prev, institution_name: text }))}
                                    placeholder="Enter institution name"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Degree *</Text>
                                <TextInput
                                    className="border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50 text-gray-800"
                                    value={newEducation.degree}
                                    onChangeText={(text) => setNewEducation(prev => ({ ...prev, degree: text }))}
                                    placeholder="Enter degree"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Field of Study *</Text>
                                <TextInput
                                    className="border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50 text-gray-800"
                                    value={newEducation.field_of_study}
                                    onChangeText={(text) => setNewEducation(prev => ({ ...prev, field_of_study: text }))}
                                    placeholder="Enter field of study"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Grade</Text>
                                <TextInput
                                    className="border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50 text-gray-800"
                                    value={newEducation.grade}
                                    onChangeText={(text) => setNewEducation(prev => ({ ...prev, grade: text }))}
                                    placeholder="Enter grade (optional)"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Start Date</Text>
                                <TouchableOpacity
                                    className="border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50 flex-row items-center"
                                    onPress={() => setShowStartDatePicker(true)}
                                >
                                    <Calendar size={16} color="#0D9F70" className="mr-2" />
                                    <Text className="font-pregular text-gray-800">{formatDate(newEducation.start_date!)}</Text>
                                </TouchableOpacity>
                            </View>

                            <View className="mb-4 flex-row items-center justify-between">
                                <Text className="text-gray-600 font-pmedium text-sm">Currently Studying</Text>
                                <Switch
                                    value={newEducation.is_current}
                                    onValueChange={(value) => setNewEducation(prev => ({ ...prev, is_current: value }))}
                                    trackColor={{ false: "#E5E7EB", true: "#0D9F70" }}
                                    thumbColor="#FFFFFF"
                                />
                            </View>

                            {!newEducation.is_current && (
                                <View className="mb-4">
                                    <Text className="text-gray-600 mb-2 font-pmedium text-sm">End Date</Text>
                                    <TouchableOpacity
                                        className="border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50 flex-row items-center"
                                        onPress={() => setShowEndDatePicker(true)}
                                    >
                                        <Calendar size={16} color="#0D9F70" className="mr-2" />
                                        <Text className="font-pregular text-gray-800">{newEducation.end_date ? formatDate(newEducation.end_date) : 'Select end date'}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View className="mb-4">
                                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Description</Text>
                                <TextInput
                                    className="border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50 text-gray-800"
                                    value={newEducation.description}
                                    onChangeText={(text) => setNewEducation(prev => ({ ...prev, description: text }))}
                                    placeholder="Enter description (optional)"
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            {showStartDatePicker && (
                                <DateTimePicker
                                    value={new Date(newEducation.start_date!)}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowStartDatePicker(false);
                                        if (selectedDate) {
                                            setNewEducation(prev => ({ ...prev, start_date: selectedDate.toISOString() }));
                                        }
                                    }}
                                />
                            )}

                            {showEndDatePicker && !newEducation.is_current && (
                                <DateTimePicker
                                    value={new Date(newEducation.end_date || new Date())}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowEndDatePicker(false);
                                        if (selectedDate) {
                                            setNewEducation(prev => ({ ...prev, end_date: selectedDate.toISOString() }));
                                        }
                                    }}
                                />
                            )}

                            <TouchableOpacity
                                className={`py-4 rounded-xl items-center mb-8 shadow-sm flex-row justify-center ${isSaving ? 'bg-gray-300' : 'bg-[#0D9F70]'}`}
                                onPress={saveEducation}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <Text className="text-white font-psemibold text-lg">Saving...</Text>
                                ) : (
                                    <>
                                        <Check size={20} color="white" className="mr-2" />
                                        <Text className="text-white font-psemibold text-lg">Save Education</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>

            {/* Experience Modal */}
            <Modal
                visible={isExperienceModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsExperienceModalVisible(false)}
            >
                <View className="flex-1 justify-end">
                    <BlurView
                        intensity={20}
                        className="absolute top-0 left-0 right-0 bottom-0"
                        tint="dark"
                    />
                    <Animated.View
                        style={{
                            transform: [{ translateY: experienceTranslateY }],
                            backgroundColor: 'white',
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            overflow: 'hidden',
                            maxHeight: '90%',
                        }}
                    >
                        <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />
                        
                        <View className="flex-row justify-between items-center px-6 pb-4">
                            <View className="flex-row items-center">
                                <View className="w-8 h-8 rounded-full bg-[#E7F7F1] items-center justify-center mr-3">
                                    <Briefcase size={16} color="#0D9F70" />
                                </View>
                                <Text className="text-xl font-pbold text-gray-800">Add Experience</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => setIsExperienceModalVisible(false)}
                                className="p-2 rounded-full bg-gray-100"
                            >
                                <X size={20} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
                            <View className="mb-4">
                                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Company Name *</Text>
                                <TextInput
                                    className="border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50 text-gray-800"
                                    value={newExperience.company_name}
                                    onChangeText={(text) => setNewExperience(prev => ({ ...prev, company_name: text }))}
                                    placeholder="Enter company name"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Position *</Text>
                                <TextInput
                                    className="border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50 text-gray-800"
                                    value={newExperience.position}
                                    onChangeText={(text) => setNewExperience(prev => ({ ...prev, position: text }))}
                                    placeholder="Enter position"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Location</Text>
                                <TextInput
                                    className="border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50 text-gray-800 flex-row items-center"
                                    value={newExperience.location}
                                    onChangeText={(text) => setNewExperience(prev => ({ ...prev, location: text }))}
                                    placeholder="Enter location (optional)"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <View className="mb-4 flex-row items-center justify-between">
                                <Text className="text-gray-600 font-pmedium text-sm">Remote Work</Text>
                                <Switch
                                    value={newExperience.is_remote}
                                    onValueChange={(value) => setNewExperience(prev => ({ ...prev, is_remote: value }))}
                                    trackColor={{ false: "#E5E7EB", true: "#0D9F70" }}
                                    thumbColor="#FFFFFF"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Type</Text>
                                <View className="flex-row justify-around mt-2">
                                    {['online', 'offline', 'hybrid'].map((type) => (
                                        <TouchableOpacity
                                            key={type}
                                            className={`px-4 py-2 rounded-full ${newExperience.type === type ? 'bg-[#0D9F70]' : 'bg-gray-100'}`}
                                            onPress={() => setNewExperience(prev => ({ ...prev, type }))}
                                        >
                                            <Text className={`${newExperience.type === type ? 'text-white' : 'text-gray-700'} font-pregular`}>
                                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Start Date</Text>
                                <TouchableOpacity
                                    className="border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50 flex-row items-center"
                                    onPress={() => setShowStartDatePicker(true)}
                                >
                                    <Calendar size={16} color="#0D9F70" className="mr-2" />
                                    <Text className="font-pregular text-gray-800">{formatDate(newExperience.start_date!)}</Text>
                                </TouchableOpacity>
                            </View>

                            <View className="mb-4 flex-row items-center justify-between">
                                <Text className="text-gray-600 font-pmedium text-sm">Currently Working</Text>
                                <Switch
                                    value={newExperience.is_current}
                                    onValueChange={(value) => setNewExperience(prev => ({ ...prev, is_current: value }))}
                                    trackColor={{ false: "#E5E7EB", true: "#0D9F70" }}
                                    thumbColor="#FFFFFF"
                                />
                            </View>

                            {!newExperience.is_current && (
                                <View className="mb-4">
                                    <Text className="text-gray-600 mb-2 font-pmedium text-sm">End Date</Text>
                                    <TouchableOpacity
                                        className="border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50 flex-row items-center"
                                        onPress={() => setShowEndDatePicker(true)}
                                    >
                                        <Calendar size={16} color="#0D9F70" className="mr-2" />
                                        <Text className="font-pregular text-gray-800">{newExperience.end_date ? formatDate(newExperience.end_date) : 'Select end date'}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View className="mb-4">
                                <Text className="text-gray-600 mb-2 font-pmedium text-sm">Description</Text>
                                <TextInput
                                    className="border border-gray-200 rounded-xl px-4 py-3.5 bg-gray-50 text-gray-800"
                                    value={newExperience.description}
                                    onChangeText={(text) => setNewExperience(prev => ({ ...prev, description: text }))}
                                    placeholder="Enter description (optional)"
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            {showStartDatePicker && (
                                <DateTimePicker
                                    value={new Date(newExperience.start_date!)}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowStartDatePicker(false);
                                        if (selectedDate) {
                                            setNewExperience(prev => ({ ...prev, start_date: selectedDate.toISOString() }));
                                        }
                                    }}
                                />
                            )}

                            {showEndDatePicker && !newExperience.is_current && (
                                <DateTimePicker
                                    value={new Date(newExperience.end_date || new Date())}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowEndDatePicker(false);
                                        if (selectedDate) {
                                            setNewExperience(prev => ({ ...prev, end_date: selectedDate.toISOString() }));
                                        }
                                    }}
                                />
                            )}

                            <TouchableOpacity
                                className={`py-4 rounded-xl items-center mb-8 shadow-sm flex-row justify-center ${isSaving ? 'bg-gray-300' : 'bg-[#0D9F70]'}`}
                                onPress={saveExperience}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <Text className="text-white font-psemibold text-lg">Saving...</Text>
                                ) : (
                                    <>
                                        <Check size={20} color="white" className="mr-2" />
                                        <Text className="text-white font-psemibold text-lg">Save Experience</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
};
