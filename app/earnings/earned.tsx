"use client"

import { useEffect } from "react"
import { View, Text } from "react-native"
import { useRouter } from "expo-router"

export default function EarnedRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the main earnings dashboard
    router.replace("/earnings")
  }, [router])

  return (
    <View className="flex-1 justify-center items-center">
      <Text>Redirecting to earnings dashboard...</Text>
    </View>
  )
}
