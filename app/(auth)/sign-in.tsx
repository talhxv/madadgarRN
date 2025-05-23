import React, { useState, useRef, useEffect } from 'react';
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
import { useAuth } from '@/contexts/AuthContext'; // Update with the correct path

export default function LoginScreen() {
    const { user, refreshUser } = useAuth(); // Get auth context
    const [step, setStep] = useState(1); // 1: Phone, 2: OTP
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [phoneError, setPhoneError] = useState(null);

    // Create refs for OTP input fields
    const otpInputRefs = useRef([...Array(6)].map(() => React.createRef()));

    const handlePhoneNumberChange = (value) => {
        // Remove all non-digit characters
        let digits = value.replace(/\D/g, '');

        // Remove leading zeros
        digits = digits.replace(/^0+/, '');

        // Limit to 10 digits (Pakistani mobile number after +92)
        if (digits.length > 10) {
            digits = digits.slice(0, 10);
        }

        setPhoneNumber(digits);

        // Real-time validation
        if (digits.length !== 10) {
            setPhoneError('Phone number must be 10 digits after +92');
        } else {
            setPhoneError(null);
        }
    };

    const validatePhoneNumber = (number) => {
        const cleanNumber = number.replace(/\D/g, '').replace(/^0+/, '');
        return cleanNumber.length === 10;
    };

    const handleSendOTP = async () => {
        try {
            // Reset previous errors
            setPhoneError(null);

            // Validate phone number format
            if (!validatePhoneNumber(phoneNumber)) {
                setPhoneError("Invalid phone number");
                return;
            }

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

            if (otpError) {
                // Handle OTP sending errors without Alert
                setError(otpError.message);
                return;
            }

            setStep(2);

            // If this is a new user, we'll handle profile creation after OTP verification
            if (!existingProfile) {
                console.log('New user detected');
            }

        } catch (error) {
            console.error('Login Error:', error);
            setError(error.message);
            // Remove Alert to prevent Twilio warning popup
            // Alert.alert('Error', error.message);
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

            if (error) {
                // Handle specific OTP errors more gracefully
                if (error.message.includes('Token has expired') || error.message.includes('invalid')) {
                    setError('Invalid or expired verification code. Please try again or request a new code.');
                    // Clear the OTP input
                    setOtp('');
                    // Focus on the first OTP input field
                    if (otpInputRefs.current[0]) {
                        otpInputRefs.current[0].focus();
                    }
                    return;
                }
                throw error;
            }

            // Check profile without + to match DB format
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('phone_number', formattedPhone) // Use version without + for DB comparison
                .single();

            // Refresh the user in the auth context
            await refreshUser();

            if (!existingProfile) {
                console.log('No profile found - redirecting to create');
                router.replace('/create-profile');
            } else {
                console.log('Profile found - redirecting to home');
                router.replace('/(tabs)/Home');
            }

        } catch (error) {
            console.error('Verification Error:', error);
            // For other errors, provide a more generic message
            setError('Verification failed. Please check your connection and try again.');
            // Don't show Alert, just use the in-app error message
            // Alert.alert('Error', 'Verification failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };


    // Handle OTP input and auto-focus to next field
    const handleOtpChange = (value, index) => {
        const newOtp = otp.split('');
        newOtp[index] = value;
        setOtp(newOtp.join(''));

        // Auto-focus to next field if value is entered
        if (value && index < 5) {
            otpInputRefs.current[index + 1].focus();
        }
    };

    // Handle backspace in OTP fields
    const handleOtpKeyPress = (e, index) => {
        // If backspace is pressed and current field is empty, focus on previous field
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            otpInputRefs.current[index - 1].focus();
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
                        onChangeText={handlePhoneNumberChange}
                        keyboardType="phone-pad"
                        maxLength={10} // Prevent more than 10 digits after +92
                    />
                </View>
                {phoneError && (
                    <Text className="text-red-500 mt-2 font-pregular">{phoneError}</Text>
                )}
            </View>

            <TouchableOpacity
                className={`bg-[#0D9F6F] rounded-xl py-4 mt-6 ${loading || phoneError ? 'opacity-50' : ''}`}
                onPress={handleSendOTP}
                disabled={loading || !!phoneError}
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

            {error && (
                <View className="bg-red-50 p-3 rounded-lg border border-red-200 mb-2">
                    <Text className="text-red-600 font-pregular text-center">{error}</Text>
                </View>
            )}

            <View className="flex-row justify-between">
                {[...Array(6)].map((_, index) => (
                    <TextInput
                        key={index}
                        ref={el => otpInputRefs.current[index] = el}
                        className={`flex-1 bg-white/80 rounded-xl px-4 py-3 text-center text-lg ${
                            index !== 5 ? 'mr-3' : ''
                        } ${error ? 'border border-red-300' : ''}`}
                        maxLength={1}
                        keyboardType="number-pad"
                        value={otp[index] || ''}
                        onChangeText={(value) => handleOtpChange(value, index)}
                        onKeyPress={(e) => handleOtpKeyPress(e, index)}
                    />
                ))}
            </View>

            <TouchableOpacity
                className={`bg-[#0D9F6F] rounded-xl py-4 mt-6 ${loading || otp.length !== 6 ? 'opacity-50' : ''}`}
                onPress={handleVerifyOTP}
                disabled={loading || otp.length !== 6}
            >
                <Text className="text-white text-center font-psemibold text-lg">
                    {loading ? 'Verifying...' : 'Verify OTP'}
                </Text>
            </TouchableOpacity>

            <View className="flex-row justify-center mt-4">
                <Text className="text-gray-600 font-pregular">Didn't receive the code? </Text>
                <TouchableOpacity 
                    onPress={() => {
                        setOtp('');
                        setError(null);
                        setStep(1); // Go back to phone input step
                    }}
                    disabled={loading}
                >
                    <Text className="text-[#0D9F6F] font-psemibold">Resend Code</Text>
                </TouchableOpacity>
            </View>
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
