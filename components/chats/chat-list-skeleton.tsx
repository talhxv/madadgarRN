import { View } from "react-native"
import { Skeleton } from "@/components/ui/skeleton"

export const ChatListSkeleton = () => {
  // Create an array of 5 items to render multiple skeleton items
  const skeletonItems = Array.from({ length: 5 }, (_, i) => i)

  return (
    <View className="flex-1">
      {skeletonItems.map((item) => (
        <View key={item} className="p-4 border-b border-gray-100 flex-row">
          {/* Avatar skeleton */}
          <Skeleton width={48} height={48} borderRadius={24} style={{ marginRight: 12 }} />

          <View className="flex-1">
            {/* Name and time */}
            <View className="flex-row justify-between items-center mb-1">
              <Skeleton width={120} height={18} borderRadius={4} />
              <Skeleton width={50} height={14} borderRadius={4} />
            </View>

            {/* Job title */}
            <Skeleton width="80%" height={16} borderRadius={4} style={{ marginBottom: 8 }} />

            {/* Last message */}
            <View className="flex-row justify-between items-center">
              <Skeleton width="60%" height={14} borderRadius={4} />
              {/* Unread badge - show randomly */}
              {item % 2 === 0 && <Skeleton width={24} height={24} borderRadius={12} />}
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}
