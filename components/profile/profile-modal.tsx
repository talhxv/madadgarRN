"use client"

import { useState, useEffect } from "react"
import { View, Modal, TouchableOpacity, Animated } from "react-native"
import { BlurView } from "expo-blur"
import ViewProfile from "./view-profile"

interface ProfileModalProps {
  isVisible: boolean
  onClose: () => void
  userId: string
}

export default function ProfileModal({ isVisible, onClose, userId }: ProfileModalProps) {
  const [modalAnimation] = useState(new Animated.Value(0))

  useEffect(() => {
    if (isVisible) {
      Animated.spring(modalAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 7,
      }).start()
    } else {
      Animated.timing(modalAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [isVisible])

  const translateY = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [800, 0],
  })

  if (!isVisible) return null

  return (
    <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={onClose}>
      <View className="flex-1">
        <BlurView intensity={20} className="absolute top-0 left-0 right-0 bottom-0" tint="dark" />

        <TouchableOpacity className="absolute top-0 left-0 right-0 bottom-0" activeOpacity={1} onPress={onClose} />

        <Animated.View
          className="flex-1 bg-white rounded-t-3xl overflow-hidden mt-12"
          style={{ transform: [{ translateY }] }}
        >
          <ViewProfile userId={userId} onClose={onClose} />
        </Animated.View>
      </View>
    </Modal>
  )
}
