import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Dimensions } from 'react-native';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    startText: {
        fontSize: 16, // equivalent to text-lg
        color: 'white', // equivalent to text-white
        fontFamily: 'Poppins-SemiBold', // equivalent to font-semibold
    },
});

const OnboardingButton = ({ currentIndex, onboardingData, goToNextPage }) => {
    const router = useRouter();
    const animatedValue = useRef(new Animated.Value(0)).current;

    // Animate button size and shape when on the last step
    useEffect(() => {
        Animated.timing(animatedValue, {
            toValue: currentIndex === onboardingData.length - 1 ? 1 : 0,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [currentIndex]);

    // Interpolate width and borderRadius
    const buttonWidth = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [64, 200], // Circle to pill
    });

    const borderRadius = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [32, 32], // Full circle to rounded pill
    });

    const handlePress = () => {
        if (currentIndex === onboardingData.length - 1) {
            router.push('/sign-in');
        } else {
            goToNextPage();
        }
    };

    return (
        <Animated.View
            style={{
                position: 'absolute',
                bottom: 48,
                alignSelf: 'center',
                width: buttonWidth,
                height: 64,
                borderRadius: borderRadius,
                backgroundColor: '#53F3AE',
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <TouchableOpacity
                onPress={handlePress}
                activeOpacity={0.8}
                style={{
                    width: 64, // You can adjust the width here to match the image size
                    height: 64, // Same for height
                    borderRadius: 32, // This makes it circular (you can adjust if needed)
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                {currentIndex === onboardingData.length - 1 ? (
                    <Text style={styles.startText}>Start</Text>
                ) : (
                    <Image
                        source={require('@/assets/onboarding/forwardbtn.png')}
                        style={{
                            width: '100%', // Make the image take up the full button area
                            height: '100%', // Ensure it covers the entire button area
                            borderRadius: 32, // Keep it circular, matching the button
                            resizeMode: 'contain', // Maintain image aspect ratio
                        }}
                    />
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

export default OnboardingButton;