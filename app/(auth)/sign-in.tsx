import React, { useState } from 'react';
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

export default function LoginScreen() {
    const [step, setStep] = useState(1); // 1: Phone, 2: OTP
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSendOTP = async () => {
        try {
            setLoading(true);
            setError(null);

            const cleanNumber = phoneNumber.replace(/\D/g, '');
            const withoutLeadingZero = cleanNumber.replace(/^0+/, '');
            const formattedPhone = `+92${withoutLeadingZero}`;

            // Check if user exists in profiles
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('phone_number', formattedPhone)
                .single();

            // Send OTP
            const { error: otpError } = await supabase.auth.signInWithOtp({
                phone: formattedPhone,
                channel: 'sms',
            });

            if (otpError) throw otpError;

            setStep(2);

            // If this is a new user, we'll handle profile creation after OTP verification
            if (!existingProfile) {
                console.log('New user detected');
            }

        } catch (error) {
            console.error('Login Error:', error);
            setError(error.message);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        try {
            setLoading(true);
            setError(null);

            // Format phone number without the + for database comparison
            const cleanNumber = phoneNumber.replace(/\D/g, '');
            const withoutLeadingZero = cleanNumber.replace(/^0+/, '');
            const formattedPhone = `92${withoutLeadingZero}`; // Removed the + for DB comparison
            const authPhone = `+${formattedPhone}`; // Keep the + for auth

            console.log('Checking DB for:', formattedPhone);
            console.log('Auth with:', authPhone);

            // Verify OTP with + for auth
            const { data, error } = await supabase.auth.verifyOtp({
                phone: authPhone, // Use + version for auth
                token: otp,
                type: 'sms'
            });

            if (error) throw error;

            // Check profile without + to match DB format
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('phone_number', formattedPhone) // Use version without + for DB comparison
                .single();

            if (!existingProfile) {
                console.log('No profile found - redirecting to create');
                router.replace('/create-profile');
            } else {
                console.log('Profile found - redirecting to home');
                router.replace('/(tabs)/Home');
            }

        } catch (error) {
            console.error('Verification Error:', error);
            setError(error.message);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const renderPhoneStep = () => (
        <View className="space-y-4 mt-20">
            <View>
                <Text className="text-2xl font-pbold mt-4 text-gray-800">Welcome to Madadgaar</Text>
                <Text className="text-base text-gray-600 font-pregular">Post Jobs. Earn Money.</Text>

                <Text className="text-gray-700 mt-6 text-base mb-2 font-psemibold">Phone Number</Text>
                <View className="flex-row items-center bg-white/80 rounded-xl px-4 py-3">
                    <Text className="text-2xl">🇵🇰</Text>
                    <Text className="text-gray-800 ml-2">+92</Text>
                    <TextInput
                        className="flex-1 ml-2 text-gray-800"
                        placeholder="Enter your phone number"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        keyboardType="phone-pad"
                    />
                </View>
            </View>

            <TouchableOpacity
                className={`bg-mdgreen rounded-xl py-4 mt-6 ${loading ? 'opacity-50' : ''}`}
                onPress={handleSendOTP}
                disabled={loading}
            >
                <Text className="text-white text-center font-psemibold text-lg">
                    {loading ? 'Sending OTP...' : 'Continue'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderOtpStep = () => (
        <View className="space-y-4 mt-20">
            <Text className="text-2xl font-pbold text-gray-800">Verify Phone</Text>
            <Text className="text-base text-gray-600 font-pregular">
                Enter the 6-digit code sent to <Text className="font-psemibold">+92 {phoneNumber}</Text>
            </Text>

            <View className="flex-row justify-between">
                {[...Array(6)].map((_, index) => (
                    <TextInput
                        key={index}
                        className={`flex-1 bg-white/80 rounded-xl px-4 py-3 text-center text-lg ${
                            index !== 5 ? 'mr-3' : ''
                        }`}
                        maxLength={1}
                        keyboardType="number-pad"
                        value={otp[index] || ''}
                        onChangeText={(value) => {
                            const newOtp = otp.split('');
                            newOtp[index] = value;
                            setOtp(newOtp.join(''));
                        }}
                    />
                ))}
            </View>

            <TouchableOpacity
                className={`bg-mdgreen rounded-xl py-4 mt-6 ${loading ? 'opacity-50' : ''}`}
                onPress={handleVerifyOTP}
                disabled={loading}
            >
                <Text className="text-white text-center font-psemibold text-lg">
                    {loading ? 'Verifying...' : 'Verify OTP'}
                </Text>
            </TouchableOpacity>
        </View>
    );

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

                        {step === 1 ? renderPhoneStep() : renderOtpStep()}

                    </View>
                </BlurView>
            </ImageBackground>
        </KeyboardAvoidingView>
    );
}