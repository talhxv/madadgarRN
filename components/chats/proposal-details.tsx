"use client"

import React from "react"
import { View, Text, Modal, TouchableOpacity, ScrollView, Image, ActivityIndicator, Animated } from "react-native"
import { X, Check, Banknote, ThumbsUp } from "lucide-react-native"

type ProposalDetailsProps = {
  isVisible: boolean
  onClose: () => void
  proposal: any
  jobTitle?: string
  isJobOwner: boolean
  onAccept: () => void
  isAccepting: boolean
}

export const ProposalDetails = ({
  isVisible,
  onClose,
  proposal,
  jobTitle,
  isJobOwner,
  onAccept,
  isAccepting,
}: ProposalDetailsProps) => {
  const [animation] = React.useState(new Animated.Value(0))

  React.useEffect(() => {
    if (isVisible) {
      Animated.spring(animation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 7,
      }).start()
    } else {
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [isVisible])

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  })

  if (!proposal) return null

  return (
    <Modal animationType="fade" transparent={true} visible={isVisible} onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <Animated.View
          style={{
            transform: [{ translateY }],
            maxHeight: "90%",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: "white",
            overflow: "hidden",
          }}
        >
          <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />

          <View className="px-6 py-2 flex-row justify-between items-center">
            <Text className="text-xl font-pbold text-gray-800">Proposal Details</Text>
            <TouchableOpacity
              onPress={onClose}
              className="p-2 rounded-full bg-gray-100"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
            {jobTitle && (
              <View className="mb-4">
                <Text className="text-gray-500 text-sm">For job</Text>
                <Text className="text-gray-800 font-pmedium">{jobTitle}</Text>
              </View>
            )}

            <View className="bg-gray-50 p-4 rounded-xl mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-[#0D9F70] font-pbold">Payment Details</Text>
                <View
                  className={`px-2 py-1 rounded-full ${
                    proposal.status === "accepted"
                      ? "bg-green-100"
                      : proposal.status === "rejected"
                        ? "bg-red-100"
                        : "bg-blue-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-pmedium ${
                      proposal.status === "accepted"
                        ? "text-green-700"
                        : proposal.status === "rejected"
                          ? "text-red-700"
                          : "text-blue-700"
                    }`}
                  >
                    {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                  <Banknote size={18} color="#0D9F70" />
                </View>
                <View className="ml-3">
                  <Text className="text-gray-500 text-xs">Rate</Text>
                  <Text className="text-gray-800 font-pmedium">
                    {proposal.currency} {proposal.rate} •{" "}
                    {proposal.payment_type === "hourly" ? "Hourly rate" : "Project budget"}
                  </Text>
                </View>
              </View>

              {proposal.has_done_before && (
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <ThumbsUp size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-800 font-pmedium">Has experience with similar work</Text>
                  </View>
                </View>
              )}
            </View>

            <View className="bg-gray-50 p-4 rounded-xl mb-4">
              <Text className="text-[#0D9F70] font-pbold mb-2">Proposal</Text>
              <Text className="text-gray-700">{proposal.proposal_text}</Text>
            </View>

            {proposal.portfolio_images && proposal.portfolio_images.length > 0 && (
              <View className="mb-6">
                <Text className="text-[#0D9F70] font-pbold mb-2">Portfolio Images</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {proposal.portfolio_images.map((imageUrl: string, index: number) => (
                    <Image
                      key={index}
                      source={{ uri: imageUrl }}
                      className="w-32 h-32 rounded-xl mr-3"
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            <View className="h-24" />
          </ScrollView>

          {isJobOwner && proposal.status === "pending" && (
            <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4">
              <TouchableOpacity
                className="bg-[#0D9F70] py-3.5 rounded-xl w-full items-center flex-row justify-center"
                onPress={onAccept}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Check size={20} color="white" />
                    <Text className="text-white font-pbold ml-2">Accept Proposal</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}
