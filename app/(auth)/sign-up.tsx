import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ImageBackground,
    Platform,
    KeyboardAvoidingView,
    Image,
    TextInput
} from 'react-native';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { router } from "expo-router";
import { supabase } from '@/supabaseClient';

const SignUpScreen = () => {
    const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: Profile
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [profile, setProfile] = useState({
        name: '',
        address: '',
        password: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<null | string>(null);

    const handleSendOTP = async () => {
        try {
            setLoading(true);
            setError(null);

            const cleanNumber = phoneNumber.replace(/\D/g, '');
            const withoutLeadingZero = cleanNumber.replace(/^0+/, '');
            const formattedPhone = `+92${withoutLeadingZero}`;

            console.log('Sending OTP to:', formattedPhone);

            /*// Check if user exists first
            const { data: existingData, error: existingError } = await supabase
                .from('profiles')
                .select('phone_number')
                .eq('phone_number', formattedPhone)
                .single();

            if (existingData) {
                setError('This phone number is already registered. Please sign in instead.');
                return;
            }*/

            const { data, error } = await supabase.auth.signInWithOtp({
                phone: formattedPhone,
                channel: 'sms',
            });

            console.log('Supabase response:', { data, error });

            if (error) throw error;

            setStep(2);
            console.log('OTP sent successfully');

        } catch (error) {
            console.error('OTP Error:', error.message);
            if (error.message.includes('Database error')) {
                setError('This phone number is already registered. Please sign in instead.');
            } else {
                setError(error.message || 'Failed to send OTP');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        try {
            setLoading(true);
            setError(null);

            const formattedPhone = `+92${phoneNumber.replace(/^0+/, '')}`;

            console.log('Verifying OTP for:', formattedPhone, 'Code:', otp);

            const { data, error } = await supabase.auth.verifyOtp({
                phone: formattedPhone,
                token: otp,
                type: 'sms'
            });

            console.log('Verification response:', { data, error });

            if (error) {
                throw error;
            }

            setStep(3);
            console.log('OTP verified successfully');

        } catch (error) {
            console.error('Verification Error:', error.message);
            setError(() => error.message || 'Failed to verify OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteSignup = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError) throw userError;

            if (!user) {
                throw new Error('No user found');
            }

            // Update user profile in Supabase with phone number
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    {
                        user_id: user.id,
                        full_name: profile.name,
                        address: profile.address,
                        phone_number: phoneNumber
                    }
                ]);

            if (profileError) {
                console.error('Profile Error:', profileError);
                throw profileError;
            }

            router.replace('/home');
        } catch (error) {
            console.error('Complete Signup Error:', error);
            setError(() => error.message);
        } finally {
            setLoading(false);
        }
    };

    const renderProgressDots = () => (
        <View className="flex-row justify-center mb-6">
            {[1, 2, 3].map((dot) => (
                <View
                    key={dot}
                    className={`h-2 w-2 rounded-full ${
                        step >= dot ? 'bg-mdgreen' : 'bg-gray-300'
                    } ${dot !== 3 ? 'mr-2' : ''}`}  // Add margin using conditional className
                />
            ))}
        </View>
    );

    const renderPhoneStep = () => (
        <View className="space-y-4">
            <Text className="text-2xl font-pbold text-gray-800">Create Account</Text>
            <Text className="text-base text-gray-600 font-pregular">Enter your phone number to get started</Text>

            <View>
                <Text className="text-gray-700 text-base mb-2 font-psemibold">Phone Number</Text>
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

            {error && (
                <Text className="text-red-500 text-sm mt-2">
                    {error}
                </Text>
            )}

            <TouchableOpacity
                className={`bg-mdgreen rounded-xl py-4 mt-6 ${loading ? 'opacity-50' : ''}`}
                onPress={handleSendOTP}
                disabled={loading}
            >
                <Text className="text-white text-center font-psemibold text-lg">
                    {loading ? 'Sending...' : 'Send OTP'}
                </Text>
            </TouchableOpacity>

        </View>
    );

    const renderOtpStep = () => (
        <View className="space-y-4">
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

    const renderProfileStep = () => (
        <View className="space-y-4">
            <Text className="text-2xl font-pbold text-gray-800">Complete Profile</Text>
            <Text className="text-base text-gray-600 font-pregular">
                Fill in your details to complete registration
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
                <Text className="text-gray-700 text-base mb-2 font-psemibold">Phone Number</Text>
                <View className="bg-gray-100 rounded-xl px-4 py-3">
                    <Text className="text-gray-600">+92 {phoneNumber}</Text>
                </View>
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

            <View>
                <Text className="text-gray-700 text-base mb-2 font-psemibold">Password</Text>
                <View className="relative">
                    <TextInput
                        className="bg-white/80 rounded-xl px-4 py-3"
                        placeholder="Create a password"
                        value={profile.password}
                        onChangeText={(value) => setProfile({...profile, password: value})}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-3"
                    >
                        <Text className="text-emerald-600 font-psemibold">
                            {showPassword ? 'Hide' : 'Show'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

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

                        {renderProgressDots()}

                        <View className="mt-20"> {/* Increased margin-top */}
                            {step === 1 && renderPhoneStep()}
                            {step === 2 && renderOtpStep()}
                            {step === 3 && renderProfileStep()}
                        </View>

                        <View className="flex-row justify-center mt-8">
                            <Text className="text-gray-600 font-pregular">
                                Already have an account?
                                <Text className="text-emerald-600 font-psemibold">
                                    {' '}Sign In
                                </Text>
                            </Text>
                        </View>
                    </View>
                </BlurView>
            </ImageBackground>
        </KeyboardAvoidingView>
    );
};

export default SignUpScreen;