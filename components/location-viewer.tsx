"use client"

import type React from "react"
import { useRef, useEffect, useState } from "react"
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Linking, Platform, Alert } from "react-native"
import MapView, { Marker, type Region } from "react-native-maps"
import { X, Navigation, Copy, RefreshCw } from "lucide-react-native"

interface LocationViewerProps {
  address: string
  latitude?: number
  longitude?: number
  onClose: () => void
}

// Fallback coordinates for different regions
const FALLBACK_COORDS = {
  // Default to center of Islamabad if Pakistan is in the address
  pakistan: { latitude: 33.6844, longitude: 73.0479 },
  // Default to center of country/region if detected in address
  usa: { latitude: 37.7749, longitude: -122.4194 },
  uk: { latitude: 51.5074, longitude: -0.1278 },
  canada: { latitude: 43.6532, longitude: -79.3832 },
  australia: { latitude: -33.8688, longitude: 151.2093 },
  // Generic fallback
  default: { latitude: 33.6844, longitude: 73.0479 }, // Default to Islamabad
}

const LocationViewer: React.FC<LocationViewerProps> = ({ address, latitude, longitude, onClose }) => {
  const mapRef = useRef<MapView | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [coords, setCoords] = useState({
    latitude: latitude || getFallbackCoordinates(address).latitude,
    longitude: longitude || getFallbackCoordinates(address).longitude,
  })
  const [geocodingAttempted, setGeocodingAttempted] = useState(false)

  // Get fallback coordinates based on address text
  function getFallbackCoordinates(addressText: string) {
    const lowerAddress = addressText.toLowerCase()

    if (lowerAddress.includes("pakistan")) return FALLBACK_COORDS.pakistan
    if (lowerAddress.includes("usa") || lowerAddress.includes("united states")) return FALLBACK_COORDS.usa
    if (lowerAddress.includes("uk") || lowerAddress.includes("united kingdom")) return FALLBACK_COORDS.uk
    if (lowerAddress.includes("canada")) return FALLBACK_COORDS.canada
    if (lowerAddress.includes("australia")) return FALLBACK_COORDS.australia

    // Try to extract coordinates from the address if they're in the format "lat,lng"
    const coordsMatch = addressText.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
    if (coordsMatch) {
      return {
        latitude: Number.parseFloat(coordsMatch[1]),
        longitude: Number.parseFloat(coordsMatch[2]),
      }
    }

    return FALLBACK_COORDS.default
  }

  // If we don't have coordinates, we need to geocode the address
  useEffect(() => {
    if (latitude && longitude) {
      // We have coordinates, use them
      setCoords({
        latitude,
        longitude,
      })
      setIsLoading(false)
    } else {
      // No coordinates, try to geocode the address
      geocodeAddress()
    }
  }, [address, latitude, longitude])

  const geocodeAddress = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    setGeocodingAttempted(true)

    try {
      // Try multiple geocoding services for better reliability

      // First attempt: OpenStreetMap Nominatim
      try {
        const encodedAddress = encodeURIComponent(address)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
          {
            headers: {
              Accept: "application/json",
              "User-Agent": "ReactNativeApp/1.0", // Nominatim requires a user agent
            },
          },
        )

        if (!response.ok) {
          throw new Error(`Nominatim API error: ${response.status}`)
        }

        const data = await response.json()

        if (data && data.length > 0) {
          const location = data[0]
          const newCoords = {
            latitude: Number.parseFloat(location.lat),
            longitude: Number.parseFloat(location.lon),
          }

          setCoords(newCoords)
          animateToLocation(newCoords)
          setIsLoading(false)
          return // Success, exit function
        }
      } catch (error) {
        console.error("Nominatim geocoding failed:", error)
        // Continue to next method
      }

      // Second attempt: Fallback to approximate location based on address text
      const fallbackCoords = getFallbackCoordinates(address)
      setCoords(fallbackCoords)
      animateToLocation(fallbackCoords)

      // Show a warning that we're using approximate location
      setErrorMsg("Using approximate location. Exact address couldn't be found.")
    } catch (error) {
      console.error("All geocoding attempts failed:", error)
      // Use fallback coordinates but show error
      const fallbackCoords = getFallbackCoordinates(address)
      setCoords(fallbackCoords)
      animateToLocation(fallbackCoords)
      setErrorMsg("Couldn't pinpoint exact location. Showing approximate area.")
    } finally {
      setIsLoading(false)
    }
  }

  const animateToLocation = (location: { latitude: number; longitude: number }) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          ...location,
          latitudeDelta: 0.02, // Zoom out a bit more for approximate locations
          longitudeDelta: 0.02,
        },
        1000,
      )
    }
  }

  const openDirections = () => {
    const scheme = Platform.select({ ios: "maps:", android: "geo:" })
    const url = Platform.select({
      ios: `${scheme}?q=${encodeURIComponent(address)}&ll=${coords.latitude},${coords.longitude}`,
      android: `${scheme}0,0?q=${coords.latitude},${coords.longitude}(${encodeURIComponent(address)})`,
    })

    if (url) {
      Linking.openURL(url).catch((err) => {
        Alert.alert("Error", "Couldn't open maps app. Please try again.")
      })
    }
  }

  const copyAddressToClipboard = () => {
    Linking.setString(address)
    Alert.alert("Copied", "Address copied to clipboard")
  }

  const retryGeocoding = () => {
    geocodeAddress()
  }

  const initialRegion: Region = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Location</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0D9F70" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        ) : (
          <>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={initialRegion}
              scrollEnabled={true}
              zoomEnabled={true}
              rotateEnabled={false}
            >
              <Marker
                coordinate={{
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                }}
                title={address}
                description={errorMsg ? "Approximate location" : "Job location"}
                pinColor="#0D9F70"
              />
            </MapView>

            {errorMsg && (
              <View style={styles.warningContainer}>
                <Text style={styles.warningText}>{errorMsg}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={retryGeocoding}>
                  <RefreshCw size={14} color="#0D9F70" />
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.addressContainer}>
              <View style={styles.addressHeader}>
                <Text style={styles.addressLabel}>Address</Text>
                <TouchableOpacity onPress={copyAddressToClipboard} style={styles.copyButton}>
                  <Copy size={14} color="#666" />
                </TouchableOpacity>
              </View>
              <Text style={styles.addressText}>{address}</Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.directionsButton} onPress={openDirections}>
                  <Navigation size={16} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.directionsText}>Get Directions</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 4,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  warningContainer: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255, 248, 225, 0.95)",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#FFC107",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  warningText: {
    fontSize: 12,
    color: "#5D4037",
    flex: 1,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    padding: 4,
  },
  retryText: {
    fontSize: 12,
    color: "#0D9F70",
    marginLeft: 4,
    fontWeight: "bold",
  },
  addressContainer: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "white",
    padding: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  addressLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "bold",
  },
  copyButton: {
    padding: 4,
  },
  addressText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: "row",
  },
  directionsButton: {
    backgroundColor: "#0D9F70",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
  },
  buttonIcon: {
    marginRight: 8,
  },
  directionsText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginBottom: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
  },
})

export default LocationViewer
