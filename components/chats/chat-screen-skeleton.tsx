import { View } from "react-native"
import { Skeleton } from "@/components/ui/skeleton"

export const ChatScreenSkeleton = () => {
  return (
    <View className="flex-1 bg-white">
      {/* Header skeleton */}
      <View className="bg-[#0D9F70] pt-12 pb-4 px-4 rounded-b-3xl shadow-md">
        <View className="flex-row items-center">
          {/* Back button */}
          <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 8 }} />

          <View className="flex-row items-center flex-1">
            {/* Avatar */}
            <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />

            <View className="flex-1">
              {/* Name */}
              <Skeleton width={120} height={20} borderRadius={4} />
              {/* Job title */}
              <Skeleton width={180} height={16} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
          </View>
        </View>
      </View>

      {/* Proposal banner skeleton */}
      <View className="mx-4 mt-3 mb-1 p-3 bg-[#E7F7F1] rounded-xl flex-row items-center">
        <Skeleton width={32} height={32} borderRadius={16} style={{ marginRight: 12 }} />
        <View className="flex-1">
          <Skeleton width={100} height={18} borderRadius={4} />
          <Skeleton width={150} height={14} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>

      {/* Messages skeleton */}
      <View className="flex-1 p-4">
        {/* Received message */}
        <View className="self-start max-w-[80%] mb-4">
          <Skeleton width={200} height={80} borderRadius={12} style={{ borderTopLeftRadius: 0 }} />
          <Skeleton width={50} height={12} borderRadius={4} style={{ marginTop: 4, alignSelf: "flex-start" }} />
        </View>

        {/* Sent message */}
        <View className="self-end max-w-[80%] mb-4">
          <Skeleton width={180} height={60} borderRadius={12} style={{ borderTopRightRadius: 0 }} />
          <Skeleton width={50} height={12} borderRadius={4} style={{ marginTop: 4, alignSelf: "flex-end" }} />
        </View>

        {/* System message */}
        <View className="self-center max-w-[90%] my-3">
          <Skeleton width={250} height={40} borderRadius={8} />
        </View>

        {/* Received message */}
        <View className="self-start max-w-[80%] mb-4">
          <Skeleton width={220} height={40} borderRadius={12} style={{ borderTopLeftRadius: 0 }} />
          <Skeleton width={50} height={12} borderRadius={4} style={{ marginTop: 4, alignSelf: "flex-start" }} />
        </View>
      </View>

      {/* Input area skeleton */}
      <View className="border-t border-gray-100 p-3">
        <View className="flex-row items-center">
          <Skeleton width="85%" height={44} borderRadius={22} />
          <Skeleton width={44} height={44} borderRadius={22} style={{ marginLeft: 8 }} />
        </View>
      </View>
    </View>
  )
}
