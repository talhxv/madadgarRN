import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { locationService, UserLocation } from '@/lib/LocationService';

// You'll need to implement or use a geocoding service
// This is a simple placeholder for the actual implementation
interface GeocodingService {
    searchLocations: (query: string) => Promise<SearchResult[]>;
}

interface SearchResult {
    id: string;
    name: string;
    description?: string;
    location: UserLocation;
}

// Mock implementation - replace with actual service
const geocodingService: GeocodingService = {
    searchLocations: async (query: string) => {
        // In a real implementation, this would call a geocoding API
        console.log(`Searching for: ${query}`);
        // Mock response for testing
        return [];
    }
};

interface LocationPickerProps {
    userId: string;
    onLocationSelected?: (location: UserLocation) => void;
    initialRegion?: Region;
}

const LocationPicker: React.FC<LocationPickerProps> = ({
                                                           userId,
                                                           onLocationSelected,
                                                           initialRegion
                                                       }) => {
    const [location, setLocation] = useState<UserLocation | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const mapRef = useRef<MapView | null>(null);

    useEffect(() => {
        // Try to get initial location when component mounts if we don't have one
        if (!location && !initialRegion) {
            getCurrentLocation();
        }
    }, []);

    const getCurrentLocation = async () => {
        setIsLoading(true);
        setErrorMsg(null);

        try {
            console.log("Getting current location...");
            const currentLocation = await locationService.getCurrentLocation();
            console.log("Got location:", currentLocation);

            setLocation(currentLocation);

            // Center map on location
            if (mapRef.current) {
                mapRef.current.animateToRegion({
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                });
            }

            // Notify parent component
            if (onLocationSelected) {
                onLocationSelected(currentLocation);
            }
        } catch (error) {
            console.error("Error getting location:", error);
            if (error instanceof Error) {
                setErrorMsg(error.message);
            } else {
                setErrorMsg('Failed to get your location. Please check your device settings.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleMapPress = (event: any) => {
        const coords = event.nativeEvent.coordinate;
        const selectedLocation: UserLocation = {
            latitude: coords.latitude,
            longitude: coords.longitude
        };

        console.log("Map pressed, selected location:", selectedLocation);
        setLocation(selectedLocation);

        // Notify parent component
        if (onLocationSelected) {
            onLocationSelected(selectedLocation);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setSearchResults([]);

        try {
            const results = await geocodingService.searchLocations(searchQuery);
            setSearchResults(results);
        } catch (error) {
            console.error("Error searching locations:", error);
            if (error instanceof Error) {
                setErrorMsg(error.message);
            } else {
                setErrorMsg('Failed to search locations. Please try again.');
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchResultSelect = (result: SearchResult) => {
        setLocation(result.location);
        setSearchResults([]);
        setSearchQuery('');

        // Center map on selected location
        if (mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: result.location.latitude,
                longitude: result.location.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            });
        }

        // Notify parent component
        if (onLocationSelected) {
            onLocationSelected(result.location);
        }
    };

    return (
        <View style={styles.container}>
            {errorMsg ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={getCurrentLocation}
                    >
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    {/* Search Bar at the top */}
                    <View style={styles.searchContainer}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search for a location..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearch}
                            returnKeyType="search"
                        />
                        {isSearching && <ActivityIndicator style={styles.searchIcon} size="small" color="#2196F3" />}
                    </View>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <View style={styles.searchResultsContainer}>
                            {searchResults.map(result => (
                                <TouchableOpacity
                                    key={result.id}
                                    style={styles.searchResultItem}
                                    onPress={() => handleSearchResultSelect(result)}
                                >
                                    <Text style={styles.searchResultName}>{result.name}</Text>
                                    {result.description && (
                                        <Text style={styles.searchResultDescription}>{result.description}</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        initialRegion={initialRegion || (location ? {
                            latitude: location.latitude,
                            longitude: location.longitude,
                            latitudeDelta: 0.005,
                            longitudeDelta: 0.005,
                        } : undefined)}
                        onPress={handleMapPress}
                    >
                        {location && (
                            <Marker
                                coordinate={{
                                    latitude: location.latitude,
                                    longitude: location.longitude,
                                }}
                                title="Selected Location"
                                pinColor="#2196F3"
                                width={24}
                                height={24}
                            />
                        )}
                    </MapView>

                    <View style={styles.buttonContainer}>
                        <Text style={styles.hint}>
                            Tap anywhere on the map to select a different location
                        </Text>
                        <TouchableOpacity
                            style={styles.button}
                            onPress={getCurrentLocation}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.buttonText}>
                                    Get My Current Location
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    searchContainer: {
        position: 'absolute',
        top: 10,
        left: 10,
        right: 10,
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInput: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    searchIcon: {
        position: 'absolute',
        right: 15,
    },
    searchResultsContainer: {
        position: 'absolute',
        top: 60,
        left: 10,
        right: 10,
        zIndex: 20,
        backgroundColor: 'white',
        borderRadius: 8,
        maxHeight: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    searchResultItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    searchResultName: {
        fontWeight: 'bold',
    },
    searchResultDescription: {
        color: '#666',
        fontSize: 12,
        marginTop: 2,
    },
    buttonContainer: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    button: {
        marginTop: 10,
        backgroundColor: '#2196F3',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        minWidth: 200,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: '#2196F3',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    retryButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    hint: {
        color: '#666',
        textAlign: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: 8,
        borderRadius: 4,
    }
});

export default LocationPicker;