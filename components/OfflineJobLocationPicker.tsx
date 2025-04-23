import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { locationService, UserLocation } from '@/lib/LocationService';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

// Simple interface for location data
interface JobLocation {
  address: string;
  latitude: number;
  longitude: number;
}

interface OfflineJobLocationPickerProps {
  onLocationChange: (location: JobLocation) => void;
  initialLocation?: UserLocation;
}

const OfflineJobLocationPicker: React.FC<OfflineJobLocationPickerProps> = ({ 
  onLocationChange,
  initialLocation 
}) => {
  const [location, setLocation] = useState<UserLocation | null>(initialLocation || null);
  const [address, setAddress] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    // Get initial location when component mounts if not provided
    if (!location) {
      getCurrentLocation();
    } else {
      // If we have an initial location, get its address
      getAddressFromCoordinates(location.latitude, location.longitude)
        .then(formattedAddress => {
          setAddress(formattedAddress);
        });
    }
  }, []);

  // When location changes, update the address and notify parent
  useEffect(() => {
    if (location) {
      getAddressFromCoordinates(location.latitude, location.longitude)
        .then(formattedAddress => {
          setAddress(formattedAddress);
          
          // Notify parent component with complete location data
          onLocationChange({
            address: formattedAddress,
            latitude: location.latitude,
            longitude: location.longitude
          });
        });
    }
  }, [location]);

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
  };

  const getAddressFromCoordinates = async (latitude: number, longitude: number): Promise<string> => {
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      console.error("Invalid coordinates:", { latitude, longitude });
      return "Location unavailable";
    }
    
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (reverseGeocode.length > 0) {
        const location = reverseGeocode[0];
        return [location.name, location.street, location.city, location.region, location.postalCode, location.country]
          .filter(Boolean)
          .join(", ");
      }

      return "Selected Location";
    } catch (error) {
      console.error("Error getting address:", error);
      return "Selected Location";
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
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={location ? {
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            } : undefined}
            onPress={handleMapPress}
          >
            {location && (
              <Marker
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                title="Selected Location"
                pinColor="#0D9F6F"
              />
            )}
          </MapView>

          {/* Selected location display */}
          {address && (
            <View style={styles.addressContainer}>
              <Ionicons name="location" size={18} color="#0D9F6F" />
              <Text style={styles.addressText} numberOfLines={2}>{address}</Text>
            </View>
          )}

          {/* Bottom controls */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={getCurrentLocation}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="locate" size={16} color="white" style={{marginRight: 8}} />
                  <Text style={styles.buttonText}>
                    Get My Current Location
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Hint as an overlay */}
          <View style={styles.hintContainer}>
            <Text style={styles.hint}>
              Tap anywhere on the map to select a location
            </Text>
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
    borderRadius: 8,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  addressContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  addressText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9F6F',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
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
    backgroundColor: '#0D9F6F',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  hintContainer: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
  },
  hint: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: 'white',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    fontSize: 12,
  }
});

export default OfflineJobLocationPicker;