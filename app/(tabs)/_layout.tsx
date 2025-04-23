import React from 'react';
import { View, Dimensions, Pressable } from 'react-native';
import { Tabs } from "expo-router";
import { Home, Search, Clock, User, PlusCircle } from 'lucide-react-native';
import { useModal } from "@/contexts/ModalContext";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const TabsLayout = () => {
    const { showCreateModal } = useModal();
    const insets = useSafeAreaInsets();

    // Calculate bottom padding based on safe area
    const bottomPadding = Math.max(insets.bottom, 10);

    return (
        <Tabs
            screenOptions={({ route }) => ({
                tabBarStyle: {
                    height: 65 + bottomPadding,
                    paddingBottom: bottomPadding,
                    backgroundColor: 'white',
                    borderTopWidth: 0,
                    position: 'absolute',
                    bottom: 10,
                    // Use precise positioning with exact pixel values
                    width: width - 45,
                    marginLeft: 25, // Explicit left margin
                    marginRight: 25, // Explicit right margin
                    left: 0, // Reset any left positioning
                    right: 0, // Reset any right positioning
                    borderRadius: 28,
                    marginBottom: 5,
                    // Shadow properties
                    shadowColor: '#0F766E',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.15,
                    shadowRadius: 25,
                    elevation: 10,
                    borderWidth: 0.5,
                    borderColor: 'rgba(0,0,0,0.03)',
                },
                tabBarActiveTintColor: '#0F766E', // teal-700
                tabBarInactiveTintColor: '#9CA3AF', // gray-400
                headerShown: false,
                tabBarShowLabel: false, // Hide labels for all tabs
                tabBarItemStyle: {
                    paddingVertical: 12,
                },
                // Reduce ripple effect
                tabBarButton: (props) => (
                    <Pressable
                        {...props}
                        android_ripple={{ color: 'rgba(15, 118, 110, 0.1)', borderless: true, radius: 22 }}
                        style={props.style}
                    />
                ),
            })}
        >
            <Tabs.Screen
                name="Home"
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <View
                                style={{
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: focused ? 4 : 0
                                }}
                            >
                                <Home
                                    size={24}
                                    color={color}
                                    strokeWidth={focused ? 2.8 : 2.2}
                                />
                            </View>
                            {focused && (
                                <View
                                    style={{
                                        width: 5,
                                        height: 5,
                                        borderRadius: 2.5,
                                        backgroundColor: '#0F766E',
                                        marginTop: 2
                                    }}
                                />
                            )}
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="Search"
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <View
                                style={{
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: focused ? 4 : 0
                                }}
                            >
                                <Search
                                    size={24}
                                    color={color}
                                    strokeWidth={focused ? 2.8 : 2.2}
                                />
                            </View>
                            {focused && (
                                <View
                                    style={{
                                        width: 5,
                                        height: 5,
                                        borderRadius: 2.5,
                                        backgroundColor: '#0F766E',
                                        marginTop: 2
                                    }}
                                />
                            )}
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="Create"
                options={{
                    tabBarIcon: () => (
                        <View
                            style={{
                                backgroundColor: '#0d4d47',
                                borderRadius: 9999,
                                padding: 12,
                                marginTop: -45, // Lower the button further
                                position: 'absolute',
                                bottom: 0, // Adjust for alignment
                                shadowColor: '#0d4d47',
                                shadowOffset: { width: 0, height: 8 },
                                shadowOpacity: 0.4,
                                shadowRadius: 12,
                                elevation: 20,
                            }}
                        >
                            <PlusCircle size={32} color="white" />
                        </View>
                    ),
                    tabBarButton: (props) => (
                        <Pressable
                            {...props}
                            onTouchEnd={showCreateModal}
                            android_ripple={null}
                        />
                    ),
                }}
                listeners={{
                    tabPress: (e) => {
                        e.preventDefault();
                        showCreateModal();
                    },
                }}
            />

            <Tabs.Screen
                name="History"
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <View
                                style={{
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: focused ? 4 : 0
                                }}
                            >
                                <Clock
                                    size={24}
                                    color={color}
                                    strokeWidth={focused ? 2.8 : 2.2}
                                />
                            </View>
                            {focused && (
                                <View
                                    style={{
                                        width: 5,
                                        height: 5,
                                        borderRadius: 2.5,
                                        backgroundColor: '#0F766E',
                                        marginTop: 2
                                    }}
                                />
                            )}
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="Profile"
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <View
                                style={{
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: focused ? 4 : 0
                                }}
                            >
                                <User
                                    size={24}
                                    color={color}
                                    strokeWidth={focused ? 2.8 : 2.2}
                                />
                            </View>
                            {focused && (
                                <View
                                    style={{
                                        width: 5,
                                        height: 5,
                                        borderRadius: 2.5,
                                        backgroundColor: '#0F766E',
                                        marginTop: 2
                                    }}
                                />
                            )}
                        </View>
                    ),
                }}
            />
        </Tabs>
    );
};

export default TabsLayout;