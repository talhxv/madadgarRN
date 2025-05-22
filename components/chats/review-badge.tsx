"use client"

import { View, Text, TouchableOpacity } from "react-native"
import { Shield, Star, ExternalLink } from "lucide-react-native"
import { useState } from "react"

export const ReviewBadge = ({ rating, transactionHash, verified = true, onPress }) => {
  const [expanded, setExpanded] = useState(false)

  const handlePress = () => {
    setExpanded(!expanded)
    if (onPress) {
      onPress()
    }
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      className={`rounded-lg overflow-hidden ${expanded ? "bg-blue-50" : "bg-gray-50"}`}
    >
      <View className="p-3">
        <View className="flex-row items-center">
          <Shield size={16} color={verified ? "#0D9F70" : "#9CA3AF"} />
          <Text className="ml-2 font-pmedium text-gray-800">Blockchain-Verified Review</Text>

          <View className="flex-row items-center ml-auto">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={14} color="#FFD700" fill={i < rating ? "#FFD700" : "none"} />
            ))}
          </View>
        </View>

        {expanded && (
          <View className="mt-2 pt-2 border-t border-blue-100">
            <Text className="text-xs text-gray-500 mb-1">Transaction Hash:</Text>
            <Text className="text-xs text-gray-700 font-pmedium break-all">{transactionHash}</Text>

            <TouchableOpacity
              className="flex-row items-center mt-2"
              onPress={() => {
                // Open blockchain explorer
                // In a real app, this would open the appropriate blockchain explorer
              }}
            >
              <ExternalLink size={12} color="#0D9F70" />
              <Text className="text-xs text-[#0D9F70] ml-1">Verify on Blockchain</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}
