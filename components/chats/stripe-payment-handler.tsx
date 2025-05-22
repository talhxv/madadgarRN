"use client"

import { useState, useEffect } from "react"
import { Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native"
import { CreditCard } from "lucide-react-native"
import { useStripe } from "@stripe/stripe-react-native"
import { supabase } from "@/lib/supabase"

export const StripePaymentHandler = ({ milestone, chatId, onPaymentComplete, userId }) => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe()
  const [loading, setLoading] = useState(false)

  // Add this useEffect to ensure Stripe is initialized
  useEffect(() => {
    if (Platform.OS === "android") {
      try {
        // Check if the module is available before trying to use it
        const StripeModule = require("@stripe/stripe-react-native")
        if (StripeModule && StripeModule.PaymentConfiguration) {
          StripeModule.PaymentConfiguration.init({
            publishableKey:
              "pk_test_51Piy7a08anrWD70DCwCJWABV2L3JXMYXYiIL6GLOdIkkJ3qULICstEyGdBOEaxucmDUwa0HZntP0LtCj2n114tC5008Qol8QJN",
          })
          console.log("Stripe PaymentConfiguration initialized in component")
        } else {
          console.log("Stripe PaymentConfiguration not available, but will continue")
        }
      } catch (error) {
        // This will still log the error but won't break functionality
        console.log("Failed to initialize Stripe PaymentConfiguration in component, continuing anyway")
      }
    }
  }, [])

  const handleStripePayment = async () => {
    try {
      setLoading(true)

      // Ensure milestone is defined
      if (!milestone || !milestone.id) {
        throw new Error("Milestone information is missing")
      }

      // Check if amount is too low (Stripe requires minimum ~$0.50 USD)
      const amountInPKR = Number(milestone.amount || 0)
      const estimatedUSD = amountInPKR * 0.0036 // Approximate conversion rate

      if (estimatedUSD < 0.5) {
        throw new Error(
          `Amount too low for Stripe. Minimum is approximately PKR 140. Current amount: PKR ${amountInPKR.toFixed(2)}`,
        )
      }

      console.log("Creating payment intent with data:", {
        milestone_id: milestone.id,
        chat_id: chatId,
        amount: milestone.amount,
      })

      // Get the payment intent client secret from your server
      const response = await fetch("https://stripe-api-five.vercel.app/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestone_id: milestone.id,
          chat_id: chatId || "",
          amount: milestone.amount,
          currency: "pkr",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create payment intent")
      }

      const { clientSecret } = await response.json()

      if (!clientSecret) {
        throw new Error("No client secret returned from the server")
      }

      console.log("Initializing payment sheet with client secret")

      // Initialize the payment sheet with more options
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: "Madadgar",
        style: "alwaysLight", // or 'alwaysDark'
        defaultBillingDetails: {
          // Optional: Pre-fill billing details
          // name: 'Jane Doe',
        },
        allowsDelayedPaymentMethods: true,
        returnURL: "madadgar://payment", // Add a return URL
      })

      if (initError) {
        console.error("Error initializing payment sheet:", initError)
        throw new Error(initError.message)
      }

      console.log("Presenting payment sheet")

      // Present the payment sheet
      const { error: paymentError } = await presentPaymentSheet()

      if (paymentError) {
        console.log("Payment sheet error:", paymentError)

        if (paymentError.code === "Canceled") {
          // User canceled the payment - not an error
          return
        }

        throw new Error(paymentError.message)
      }

      // Payment successful!
      console.log("Payment successful!")
      Alert.alert(
        "Payment Successful",
        "Your payment has been processed successfully. The milestone will be updated shortly.",
      )

      if (onPaymentComplete && typeof onPaymentComplete === "function") {
        onPaymentComplete()
      }

      // Update milestone with Stripe details
      await updateMilestoneWithStripeDetails(milestone.id, clientSecret)
    } catch (error) {
      console.error("Error initiating Stripe payment:", error)
      Alert.alert("Payment Error", error.message || "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  const updateMilestoneWithStripeDetails = async (milestoneId, paymentIntentId) => {
    try {
      if (!milestoneId || !paymentIntentId || !chatId) {
        console.error("Missing required data for updating milestone", { milestoneId, paymentIntentId, chatId })
        return
      }

      const { error } = await supabase
        .from("milestones")
        .update({
          status: "payment_released",
          payment_method: "stripe",
          stripe_payment_id: paymentIntentId,
          payment_released_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", milestoneId)

      if (error) {
        console.error("Error updating milestone:", error)
        throw error
      }

      // Add system message about Stripe payment - now with sender_id
      const { error: messageError } = await supabase.from("messages").insert({
        chat_id: chatId,
        content: `Payment for milestone "${milestone?.title || "Unknown"}" was processed via Stripe`,
        is_system: true,
        created_at: new Date().toISOString(),
        sender_id: userId || "00000000-0000-0000-0000-000000000000", // Use the current user's ID or a fallback
      })

      if (messageError) {
        console.error("Error adding system message:", messageError)
      }
    } catch (error) {
      console.error("Error updating milestone with Stripe details:", error)
    }
  }

  // Ensure milestone is defined before accessing its properties
  if (!milestone) {
    return null
  }

  // Rest of your component remains the same
  const amountInPKR = Number(milestone?.amount || 0)
  const estimatedUSD = amountInPKR * 0.0036
  const isTooLowForStripe = estimatedUSD < 0.5

  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center py-3 rounded-full w-full mb-2 ${
        isTooLowForStripe ? "bg-gray-400" : "bg-[#0D9F70]"
      }`}
      onPress={handleStripePayment}
      disabled={loading || isTooLowForStripe}
      style={{
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1.5,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          <CreditCard size={18} color="#fff" />
          <Text className="ml-2 text-white font-pmedium">
            {isTooLowForStripe ? "Amount Too Low for Online Payment" : "Pay Online"}
          </Text>
        </>
      )}
    </TouchableOpacity>
  )
}
