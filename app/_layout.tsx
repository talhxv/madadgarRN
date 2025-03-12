import { Stack, SplashScreen } from "expo-router";
import { StatusBar } from 'expo-status-bar';
import { useFonts } from "expo-font";
import { useEffect } from "react";
import "../global.css";
import { ModalProvider } from "@/contexts/ModalContext";
import CreateModal from "@/components/CreateModal";

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
    });

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
        <ModalProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{
                headerShown: false,
                gestureEnabled: true, // Enable gestures for swiping between screens
                cardStyleInterpolator: ({ current, next }) => {
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
    );
}