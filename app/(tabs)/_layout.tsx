import React from 'react';
import { View } from 'react-native';
import { Tabs } from "expo-router";
import { Home, Search, Clock, User } from 'lucide-react-native';
import { PlusCircle } from 'lucide-react-native';
import { useModal } from "@/contexts/ModalContext";

const TabsLayout = () => {
    const { showCreateModal } = useModal();

    return (
        <Tabs
            screenOptions={{
                tabBarStyle: {
                    height: 65,
                    paddingBottom: 10,
                    paddingTop: 10,
                    backgroundColor: 'white',
                    borderTopWidth: 1,
                    borderTopColor: '#f1f1f1',
                },
                tabBarActiveTintColor: '#53F3AE',
                tabBarInactiveTintColor: '#71717a',
                headerShown: false,
            }}
        >
            <Tabs.Screen
                name="Home"
                options={{
                    tabBarLabel: 'Home',
                    tabBarIcon: ({ color }) => (
                        <Home size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="Search"
                options={{
                    tabBarLabel: 'Search',
                    tabBarIcon: ({ color }) => (
                        <Search size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="Create"
                options={{
                    tabBarLabel: '',
                    tabBarIcon: () => (
                        <View className="bg-[#53F3AE] rounded-full p-3 -mt-8 shadow-lg">
                            <PlusCircle size={32} color="white" />
                        </View>
                    ),
                    tabBarButton: (props) => (
                        <View {...props} onTouchEnd={showCreateModal} />
                    ),
                }}
                listeners={{
                    tabPress: (e) => {
                        // Prevent default navigation
                        e.preventDefault();
                        // Show modal instead
                        showCreateModal();
                    },
                }}
            />
            <Tabs.Screen
                name="History"
                options={{
                    tabBarLabel: 'History',
                    tabBarIcon: ({ color }) => (
                        <Clock size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="Profile"
                options={{
                    tabBarLabel: 'Profile',
                    tabBarIcon: ({ color }) => (
                        <User size={24} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
};

export default TabsLayout;