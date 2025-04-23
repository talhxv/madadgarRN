import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, TextInput, ScrollView, Switch } from 'react-native';
import { Plus, Building2, GraduationCap, X } from 'lucide-react-native';
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
    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short'
        });
    };

    return (
        <View className="mt-6">
            {/* Education Section */}
            <View className="mb-6">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-gray-700 font-pmedium text-lg">Education</Text>
                    <TouchableOpacity
                        className="bg-[#0D9F6F] p-2 rounded-full"
                        onPress={() => setIsEducationModalVisible(true)}
                    >
                        <Plus size={20} color="white" />
                    </TouchableOpacity>
                </View>

                {educations.map((education) => (
                    <View key={education.id} className="bg-gray-50 p-4 rounded-lg mb-3">
                        <View className="flex-row items-start">
                            <View className="bg-gray-200 p-2 rounded-lg mr-3">
                                <GraduationCap size={24} color="#374151" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-psemibold text-gray-900">{education.institution_name}</Text>
                                <Text className="text-gray-600 font-pregular">{education.degree} in {education.field_of_study}</Text>
                                <Text className="text-gray-500 text-sm mt-1 font-pregular">
                                    {formatDate(education.start_date)} - {education.is_current ? 'Present' : formatDate(education.end_date!)}
                                </Text>
                                {education.grade && (
                                    <Text className="text-gray-500 text-sm mt-1 font-pregular">Grade: {education.grade}</Text>
                                )}
                            </View>
                        </View>
                    </View>
                ))}
            </View>

            {/* Experience Section */}
            <View>
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-gray-700 font-pmedium text-lg">Experience</Text>
                    <TouchableOpacity
                        className="bg-[#0D9F6F] p-2 rounded-full"
                        onPress={() => setIsExperienceModalVisible(true)}
                    >
                        <Plus size={20} color="white" />
                    </TouchableOpacity>
                </View>

                {experiences.map((experience) => (
                    <View key={experience.id} className="bg-gray-50 p-4 rounded-lg mb-3">
                        <View className="flex-row items-start">
                            <View className="bg-gray-200 p-2 rounded-lg mr-3">
                                <Building2 size={24} color="#374151" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-psemibold text-gray-900">{experience.position}</Text>
                                <Text className="text-gray-600 font-pregular">{experience.company_name}</Text>
                                <View className="flex-row items-center mt-1">
                                    <View className={`px-2 py-1 rounded-full mr-2 ${
                                        experience.type === 'online' ? 'bg-blue-100' :
                                            experience.type === 'offline' ? 'bg-green-100' : 'bg-purple-100'
                                    }`}>
                                        <Text className={`text-xs font-pregular ${
                                            experience.type === 'online' ? 'text-blue-800' :
                                                experience.type === 'offline' ? 'text-green-800' : 'text-purple-800'
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
                                <Text className="text-gray-500 text-sm mt-1 font-pregular">
                                    {formatDate(experience.start_date)} - {experience.is_current ? 'Present' : formatDate(experience.end_date!)}
                                </Text>
                                {experience.location && (
                                    <Text className="text-gray-500 text-sm mt-1 font-pregular">{experience.location}</Text>
                                )}
                                {experience.skills && experience.skills.length > 0 && (
                                    <View className="flex-row flex-wrap mt-2">
                                        {experience.skills.map((skill, index) => (
                                            <View key={index} className="bg-gray-200 rounded-full px-2 py-1 mr-2 mb-2">
                                                <Text className="text-xs text-gray-700 font-pregular">{skill}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                ))}
            </View>

            {/* Education Modal */}
            <Modal
                visible={isEducationModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsEducationModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center">
                    <BlurView
                        intensity={20}
                        className="absolute top-0 left-0 right-0 bottom-0"
                        tint="dark"
                    />
                    <View className="w-11/12 bg-white rounded-2xl flex-1 mt-10 mb-10">
                        <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
                            <Text className="text-xl font-psemibold">Add Education</Text>
                            <TouchableOpacity onPress={() => setIsEducationModalVisible(false)}>
                                <X size={24} color="#374151" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="p-4 flex-1">
                            <View className="mb-4">
                                <Text className="text-gray-700 mb-1 font-pregular">Institution Name *</Text>
                                <TextInput
                                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                                    value={newEducation.institution_name}
                                    onChangeText={(text) => setNewEducation(prev => ({ ...prev, institution_name: text }))}
                                    placeholder="Enter institution name"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-700 mb-1 font-pregular">Degree *</Text>
                                <TextInput
                                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                                    value={newEducation.degree}
                                    onChangeText={(text) => setNewEducation(prev => ({ ...prev, degree: text }))}
                                    placeholder="Enter degree"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-700 mb-1 font-pregular">Field of Study *</Text>
                                <TextInput
                                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                                    value={newEducation.field_of_study}
                                    onChangeText={(text) => setNewEducation(prev => ({ ...prev, field_of_study: text }))}
                                    placeholder="Enter field of study"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-700 mb-1 font-pregular">Grade</Text>
                                <TextInput
                                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                                    value={newEducation.grade}
                                    onChangeText={(text) => setNewEducation(prev => ({ ...prev, grade: text }))}
                                    placeholder="Enter grade (optional)"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-700 mb-1 font-pregular">Description</Text>
                                <TextInput
                                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                                    value={newEducation.description}
                                    onChangeText={(text) => setNewEducation(prev => ({ ...prev, description: text }))}
                                    placeholder="Enter description (optional)"
                                    multiline
                                    numberOfLines={4}
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-700 mb-1 font-pregular">Start Date</Text>
                                <TouchableOpacity
                                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                                    onPress={() => setShowStartDatePicker(true)}
                                >
                                    <Text className="font-pregular">{formatDate(newEducation.start_date!)}</Text>
                                </TouchableOpacity>
                            </View>

                            <View className="mb-4 flex-row items-center justify-between">
                                <Text className="text-gray-700 font-pregular">Currently Studying</Text>
                                <Switch
                                    value={newEducation.is_current}
                                    onValueChange={(value) => setNewEducation(prev => ({ ...prev, is_current: value }))}
                                />
                            </View>

                            {!newEducation.is_current && (
                                <View className="mb-4">
                                    <Text className="text-gray-700 mb-1 font-pregular">End Date</Text>
                                    <TouchableOpacity
                                        className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                                        onPress={() => setShowEndDatePicker(true)}
                                    >
                                        <Text className="font-pregular">{newEducation.end_date ? formatDate(newEducation.end_date) : 'Select end date'}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

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
                                className={`py-3 rounded-lg items-center mb-4 ${isSaving ? 'bg-gray-300' : 'bg-[#0D9F6F]'}`}
                                onPress={saveEducation}
                                disabled={isSaving}
                            >
                                <Text className="text-white font-psemibold text-lg">
                                    {isSaving ? 'Saving...' : 'Save Education'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Experience Modal */}
            <Modal
                visible={isExperienceModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsExperienceModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center">
                    <BlurView
                        intensity={20}
                        className="absolute top-0 left-0 right-0 bottom-0"
                        tint="dark"
                    />
                    <View className="w-11/12 bg-white rounded-2xl flex-1 mt-10 mb-10">
                        <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
                            <Text className="text-xl font-psemibold">Add Experience</Text>
                            <TouchableOpacity onPress={() => setIsExperienceModalVisible(false)}>
                                <X size={24} color="#374151" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="p-4 flex-1">
                            <View className="mb-4">
                                <Text className="text-gray-700 mb-1 font-pregular">Company Name *</Text>
                                <TextInput
                                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                                    value={newExperience.company_name}
                                    onChangeText={(text) => setNewExperience(prev => ({ ...prev, company_name: text }))}
                                    placeholder="Enter company name"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-700 mb-1 font-pregular">Position *</Text>
                                <TextInput
                                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                                    value={newExperience.position}
                                    onChangeText={(text) => setNewExperience(prev => ({ ...prev, position: text }))}
                                    placeholder="Enter position"
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-700 mb-1 font-pregular">Location</Text>
                                <TextInput
                                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                                    value={newExperience.location}
                                    onChangeText={(text) => setNewExperience(prev => ({ ...prev, location: text }))}
                                    placeholder="Enter location (optional)"
                                />
                            </View>

                            <View className="mb-4 flex-row items-center justify-between">
                                <Text className="text-gray-700 font-pregular">Remote Work</Text>
                                <Switch
                                    value={newExperience.is_remote}
                                    onValueChange={(value) => setNewExperience(prev => ({ ...prev, is_remote: value }))}
                                />
                            </View>

                            <View className="mb-4">
                                <Text className="text-gray-700 mb-1 font-pregular">Type</Text>
                                <View className="flex-row justify-around mt-2">
                                    {['online', 'offline', 'hybrid'].map((type) => (
                                        <TouchableOpacity
                                            key={type}
                                            className={`px-4 py-2 rounded-full ${newExperience.type === type ? 'bg-[#0D9F6F]' : 'bg-gray-200'}`}
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
                                <Text className="text-gray-700 mb-1 font-pregular">Start Date</Text>
                                <TouchableOpacity
                                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                                    onPress={() => setShowStartDatePicker(true)}
                                >
                                    <Text className="font-pregular">{formatDate(newExperience.start_date!)}</Text>
                                </TouchableOpacity>
                            </View>

                            <View className="mb-4 flex-row items-center justify-between">
                                <Text className="text-gray-700 font-pregular">Currently Working</Text>
                                <Switch
                                    value={newExperience.is_current}
                                    onValueChange={(value) => setNewExperience(prev => ({ ...prev, is_current: value }))}
                                />
                            </View>

                            {!newExperience.is_current && (
                                <View className="mb-4">
                                    <Text className="text-gray-700 mb-1 font-pregular">End Date</Text>
                                    <TouchableOpacity
                                        className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                                        onPress={() => setShowEndDatePicker(true)}
                                    >
                                        <Text className="font-pregular">{newExperience.end_date ? formatDate(newExperience.end_date) : 'Select end date'}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View className="mb-4">
                                <Text className="text-gray-700 mb-1 font-pregular">Description</Text>
                                <TextInput
                                    className="border border-gray-300 rounded-lg p-3 bg-gray-50"
                                    value={newExperience.description}
                                    onChangeText={(text) => setNewExperience(prev => ({ ...prev, description: text }))}
                                    placeholder="Enter description (optional)"
                                    multiline
                                    numberOfLines={4}
                                />
                            </View>

                            <TouchableOpacity
                                className={`py-3 rounded-lg items-center mb-4 ${isSaving ? 'bg-gray-300' : 'bg-[#0D9F6F]'}`}
                                onPress={saveExperience}
                                disabled={isSaving}
                            >
                                <Text className="text-white font-psemibold text-lg">
                                    {isSaving ? 'Saving...' : 'Save Experience'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};