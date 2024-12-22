import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ImageBackground,
    Platform,
    KeyboardAvoidingView,
    Image,
    TextInput,
    Alert
} from 'react-native';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { router } from "expo-router";
import { supabase } from '@/supabaseClient';

export default function CreateProfileScreen() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [profile, setProfile] = useState({
        name: '',
        address: '',
    });

    // Get the current session data when component mounts
    const [sessionData, setSessionData] = useState(null);

    useEffect(() => {
        const getSession = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error('Session Error:', error);
                // If no valid session, redirect back to login
                router.replace('/');
                return;
            }
            setSessionData(session);
        };

        getSession();
    }, []);

    const handleCreateProfile = async () => {
        try {
            setLoading(true);
            setError(null);

            if (!sessionData?.user) {
                throw new Error('No authenticated user found');
            }

            // Get phone number from session and format it without +
            const phoneNumber = sessionData.user.phone.replace('+', '');

            // Create profile with consistent phone format
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    {
                        user_id: sessionData.user.id,
                        full_name: profile.name,
                        address: profile.address,
                        phone_number: phoneNumber // Store without +
                    }
                ]);

            if (profileError) throw profileError;
            router.replace('/home');

        } catch (error) {
            console.error('Profile Creation Error:', error);
            setError(error.message);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
        >
            <StatusBar style="dark" />
            <ImageBackground
                source={require('@/assets/images/meow3.png')}
                className="flex-1 -mt-10"
                resizeMode="cover"
            >
                <BlurView intensity={60} className="flex-1">
                    <View className="flex-1 px-6 justify-center">
                        <View className="items-center ml-4 mb-12 mt-20">
                            <Image
                                source={require('@/assets/images/logoblack.png')}
                                className="w-20 h-20"
                                resizeMode="contain"
                            />
                        </View>

                        <View className="space-y-4 mt-20">
                            <Text className="text-2xl font-pbold text-gray-800">Complete Your Profile</Text>
                            <Text className="text-base text-gray-600 font-pregular">
                                Fill in your details to get started
                            </Text>

                            <View>
                                <Text className="text-gray-700 text-base mb-2 font-psemibold">Full Name</Text>
                                <TextInput
                                    className="bg-white/80 rounded-xl px-4 py-3"
                                    placeholder="Enter your full name"
                                    value={profile.name}
                                    onChangeText={(value) => setProfile({...profile, name: value})}
                                />
                            </View>

                            <View>
                                <Text className="text-gray-700 text-base mb-2 font-psemibold">Address</Text>
                                <TextInput
                                    className="bg-white/80 rounded-xl px-4 py-3"
                                    placeholder="Enter your address"
                                    value={profile.address}
                                    onChangeText={(value) => setProfile({...profile, address: value})}
                                />
                            </View>

                            <TouchableOpacity
                                className={`bg-mdgreen rounded-xl py-4 mt-6 ${loading ? 'opacity-50' : ''}`}
                                onPress={handleCreateProfile}
                                disabled={loading}
                            >
                                <Text className="text-white text-center font-psemibold text-lg">
                                    {loading ? 'Creating Profile...' : 'Complete Profile'}
                                </Text>
                            </TouchableOpacity>

                            {error && (
                                <Text className="text-red-500 text-center mt-2">
                                    {error}
                                </Text>
                            )}
                        </View>
                    </View>
                </BlurView>
            </ImageBackground>
        </KeyboardAvoidingView>
    );
}