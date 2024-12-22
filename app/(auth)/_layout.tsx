import React from 'react';
import { View } from 'react-native';
import { Stack, usePathname } from 'expo-router';

export default function AuthLayout() {
    const pathname = usePathname();

    // If we're on the sign-in or sign-up screen, render the screen directly without a header
    if (pathname === '/sign-in' || pathname === '/sign-up' || pathname === '/create-profile') {
        return (
            <Stack screenOptions={{ headerShown: false }} />
        );
    }

    // For other routes within auth, render the layout with the screen inside
    return (
        <View style={{ flex: 1 }}>
            {/* You can add any common UI elements for the auth layout here */}
            <Stack />
        </View>
    );
}