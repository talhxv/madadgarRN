import { View, Text, FlatList, TouchableOpacity } from "react-native"
import { Star, Shield, ChevronRight } from "lucide-react-native"
import { format } from "date-fns"

export const ReviewList = ({ reviews, onViewReview }) => {
  if (!reviews || reviews.length === 0) {
    return (
      <View className="p-4 bg-gray-50 rounded-lg">
        <Text className="text-gray-500 text-center">No reviews yet</Text>
      </View>
    )
  }

  const renderReviewItem = ({ item }) => {
    return (
      <TouchableOpacity
        className="bg-white rounded-lg p-4 mb-3 border border-gray-100"
        onPress={() => onViewReview && onViewReview(item)}
      >
        <View className="flex-row justify-between items-center mb-2">
          <Text className="font-pbold text-gray-800">
            {item.reviewer_type === "client" ? "Client Review" : "Freelancer Review"}
          </Text>
          <View className="flex-row items-center">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={16} color="#FFD700" fill={i < item.rating ? "#FFD700" : "none"} />
            ))}
          </View>
        </View>

        <Text className="text-gray-600 mb-3" numberOfLines={2}>
          {item.review_text}
        </Text>

        <View className="flex-row justify-between items-center">
          <Text className="text-xs text-gray-500">{format(new Date(item.created_at), "MMM d, yyyy")}</Text>

          <View className="flex-row items-center">
            <Shield size={12} color="#0D9F70" />
            <Text className="text-xs text-gray-600 ml-1">Blockchain Verified</Text>
            <ChevronRight size={14} color="#9CA3AF" className="ml-1" />
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <FlatList
      data={reviews}
      renderItem={renderReviewItem}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={{ padding: 4 }}
    />
  )
}
