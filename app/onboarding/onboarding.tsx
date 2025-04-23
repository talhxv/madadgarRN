import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ImageBackground, FlatList, Animated, Dimensions, Easing, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingButton from '@/components/onboardingbutton'

const { width, height } = Dimensions.get('window');

// Onboarding Data (expanded to 6 screens)
const onboardingData = [
    {
        id: 1,
        background: require('@/assets/onboarding/screenone/blurbg.png'),
        image: require('@/assets/onboarding/screenone/firstimage.png'),
        title: 'The help you need, wherever you need',
        description: 'Madadgar has a wide range of skilled workers ranging for all your needs',
    },
    {
        id: 2,
        background: require('@/assets/onboarding/screentwo/blurbg2.png'),
        image: require('@/assets/onboarding/screentwo/secondimage.png'),
        title: 'Need something done around the House?',
        description: 'Have a task around your house that needs to be done without leaving your home?',
    },
    {
        id: 3,
        background: require('@/assets/onboarding/screenthree/blurbg3.png'),
        image: require('@/assets/onboarding/screenthree/thirdimage.png'),
        title: 'Browse Categories Tailored to Your Needs',
        description: 'Find or post jobs in your relevant categories, earn money!',
    },
    {
        id: 4,
        background: require('@/assets/onboarding/screenfour/blurbg4.png'),
        image: require('@/assets/onboarding/screenfour/fourthimage.png'),
        title: 'Connect with Madadgars or                            become a Madadgar',
        description: 'Look for relevant jobs to earn money or skilled workers for whatever work you want done, physical or online! ',
    },
    {
        id: 5,
        background: require('@/assets/onboarding/screenfive/blur5.png'),
        image: require('@/assets/onboarding/screenfive/fifthimage.png'),
        title: 'Freelance,             Outsource',
        description: 'Find unique employment opportunities or discover top freelances to get your own tasks done.',
    },
    {
        id: 6,
        background: require('@/assets/onboarding/screensix/blur6.png'),
        image: require('@/assets/onboarding/screensix/sixthimage.png'),
        title: 'Trust and Safety, Our Priority',
        description: 'Every worker on Madadgar is thoroughly vetted and authorized to provide top-notch services.',
    }
];

export default function OnboardingScreen() {
    const router = useRouter();

    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Create animated values for floating effect
    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Create a continuous floating animation
        const floatingAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.easeInOutQuad,
                    useNativeDriver: true
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 2000,
                    easing: Easing.easeInOutQuad,
                    useNativeDriver: true
                })
            ])
        );

        // Start the animation
        floatingAnimation.start();

        // Cleanup animation on component unmount
        return () => floatingAnimation.stop();
    }, [floatAnim]);

    // Interpolate the animated value to create translation
    const translateY = floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-15, 15] // Moves up and down by 30 pixels
    });

    const translateX = floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-5, 5] // Adds a slight horizontal movement
    });

    // Handle automatic updating of the progress bar index
    const onScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: false }
    );

    useEffect(() => {
        const listener = scrollX.addListener(({ value }) => {
            const newIndex = Math.round(value / width);
            setCurrentIndex(newIndex);
        });
        return () => scrollX.removeListener(listener);
    }, [scrollX]);

    // Move to the next page
    const goToNextPage = () => {
        if (currentIndex < onboardingData.length - 1) {
            flatListRef.current.scrollToIndex({ index: currentIndex + 1 });
        } else {
            router.push('/home'); // Navigate to the main app or home screen
        }
    };

    // Skip to last screen
    const skipToLastScreen = () => {
        flatListRef.current.scrollToIndex({
            index: onboardingData.length - 1
        });
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

            {/* Skip Button */}
            {currentIndex > 0 && currentIndex < onboardingData.length - 1 && (
                <TouchableOpacity
                    className="absolute top-28 right-12 z-20"
                    onPress={skipToLastScreen}
                >
                    <Text className="text-gray-600 text-lg font-semibold">Skip</Text>
                </TouchableOpacity>
            )}

            {/* Onboarding Pages */}
            <FlatList
                data={onboardingData}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                ref={flatListRef}
                onScroll={onScroll}
                scrollEventThrottle={16}
                renderItem={({ item }) => (
                    <View style={{ width, height }} className="relative">
                        {/* Animated Background */}
                        <Animated.View
                            className="absolute inset-0 overflow-hidden"
                            style={{
                                transform: [
                                    { translateY },
                                    { translateX }
                                ]
                            }}
                        >
                            <ImageBackground
                                source={item.background}
                                className="w-[120%] h-[120%] -left-[10%] -top-[10%] opacity-40"
                                resizeMode="cover"
                            />
                        </Animated.View>

                        {/* Content */}
                        <View className="flex-1 justify-center items-center px-4 -mt-10">
                            <Image
                                source={item.image}
                                className="w-72 h-72"
                                resizeMode="contain"
                            />
                            <Text className="text-[24px] text-center mt-4 px-4 font-pbold">
                                {item.title}
                            </Text>
                            <Text className="text-center text-[14px] text-gray-600 mt-4 px-8 font-pregular">
                                {item.description}
                            </Text>
                        </View>
                    </View>
                )}
            />

            {/* Progress Indicator */}
            <View className="absolute bottom-40 self-center flex-row">
                {onboardingData.map((_, index) => (
                    <View
                    key={index}
                    className={`w-[9px] h-[9px] rounded-full mx-[3px] ${
                        index === currentIndex ? 'bg-[#0D9F6F]' : 'bg-gray-300'
                    }`}
                />
                ))}
            </View>

            {/* Next/Get Started Button */}
         <OnboardingButton
             currentIndex={currentIndex}
             onboardingData={onboardingData}
             goToNextPage={goToNextPage}
         />
        </View>
    );
}