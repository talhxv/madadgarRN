import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/supabaseClient';
import { Session, User } from '@supabase/supabase-js';

// Define the shape of your user profile from Supabase
interface UserProfile {
    user_id: string;
    full_name?: string;
    phone_number?: string;
    nic_number?: string;
    dob?: Date | string;
    is_verified?: boolean;
    created_at?: string;
}

// Define the context type
interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    session: Session | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    session: null,
    isLoading: true,
    signOut: async () => {},
    refreshUser: async () => {},
    refreshProfile: async () => {},
});

// Create a provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Function to fetch user profile from Supabase
    const fetchUserProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                return null;
            }

            return data as UserProfile;
        } catch (error) {
            return null;
        }
    };

    // Function to refresh the user
    const refreshUser = async () => {
        try {
            // Give Supabase more time to process the auth state
            await new Promise(resolve => setTimeout(resolve, 500));

            const { data, error } = await supabase.auth.getUser();

            if (error) {
                return;
            }

            setUser(data.user);

            if (data.user) {
                const userProfile = await fetchUserProfile(data.user.id);
                setProfile(userProfile);
            }
        } catch (error) {}
    };

    // Function to refresh just the profile data
    const refreshProfile = async () => {
        if (user) {
            const userProfile = await fetchUserProfile(user.id);
            setProfile(userProfile);
        }
    };

    // Function to sign out
    const signOut = async () => {
        try {
            setIsLoading(true);
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            setUser(null);
            setProfile(null);
            setSession(null);
        } catch (error) {
            Alert.alert('Error signing out', (error as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // Initial setup - fetch the user session and profile
    useEffect(() => {
        const fetchInitialSession = async () => {
            try {
                setIsLoading(true);

                // Get the current session
                const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    throw sessionError;
                }

                setSession(currentSession);

                if (currentSession?.user) {
                    setUser(currentSession.user);
                    const userProfile = await fetchUserProfile(currentSession.user.id);
                    setProfile(userProfile);
                }
            } catch (error) {} finally {
                setIsLoading(false);
            }
        };

        fetchInitialSession();

        // Set up auth state change listener
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            setSession(newSession);

            if (event === 'SIGNED_IN' && newSession?.user) {
                setUser(newSession.user);
                const userProfile = await fetchUserProfile(newSession.user.id);
                setProfile(userProfile);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setProfile(null);
            } else if (event === 'INITIAL_SESSION') {
                if (newSession?.user) {
                    setUser(newSession.user);
                    const userProfile = await fetchUserProfile(newSession.user.id);
                    setProfile(userProfile);
                }
            }
        });

        // Clean up the subscription
        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                session,
                isLoading,
                signOut,
                refreshUser,
                refreshProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

// Create a custom hook to use the auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};