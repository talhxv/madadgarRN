"use client"

import { useState } from "react"
import { View, Text, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native"
import { BlurView } from "expo-blur"
import { X, Flag, AlertTriangle } from "lucide-react-native"
import { supabase } from "@/lib/supabase"

interface ReportModalProps {
  isVisible: boolean
  onClose: () => void
  chatId: string | null
  reportedUserId: string | null
  reporterId: string | null
}

export const ReportModal = ({ isVisible, onClose, chatId, reportedUserId, reporterId }: ReportModalProps) => {
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const reportReasons = ["Inappropriate behavior", "Spam or scam", "Harassment", "False information", "Other"]

  const handleSubmit = async () => {
    if (!reason) {
      Alert.alert("Error", "Please select a reason for reporting")
      return
    }

    if (!reportedUserId || !reporterId || !chatId) {
      Alert.alert("Error", "Missing required information")
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase.from("user_reports").insert({
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        chat_id: chatId,
        reason: reason,
        details: details,
        status: "pending",
        created_at: new Date().toISOString(),
      })

      if (error) throw error

      Alert.alert("Report Submitted", "Thank you for your report. Our team will review it shortly.", [
        { text: "OK", onPress: () => onClose() },
      ])

      // Reset form
      setReason("")
      setDetails("")
    } catch (error) {
      console.error("Error submitting report:", error)
      Alert.alert("Error", "Failed to submit report. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={20} tint="dark" style={{ flex: 1 }}>
        <View className="flex-1 justify-center items-center p-4">
          <View className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-xl">
            {/* Header */}
            <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
              <View className="flex-row items-center">
                <Flag size={20} color="#EF4444" className="mr-2" />
                <Text className="text-xl font-pbold text-gray-800">Report User</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="p-2 rounded-full bg-gray-100"
                accessibilityLabel="Close modal"
              >
                <X size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View className="p-6">
              <View className="bg-red-50 p-4 rounded-xl mb-4 flex-row items-start">
                <AlertTriangle size={20} color="#EF4444" className="mr-2 mt-0.5" />
                <Text className="text-red-700 flex-1">
                  Reports are taken seriously. False reports may result in action against your account.
                </Text>
              </View>

              <Text className="font-pmedium text-gray-800 mb-2">Reason for reporting</Text>
              <View className="mb-4">
                {reportReasons.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    className={`flex-row items-center p-3 border rounded-xl mb-2 ${
                      reason === item ? "border-[#0D9F70] bg-[#E7F7F1]" : "border-gray-200"
                    }`}
                    onPress={() => setReason(item)}
                  >
                    <View
                      className={`w-5 h-5 rounded-full border mr-3 items-center justify-center ${
                        reason === item ? "border-[#0D9F70]" : "border-gray-300"
                      }`}
                    >
                      {reason === item && <View className="w-3 h-3 rounded-full bg-[#0D9F70]" />}
                    </View>
                    <Text className={`${reason === item ? "text-[#0D9F70]" : "text-gray-700"}`}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="font-pmedium text-gray-800 mb-2">Additional details (optional)</Text>
              <TextInput
                className="border border-gray-200 rounded-xl p-3 bg-gray-50 text-gray-800 h-24"
                value={details}
                onChangeText={setDetails}
                placeholder="Please provide any additional information that might help us understand the issue..."
                multiline
                textAlignVertical="top"
                placeholderTextColor="#9CA3AF"
              />

              <TouchableOpacity
                className={`mt-6 py-4 rounded-xl items-center ${
                  submitting || !reason ? "bg-gray-300" : "bg-[#EF4444]"
                }`}
                onPress={handleSubmit}
                disabled={submitting || !reason}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-psemibold text-lg">Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  )
}
