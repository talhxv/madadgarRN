import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, ImageBackground, Platform,
    KeyboardAvoidingView, TextInput, Alert, ScrollView, Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from "expo-router";
import { supabase } from '@/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { uploadToS3, compareFaces } from '@/lib/aws-config';

interface Profile {
    name: string;
    address: string;
    dob: Date;
    nicNumber: string;
}

export default function CreateProfileScreen() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nicImage, setNicImage] = useState<string | null>(null);
    const [selfieImage, setSelfieImage] = useState<string | null>(null);
    const [dateInput, setDateInput] = useState('');
    const [sessionData, setSessionData] = useState<any>(null);

    const [profile, setProfile] = useState<Profile>({
        name: '',
        address: '',
        dob: new Date(),
        nicNumber: ''
    });

    useEffect(() => {
        getSession();
    }, []);

    const getSession = async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error('Session Error:', error);
            router.replace('/');
            return;
        }
        setSessionData(session);
    };
    const handleDateInput = (text: string) => {
        setDateInput(text);
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length >= 4) {
            const month = cleaned.slice(0, 2);
            const day = cleaned.slice(2, 4);
            const year = cleaned.slice(4, 8);

            if (cleaned.length >= 4 && cleaned.length < 8) {
                setDateInput(`${month}/${day}/${year}`);
            } else if (cleaned.length >= 8) {
                const date = new Date(`${year}-${month}-${day}`);
                if (!isNaN(date.getTime())) {
                    setDateInput(`${month}/${day}/${year}`);
                    setProfile({ ...profile, dob: date });
                }
            }
        }
    };
    const pickImage = async (type: 'nic' | 'selfie') => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: type === 'selfie' ? [1, 1] : [4, 3],
                quality: 0.7,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const selectedAsset = result.assets[0];
                if (type === 'nic') {
                    setNicImage(selectedAsset.uri);
                } else {
                    setSelfieImage(selectedAsset.uri);
                }
            }
        } catch (error) {
            console.error('Image picker error:', error);
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    };

    const handleCreateProfile = async () => {
        try {
            setLoading(true);
            setError(null);

            if (!sessionData?.user) throw new Error('No authenticated user found');
            if (!nicImage || !selfieImage) throw new Error('Both photos are required');

            const nicFileName = `nic-${sessionData.user.id}-${Date.now()}.jpg`;
            const selfieFileName = `selfie-${sessionData.user.id}-${Date.now()}.jpg`;

            // Upload images to S3
            const [nicUrl, selfieUrl] = await Promise.all([
                uploadToS3(nicImage, nicFileName),
                uploadToS3(selfieImage, selfieFileName)
            ]);


            // Compare faces using Rekognition
            const compareResult = await compareFaces(nicImage, selfieImage);
            const similarity = compareResult.FaceMatches?.[0]?.Similarity || 0;
            const isVerified = similarity >= 50;

            if (!isVerified) {
                throw new Error('Face verification failed. Please ensure photos are clear and try again.');
            }

            const phoneNumber = sessionData.user.phone?.replace('+', '') || '';

            // Create profile in Supabase
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{
                    user_id: sessionData.user.id,
                    full_name: profile.name,
                    address: profile.address,
                    phone_number: phoneNumber,
                    dob: profile.dob.toISOString().split('T')[0],
                    nic_number: profile.nicNumber,
                    is_verified: isVerified
                }]);

            if (profileError) throw profileError;

            // Create verification record
            const { error: verificationError } = await supabase
                .from('user_verifications')
                .insert([{
                    user_id: sessionData.user.id,
                    nic_image_url: nicUrl.Location,
                    selfie_image_url: selfieUrl.Location,
                    verification_score: similarity,
                    is_verified: isVerified,
                    verified_at: new Date().toISOString()
                }]);

            if (verificationError) throw verificationError;

            Alert.alert('Success', 'Profile created successfully!');
            router.replace('/Home');

        } catch (error: any) {
            console.error('Full Error Object:', JSON.stringify(error, null, 2));
            console.error('Error Name:', error.name);
            console.error('Error Message:', error.message);
            console.error('Error Stack:', error.stack);
            setError(error.message || 'An unknown error occurred');
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <StatusBar style="dark" />
            <ImageBackground
                source={require('@/assets/images/meow3.png')}
                style={{ flex: 1 }}
                resizeMode="cover"
            >
                <BlurView intensity={60} style={{ flex: 1 }}>
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 40 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={{ alignItems: 'center', marginBottom: 32 }}>
                            <Image
                                source={require('@/assets/images/logoblack.png')}
                                style={{ width: 80, height: 80 }}
                                resizeMode="contain"
                            />
                        </View>

                        <View className="space-y-4">
                            <Text className="text-2xl font-pbold text-gray-800">Create Profile</Text>

                            <View>
                                <Text className="text-gray-700 mb-2 font-psemibold">Full Name</Text>
                                <TextInput
                                    className="bg-white/80 rounded-xl px-4 py-3"
                                    placeholder="Enter your full name"
                                    value={profile.name}
                                    onChangeText={(value) => setProfile({...profile, name: value})}
                                />
                            </View>

                            <View>
                                <Text className="text-gray-700 mb-2 font-psemibold">Address</Text>
                                <TextInput
                                    className="bg-white/80 rounded-xl px-4 py-3"
                                    placeholder="Enter your address"
                                    value={profile.address}
                                    onChangeText={(value) => setProfile({...profile, address: value})}
                                />
                            </View>

                            <View>
                                <Text className="text-gray-700 mb-2 font-psemibold">NIC Number</Text>
                                <TextInput
                                    className="bg-white/80 rounded-xl px-4 py-3"
                                    placeholder="Enter your NIC number"
                                    value={profile.nicNumber}
                                    onChangeText={(value) => setProfile({...profile, nicNumber: value})}
                                />
                            </View>

                            <View>
                                <Text className="text-gray-700 mb-2 font-psemibold">Date of Birth</Text>
                                <TextInput
                                    className="bg-white/80 rounded-xl px-4 py-3"
                                    placeholder="MM/DD/YYYY"
                                    value={dateInput}
                                    onChangeText={handleDateInput}
                                    maxLength={10}
                                    keyboardType="numeric"
                                />
                            </View>

                            <View className="space-y-4 mt-4">
                                <View>
                                    <Text className="text-gray-700 mb-2 font-psemibold">NIC Photo</Text>
                                    <TouchableOpacity
                                        className="bg-white/80 rounded-xl p-4 items-center"
                                        onPress={() => pickImage('nic')}
                                    >
                                        {nicImage ? (
                                            <Image
                                                source={{ uri: nicImage }}
                                                style={{ width: 200, height: 150 }}
                                                resizeMode="contain"
                                            />
                                        ) : (
                                            <Text>Upload NIC Photo</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                <View>
                                    <Text className="text-gray-700 mb-2 font-psemibold">Selfie Photo</Text>
                                    <TouchableOpacity
                                        className="bg-white/80 rounded-xl p-4 items-center"
                                        onPress={() => pickImage('selfie')}
                                    >
                                        {selfieImage ? (
                                            <Image
                                                source={{ uri: selfieImage }}
                                                style={{ width: 150, height: 150 }}
                                                resizeMode="contain"
                                            />
                                        ) : (
                                            <Text>Upload Selfie Photo</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity
                                className="bg-mdgreen rounded-xl py-4 mt-6 mb-6"
                                onPress={handleCreateProfile}
                                disabled={loading || !profile.name || !profile.address || !profile.nicNumber || !dateInput || !nicImage || !selfieImage}
                            >
                                <Text className="text-white text-center font-psemibold text-lg">
                                    {loading ? 'Creating Profile...' : 'Create Profile'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </BlurView>
            </ImageBackground>
        </KeyboardAvoidingView>
    );
}