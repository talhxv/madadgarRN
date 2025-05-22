"use client"

import { useState } from "react"
import { View, Text, TouchableOpacity } from "react-native"
import { CreditCard, Upload, Smartphone } from "lucide-react-native"

export const PaymentMethodSelector = ({ milestone, chatId, onSelectManualPayment, onPaymentComplete }) => {
  const [selectedMethod, setSelectedMethod] = useState(null)

  // Safety check - if props are undefined, provide default empty functions
  const handleSelectManualPayment = () => {
    if (onSelectManualPayment && typeof onSelectManualPayment === "function") {
      onSelectManualPayment()
    }
  }

  const handlePaymentComplete = (method) => {
    if (onPaymentComplete && typeof onPaymentComplete === "function") {
      onPaymentComplete(method)
    }
  }

  return (
    <View className="mt-4">
      <Text className="text-gray-700 font-pbold mb-3">Select Payment Method:</Text>

      {/* Stripe Online Payment */}
      <TouchableOpacity
        className={`flex-row items-center p-3 rounded-lg mb-2 border ${
          selectedMethod === "stripe" ? "border-purple-500 bg-purple-50" : "border-gray-200"
        }`}
        onPress={() => setSelectedMethod("stripe")}
        style={{ zIndex: 10 }}
      >
        <View className="w-10 h-10 rounded-full bg-purple-100 items-center justify-center mr-3">
          <CreditCard size={20} color="#7E22CE" />
        </View>
        <View className="flex-1">
          <Text className="font-pmedium text-gray-800">Credit/Debit Card</Text>
          <Text className="text-xs text-gray-500">Pay securely online with Stripe</Text>
        </View>
        <View
          className={`w-5 h-5 rounded-full border ${
            selectedMethod === "stripe" ? "border-purple-500 bg-purple-500" : "border-gray-300"
          }`}
        />
      </TouchableOpacity>

      {/* Manual Payment */}
      <TouchableOpacity
        className={`flex-row items-center p-3 rounded-lg mb-2 border ${
          selectedMethod === "manual" ? "border-purple-500 bg-purple-50" : "border-gray-200"
        }`}
        onPress={() => setSelectedMethod("manual")}
        style={{ zIndex: 10 }}
      >
        <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
          <Upload size={20} color="#1D4ED8" />
        </View>
        <View className="flex-1">
          <Text className="font-pmedium text-gray-800">Manual Payment</Text>
          <Text className="text-xs text-gray-500">Pay manually and upload proof</Text>
        </View>
        <View
          className={`w-5 h-5 rounded-full border ${
            selectedMethod === "manual" ? "border-purple-500 bg-purple-500" : "border-gray-300"
          }`}
        />
      </TouchableOpacity>

      {/* Mobile Payment */}
      <TouchableOpacity
        className={`flex-row items-center p-3 rounded-lg mb-2 border ${
          selectedMethod === "mobile" ? "border-purple-500 bg-purple-50" : "border-gray-200"
        }`}
        onPress={() => setSelectedMethod("mobile")}
        style={{ zIndex: 10 }}
      >
        <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3">
          <Smartphone size={20} color="#15803D" />
        </View>
        <View className="flex-1">
          <Text className="font-pmedium text-gray-800">Mobile Payment</Text>
          <Text className="text-xs text-gray-500">Pay via EasyPaisa or similar services</Text>
        </View>
        <View
          className={`w-5 h-5 rounded-full border ${
            selectedMethod === "mobile" ? "border-purple-500 bg-purple-500" : "border-gray-300"
          }`}
        />
      </TouchableOpacity>

      {/* Action Buttons */}
      <View className="mt-4 flex-row">
        <TouchableOpacity
          className="flex-1 bg-gray-200 py-3 rounded-full mr-2 items-center"
          onPress={() => setSelectedMethod(null)}
          style={{ zIndex: 10 }}
        >
          <Text className="font-pmedium text-gray-700">Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 py-3 rounded-full items-center ${selectedMethod ? "bg-[#0D9F70]" : "bg-gray-300"}`}
          disabled={!selectedMethod}
          style={{ zIndex: 10 }}
          onPress={() => {
            if (selectedMethod === "stripe") {
              // This will be handled by the StripePaymentHandler component
              handlePaymentComplete("stripe")
            } else if (selectedMethod === "manual") {
              handleSelectManualPayment()
            } else if (selectedMethod === "mobile") {
              // Handle mobile payment option
              handleSelectManualPayment() // For now, use the same flow as manual
            }
          }}
        >
          <Text className="font-pmedium text-white">Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
