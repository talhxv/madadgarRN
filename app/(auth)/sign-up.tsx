import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { Camera } from 'react-native-camera';
import { supabase } from '@/supabaseClient';
import AWS from 'aws-sdk';
import RNFS from 'react-native-fs';
import * as ImagePicker from 'expo-image-picker';

const SignUpScreen = () => {
    const [step, setStep] = useState(1); // 1: Profile, 2: NIC Upload, 3: Face Verification
    const [phoneNumber, setPhoneNumber] = useState('');
    const [profile, setProfile] = useState({
        name: '',
        address: '',
        password: '',
    });
    const [cameraPermission, setCameraPermission] = useState(false);
    const [liveFacePhoto, setLiveFacePhoto] = useState(null);
    const [nicImage, setNicImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const cameraRef = useRef(null);

    // Existing AWS and Rekognition setup...

    const handleNICImageUpload = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permissions needed');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const response = await fetch(uri);
            const blob = await response.blob();

            const { data, error } = await supabase.storage
                .from('nic-images')
                .upload(`${user.id}/nic.jpg`, blob, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('NIC Upload Error:', error);
                return;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('nic-images')
                .getPublicUrl(data.path);

            setNicImage(publicUrl);
            setStep(3); // Move to face verification
        }
    };

    const handleCompleteSignup = async () => {
        if (!liveFacePhoto || !nicImage) {
            Alert.alert('Error', 'Please upload both NIC and live face images');
            return;
        }

        try {
            setLoading(true);
            const liveFaceUrl = await uploadToS3(liveFacePhoto);

            const isFaceMatch = await verifyFaceMatch(liveFaceUrl, nicImage);

            if (!isFaceMatch) {
                await supabase
                    .from('user_verifications')
                    .insert({
                        user_id: user.id,
                        nic_image_url: nicImage,
                        live_face_image_url: liveFaceUrl,
                        is_verified: false,
                        verification_attempts: 1
                    });

                Alert.alert('Verification Failed', 'Face does not match NIC image');
                return;
            }

            await supabase
                .from('user_verifications')
                .insert({
                    user_id: user.id,
                    nic_image_url: nicImage,
                    live_face_image_url: liveFaceUrl,
                    is_verified: true,
                    verification_attempts: 1
                });

            await supabase
                .from('profiles')
                .update({ is_verified: true })
                .eq('user_id', user.id);

            router.replace('/Home');
        } catch (error) {
            console.error('Signup Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderProfileStep = () => (
        <View className="space-y-4">
            {/* Your existing profile form */}

            {/* NIC Upload Button */}
            <TouchableOpacity
                onPress={handleNICImageUpload}
                className="bg-white/80 rounded-xl px-4 py-3 mt-4"
            >
                <Text className="text-gray-800 text-center">Upload NIC Image</Text>
            </TouchableOpacity>

            {nicImage && (
                <Image
                    source={{ uri: nicImage }}
                    style={{ width: 100, height: 100, borderRadius: 50 }}
                />
            )}

            <TouchableOpacity
                className={`bg-mdgreen rounded-xl py-4 mt-6 ${loading ? 'opacity-50' : ''}`}
                onPress={handleCompleteSignup}
                disabled={loading}
            >
                <Text className="text-white text-center font-psemibold text-lg">
                    {loading ? 'Completing...' : 'Complete Signup'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={{ flex: 1 }}>
            {renderProfileStep()}

            <Camera
                ref={cameraRef}
                style={{ flex: 1 }}
                type={Camera.Constants.Type.front}
                permissionDialogTitle={'Permission to use camera'}
                permissionDialogMessage={'We need your permission to use your camera for face capture.'}
            />
        </View>
    );
};

export default SignUpScreen;