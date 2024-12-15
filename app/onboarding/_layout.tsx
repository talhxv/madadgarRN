import { Stack } from 'expo-router';

export default function OnboardingLayout() {
    return (
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
            <Stack.Screen name="screen1" options={{ headerShown: false }} />
            <Stack.Screen name="screen2" options={{ headerShown: false }} />
            <Stack.Screen name="screen3" options={{ headerShown: false }} />
        </Stack>
    );
}