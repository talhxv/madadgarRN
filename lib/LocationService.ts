import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase'; // Import your existing supabase instance

// Location types
export interface UserLocation {
    latitude: number;
    longitude: number;
    accuracy?: number;
    updatedAt?: string;
}

class LocationService {
    // Request location permissions
    async requestPermissions(): Promise<boolean> {
        try {
            console.log("Requesting location permissions...");
            const { status } = await Location.requestForegroundPermissionsAsync();
            console.log("Permission status:", status);
            return status === 'granted';
        } catch (error) {
            console.error("Error requesting permissions:", error);
            throw error;
        }
    }

    // Get current location once
    async getCurrentLocation(): Promise<UserLocation> {
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) {
            throw new Error('Location permission not granted');
        }

        console.log("Getting current position...");
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced
            });

            console.log("Got position:", location);
            return {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy
            };
        } catch (error) {
            console.error("Error getting position:", error);
            throw error;
        }
    }

    // Update user location in Supabase
    async updateUserLocation(userId: string): Promise<UserLocation> {
        try {
            console.log("Updating location for user:", userId);
            const location = await this.getCurrentLocation();

            // Convert to PostGIS point format
            const point = `POINT(${location.longitude} ${location.latitude})`;

            console.log("Upserting location to Supabase:", point);
            // Explicitly log the request we're making
            console.log(`Upserting to 'locations' table with user_id=${userId}`);

            const { data, error } = await supabase
                .from('locations')
                .upsert({
                    user_id: userId,
                    geom: point,
                    accuracy: location.accuracy || 0
                }, {
                    onConflict: 'user_id'
                });

            if (error) {
                console.error("Supabase error:", error);
                throw error;
            }

            console.log("Location updated successfully:", data);
            return location;
        } catch (error) {
            console.error('Error updating location:', error);
            throw error;
        }
    }

    // Function to retrieve locations for multiple users (for your job matching feature)
    async getUserLocations(userIds: string[]): Promise<Array<UserLocation & { userId: string }>> {
        try {
            // First check if the RPC function exists
            const { data: functionExists, error: functionCheckError } = await supabase
                .rpc('pg_proc_exists', { function_name: 'get_user_locations' });

            // If the function doesn't exist or there's an error, fall back to a regular query
            if (functionCheckError || !functionExists) {
                console.log("RPC function doesn't exist, using direct query");

                // Direct query fallback
                const { data, error } = await supabase
                    .from('locations')
                    .select('user_id, geom, accuracy, updated_at')
                    .in('user_id', userIds);

                if (error) {
                    throw error;
                }

                // Process the data to extract coordinates
                const locations = await Promise.all(data.map(async (item) => {
                    // For PostGIS point, we need to extract lat/lng
                    const { data: geoData, error: geoError } = await supabase
                        .rpc('st_asgeojson', { geog: item.geom });

                    if (geoError) {
                        throw geoError;
                    }

                    const geojson = JSON.parse(geoData);

                    return {
                        userId: item.user_id,
                        latitude: geojson.coordinates[1],
                        longitude: geojson.coordinates[0],
                        accuracy: item.accuracy,
                        updatedAt: item.updated_at
                    };
                }));

                return locations;
            }

            // If the function exists, use it
            const { data, error } = await supabase
                .rpc('get_user_locations', { user_ids: userIds });

            if (error) {
                console.error('Error fetching user locations:', error);
                throw error;
            }

            return data.map((item: any) => ({
                userId: item.user_id,
                latitude: item.latitude,
                longitude: item.longitude,
                accuracy: item.accuracy,
                updatedAt: item.updated_at
            }));
        } catch (error) {
            console.error('Error in getUserLocations:', error);
            throw error;
        }
    }

    // Added simplified version for saving location with address
    async saveLocationWithAddress(
        userId: string,
        latitude: number,
        longitude: number
    ): Promise<{ location: UserLocation, address: string }> {
        try {
            // Get formatted address
            const reverseGeocode = await Location.reverseGeocodeAsync({
                latitude,
                longitude
            });

            let address = "Location selected";
            if (reverseGeocode.length > 0) {
                const loc = reverseGeocode[0];
                address = [
                    loc.name,
                    loc.street,
                    loc.city,
                    loc.region,
                    loc.postalCode,
                    loc.country
                ].filter(Boolean).join(', ');
            }

            // Convert to PostGIS point format
            const point = `POINT(${longitude} ${latitude})`;

            // Update location in database
            const { error: locationError } = await supabase
                .from('locations')
                .upsert({
                    user_id: userId,
                    geom: point,
                    accuracy: 0 // Default accuracy
                }, {
                    onConflict: 'user_id'
                });

            if (locationError) throw locationError;

            // Update address in profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ address })
                .eq('user_id', userId);

            if (profileError) throw profileError;

            return {
                location: {
                    latitude,
                    longitude
                },
                address
            };
        } catch (error) {
            console.error('Error saving location with address:', error);
            throw error;
        }
    }
}

// Create and export a singleton instance
export const locationService = new LocationService();