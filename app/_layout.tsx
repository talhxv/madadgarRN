import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from 'expo-status-bar';
import { useFonts } from "expo-font";
import { useEffect } from "react";
import "../global.css";
import { ModalProvider } from "@/contexts/ModalContext";
import { AuthProvider } from "@/contexts/AuthContext";
import CreateModal from "@/components/CreateModal";
import { StripeProvider } from '@stripe/stripe-react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [fontsLoaded, error] = useFonts({
        "Poppins-Black": require("../assets/fonts/Poppins-Black.ttf"),
        "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
        "Poppins-ExtraBold": require("../assets/fonts/Poppins-ExtraBold.ttf"),
        "Poppins-ExtraLight": require("../assets/fonts/Poppins-ExtraLight.ttf"),
        "Poppins-Light": require("../assets/fonts/Poppins-Light.ttf"),
        "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
        "Poppins-Regular": require("../assets/fonts/Poppins-Regular.ttf"),
        "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
        "Poppins-Thin": require("../assets/fonts/Poppins-Thin.ttf"),
        "Poppins-BlackItalic": require("../assets/fonts/Poppins-BlackItalic.ttf"),
        "Poppins-BoldItalic": require("../assets/fonts/Poppins-BoldItalic.ttf"),
        "Poppins-Italic": require("../assets/fonts/Poppins-Italic.ttf"),
        "Poppins-ExtraBoldItalic": require("../assets/fonts/Poppins-ExtraBoldItalic.ttf"),
        "Poppins-LightItalic": require("../assets/fonts/Poppins-LightItalic.ttf"),
        "Poppins-ExtraLightItalic": require("../assets/fonts/Poppins-ExtraLightItalic.ttf"),
        "Poppins-MediumItalic": require("../assets/fonts/Poppins-MediumItalic.ttf"),
        "Poppins-ThinItalic": require("../assets/fonts/Poppins-ThinItalic.ttf"),
        "Poppins-SemiBoldItalic": require("../assets/fonts/Poppins-SemiBoldItalic.ttf"),
    });

    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        if (error) throw error;

        if (fontsLoaded) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded, error]);

    if (!fontsLoaded && !error) {
        return null;
    }

    return (
        <StripeProvider
            publishableKey="pk_test_51Piy7a08anrWD70DCwCJWABV2L3JXMYXYiIL6GLOdIkkJ3qULICstEyGdBOEaxucmDUwa0HZntP0LtCj2n114tC5008Qol8QJN"
            urlScheme="madadgar"
            merchantIdentifier="merchant.com.madadgar"
        >
            <AuthProvider>
                <ModalProvider>
                    <StatusBar style="light" />
                    <Stack screenOptions={{
                        headerShown: false,
                        gestureEnabled: true,
                        cardStyleInterpolator: ({ current, next }: { current: any, next: any }) => {
                            return {
                                cardStyle: {
                                    opacity: next
                                        ? next.progress.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [1, 0],
                                        })
                                        : current.progress.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0, 1],
                                        }),
                                },
                            };
                        },
                    }}>
                        <Stack.Screen name="index" options={{ headerShown: false }} />
                        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    </Stack>

                    {/* Global modal that can appear on any screen */}
                    <CreateModal />
                </ModalProvider>
            </AuthProvider>
        </StripeProvider>
    );
}