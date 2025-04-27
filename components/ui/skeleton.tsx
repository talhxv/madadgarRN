"use client"

import { useEffect, useRef } from "react"
import { Animated, type ViewStyle } from "react-native"

interface SkeletonProps {
  width?: number | string
  height?: number | string
  borderRadius?: number
  style?: ViewStyle
}

export const Skeleton = ({ width = "100%", height = 20, borderRadius = 4, style }: SkeletonProps) => {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    )

    animation.start()

    return () => {
      animation.stop()
    }
  }, [opacity])

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: "#E5E7EB",
          opacity,
        },
        style,
      ]}
    />
  )
}
