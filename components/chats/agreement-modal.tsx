"use client"

import React, { useState, useEffect } from "react"
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Animated } from "react-native"
import { X, Calendar, Banknote, DollarSign, CreditCard, CheckCircle, Clock } from "lucide-react-native"
import { supabase } from "@/lib/supabase"
import DateTimePicker from "@react-native-community/datetimepicker"
import { format } from "date-fns"

type AgreementModalProps = {
  isVisible: boolean
  onClose: () => void
  chatId: string
  jobId: string
  proposalId: string
  userId: string
  proposal: any
  chat: any
  isJobOwner: boolean
  onAgreementSubmitted: () => void
}

export const AgreementModal = ({
  isVisible,
  onClose,
  chatId,
  jobId,
  proposalId,
  userId,
  proposal,
  chat,
  isJobOwner,
  onAgreementSubmitted,
}: AgreementModalProps) => {
  const [agreementDetails, setAgreementDetails] = useState({
    startDate: new Date(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 14)), // Default to 2 weeks from now
    paymentAmount: proposal?.rate?.toString() || "",
    paymentMethod: "easypaisa",
    additionalNotes: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [agreementStatus, setAgreementStatus] = useState<"pending" | "proposed" | "accepted">("pending")
  const [existingAgreement, setExistingAgreement] = useState<any>(null)

  // Add these to your form state
  const [paymentStructure, setPaymentStructure] = useState('full')
  const [isHourly, setIsHourly] = useState(
    proposal?.payment_type === 'hourly' || false
  )

  // Add this with your other state variables
  const [totalHours, setTotalHours] = useState('')

  // For date picker
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)

  // Animation state
  const [animation] = useState(new Animated.Value(0))

  useEffect(() => {
    if (isVisible) {
      fetchExistingAgreement()
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

  const fetchExistingAgreement = async () => {
    try {
      const { data, error } = await supabase
        .from("proposal_agreements")
        .select("*")
        .eq("proposal_id", proposalId)
        .eq("job_id", jobId)
        .eq("chat_id", chatId)
        .single()

      if (error) {
        if (error.code !== "PGRST116") {
          // PGRST116 is "no rows returned" - not an error for us
          console.error("Error fetching agreement:", error)
        }
        return
      }

      if (data) {
        setExistingAgreement(data)

        // Parse dates from the database
        const startDate = data.start_date ? new Date(data.start_date) : new Date()
        const endDate = data.end_date
          ? new Date(data.end_date)
          : new Date(new Date().setDate(new Date().getDate() + 14))

        setAgreementDetails({
          startDate,
          endDate,
          paymentAmount: data.payment_amount.toString(),
          paymentMethod: data.payment_method,
          additionalNotes: data.additional_notes || "",
        })

        // Determine status
        if (proposal?.status === "accepted") {
          setAgreementStatus("accepted")
        } else if (data.created_by === userId) {
          setAgreementStatus("proposed")
        } else {
          setAgreementStatus("proposed")
        }
      }
    } catch (error) {
      console.error("Error in fetchExistingAgreement:", error)
    }
  }

  const submitAgreement = async () => {
    try {
      if (!agreementDetails.paymentAmount) {
        Alert.alert("Missing Information", "Please fill in the payment amount.")
        return
      }

      setIsSubmitting(true)

      // Check if we're updating an existing agreement or creating a new one
      const isUpdate = existingAgreement && existingAgreement.id

      let agreementData

      if (isUpdate) {
        // Update existing agreement
        const { data, error } = await supabase
          .from("proposal_agreements")
          .update({
            timeline: `From ${format(agreementDetails.startDate, "MMM d, yyyy")} to ${format(agreementDetails.endDate, "MMM d, yyyy")}`,
            start_date: agreementDetails.startDate.toISOString(),
            end_date: agreementDetails.endDate.toISOString(),
            payment_amount: Number.parseFloat(agreementDetails.paymentAmount),
            payment_method: agreementDetails.paymentMethod,
            additional_notes: agreementDetails.additionalNotes,
            updated_at: new Date(),
          })
          .eq("id", existingAgreement.id)
          .select()

        if (error) throw error
        agreementData = data[0]

        // Send a system message about the updated agreement
        const { error: messageError } = await supabase.from("messages").insert({
          chat_id: chatId,
          sender_id: userId,
          content: `${isJobOwner ? "Job poster" : "Freelancer"} has updated their agreement proposal: Timeline: ${format(
            agreementDetails.startDate,
            "MMM d, yyyy",
          )} to ${format(
            agreementDetails.endDate,
            "MMM d, yyyy",
          )}, Payment: ${proposal.currency} ${agreementDetails.paymentAmount} via ${
            agreementDetails.paymentMethod
          }. ${isJobOwner ? "Waiting for freelancer" : "Waiting for job poster"} to confirm.`,
          created_at: new Date(),
          read: false,
          is_system: true,
        })

        if (messageError) throw messageError

        Alert.alert(
          "Agreement Updated",
          `Your agreement has been updated. Waiting for the ${isJobOwner ? "freelancer" : "job poster"} to confirm.`,
          [{ text: "OK" }],
        )
      } else {
        // Create a new agreement record
        const agreementData = {
          proposal_id: proposalId,
          job_id: jobId,
          chat_id: chatId,
          created_by: userId,
          payment_amount: isHourly 
            ? parseFloat(totalHours) * parseFloat(agreementDetails.paymentAmount) || 0 
            : parseFloat(agreementDetails.paymentAmount) || 0,
          payment_method: agreementDetails.paymentMethod,
          additional_notes: agreementDetails.additionalNotes,
          start_date: agreementDetails.startDate.toISOString(),
          end_date: agreementDetails.endDate.toISOString(),
          payment_structure: paymentStructure,
          is_hourly: isHourly,
          hourly_rate: isHourly ? parseFloat(agreementDetails.paymentAmount) || 0 : null,
          total_hours: isHourly ? parseFloat(totalHours) || 0 : null
        }

        const { data, error } = await supabase
          .from("proposal_agreements")
          .insert(agreementData)
          .select()

        if (error) throw error

        // Send a system message about the proposed agreement
        const { error: messageError } = await supabase.from("messages").insert({
          chat_id: chatId,
          sender_id: userId,
          content: `${isJobOwner ? "Job poster" : "Freelancer"} has proposed an agreement: Timeline: ${format(
            agreementDetails.startDate,
            "MMM d, yyyy",
          )} to ${format(
            agreementDetails.endDate,
            "MMM d, yyyy",
          )}, Payment: ${proposal?.currency || '$'} ${agreementDetails.paymentAmount} via ${
            agreementDetails.paymentMethod
          }. ${isJobOwner ? "Waiting for freelancer" : "Waiting for job poster"} to confirm.`,
          created_at: new Date(),
          read: false,
          is_system: true,
        })

        if (messageError) throw messageError

        Alert.alert(
          "Agreement Proposed",
          `Your agreement has been proposed. Waiting for ${chat?.user?.name || "the user"} to confirm.`,
          [{ text: "OK" }],
        )
      }

      setAgreementStatus("proposed")
      setExistingAgreement(agreementData)
      onAgreementSubmitted()
    } catch (error) {
      console.error("Error submitting agreement:", error)
      Alert.alert("Error", "Failed to submit agreement. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmAgreement = async () => {
    try {
      setIsSubmitting(true)

      // Update proposal status to accepted
      const proposalTable = chat.job_type === "online" ? "proposals" : "offline_proposals"
      const { error: updateProposalError } = await supabase
        .from(proposalTable)
        .update({ status: "accepted" })
        .eq("id", proposalId)

      if (updateProposalError) throw updateProposalError

      // Update job status to in_progress
      const jobTable = chat.job_type === "online" ? "jobs" : "offline_jobs"
      const { error: updateJobError } = await supabase.from(jobTable).update({ status: "in_progress" }).eq("id", jobId)

      if (updateJobError) throw updateJobError

      // Send a system message about the confirmed agreement
      const { error: messageError } = await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: userId,
        content: `Agreement confirmed! The job is now in progress. Timeline: ${format(
          new Date(existingAgreement.start_date),
          "MMM d, yyyy",
        )} to ${format(
          new Date(existingAgreement.end_date),
          "MMM d, yyyy",
        )}, Payment: ${proposal.currency} ${existingAgreement.payment_amount} via ${
          existingAgreement.payment_method
        }. Both parties have agreed to the terms.`,
        created_at: new Date(),
        read: false,
        is_system: true,
      })

      if (messageError) throw messageError

      setAgreementStatus("accepted")
      onAgreementSubmitted()

      // Show success message
      Alert.alert("Agreement Confirmed", "Both parties have agreed to the terms. The job is now in progress!", [
        { text: "OK", onPress: onClose },
      ])
    } catch (error) {
      console.error("Error confirming agreement:", error)
      Alert.alert("Error", "Failed to confirm agreement. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditAgreement = () => {
    // Set the agreement status back to pending so the user can edit it
    setAgreementStatus("pending")

    // Pre-fill the form with existing agreement details
    if (existingAgreement) {
      const startDate = existingAgreement.start_date ? new Date(existingAgreement.start_date) : new Date()
      const endDate = existingAgreement.end_date ? new Date(existingAgreement.end_date) : new Date()

      setAgreementDetails({
        startDate,
        endDate,
        paymentAmount: existingAgreement.payment_amount.toString(),
        paymentMethod: existingAgreement.payment_method,
        additionalNotes: existingAgreement.additional_notes || "",
      })
    }
  }

  const handleDeleteAgreement = async () => {
    try {
      // Confirm deletion
      Alert.alert("Delete Agreement", "Are you sure you want to delete this agreement proposal?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsSubmitting(true)

            // Delete the agreement from the database
            const { error } = await supabase.from("proposal_agreements").delete().eq("id", existingAgreement.id)

            if (error) throw error

            // Send a system message about the deleted agreement
            await supabase.from("messages").insert({
              chat_id: chatId,
              sender_id: userId,
              content: `${isJobOwner ? "Job poster" : "Freelancer"} has deleted their agreement proposal.`,
              created_at: new Date(),
              read: false,
              is_system: true,
            })

            // Reset state
            setExistingAgreement(null)
            setAgreementStatus("pending")
            onAgreementSubmitted()

            // Show success message
            Alert.alert("Agreement Deleted", "Your agreement proposal has been deleted.", [
              { text: "OK", onPress: onClose },
            ])
          },
        },
      ])
    } catch (error) {
      console.error("Error deleting agreement:", error)
      Alert.alert("Error", "Failed to delete agreement. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const onChangeStartDate = (event, selectedDate) => {
    setShowStartDatePicker(false)
    if (selectedDate) {
      setAgreementDetails((prev) => ({ ...prev, startDate: selectedDate }))

      // If start date is after end date, update end date
      if (selectedDate > agreementDetails.endDate) {
        const newEndDate = new Date(selectedDate)
        newEndDate.setDate(selectedDate.getDate() + 14) // Default to 2 weeks after start
        setAgreementDetails((prev) => ({ ...prev, endDate: newEndDate }))
      }
    }
  }

  const onChangeEndDate = (event, selectedDate) => {
    setShowEndDatePicker(false)
    if (selectedDate) {
      setAgreementDetails((prev) => ({ ...prev, endDate: selectedDate }))
    }
  }

  const renderDatePicker = (dateType: "start" | "end") => {
    const isStartDate = dateType === "start"
    const showPicker = isStartDate ? showStartDatePicker : showEndDatePicker
    const date = isStartDate ? agreementDetails.startDate : agreementDetails.endDate

    if (!showPicker) return null

    return (
      <DateTimePicker
        value={date}
        mode="date"
        display="default"
        onChange={isStartDate ? onChangeStartDate : onChangeEndDate}
        minimumDate={isStartDate ? new Date() : agreementDetails.startDate}
      />
    )
  }

  const renderPendingView = () => (
    <ScrollView className="flex-1">
      <View className="px-6">
        <View className="mb-5">
          <Text className="text-gray-700 font-pmedium mb-2">Timeline</Text>

          {/* Start Date */}
          <Text className="text-gray-600 text-sm mb-1">Start Date</Text>
          <TouchableOpacity
            className="flex-row items-center bg-gray-100 rounded-xl p-3 mb-3"
            onPress={() => setShowStartDatePicker(true)}
          >
            <Calendar size={20} color="#6B7280" className="mr-2" />
            <Text className="flex-1 text-gray-800">{format(agreementDetails.startDate, "MMMM d, yyyy")}</Text>
          </TouchableOpacity>

          {/* End Date */}
          <Text className="text-gray-600 text-sm mb-1">End Date</Text>
          <TouchableOpacity
            className="flex-row items-center bg-gray-100 rounded-xl p-3 mb-1"
            onPress={() => setShowEndDatePicker(true)}
          >
            <Calendar size={20} color="#6B7280" className="mr-2" />
            <Text className="flex-1 text-gray-800">{format(agreementDetails.endDate, "MMMM d, yyyy")}</Text>
          </TouchableOpacity>

          <Text className="text-xs text-gray-500">
            Duration:{" "}
            {Math.ceil(
              (agreementDetails.endDate.getTime() - agreementDetails.startDate.getTime()) / (1000 * 60 * 60 * 24),
            )}{" "}
            days
          </Text>

          {renderDatePicker("start")}
          {renderDatePicker("end")}
        </View>

        <View className="mb-4">
          <Text className="text-gray-700 font-pmedium mb-2">Payment Type</Text>
          <View className="flex-row">
            <TouchableOpacity 
              onPress={() => setIsHourly(false)}
              className={`flex-1 p-3 border rounded-l-lg ${!isHourly ? 'bg-[#0D9F70] border-[#0D9F70]' : 'bg-white border-gray-300'}`}
            >
              <Text className={`text-center font-pmedium ${!isHourly ? 'text-white' : 'text-gray-700'}`}>
                Fixed Price
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setIsHourly(true)}
              className={`flex-1 p-3 border rounded-r-lg ${isHourly ? 'bg-[#0D9F70] border-[#0D9F70]' : 'bg-white border-gray-300'}`}
            >
              <Text className={`text-center font-pmedium ${isHourly ? 'text-white' : 'text-gray-700'}`}>
                Hourly Rate
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isHourly ? (
          <>
            <View className="mb-4">
              <Text className="text-gray-700 font-pmedium mb-1">Hourly Rate</Text>
              <View className="flex-row items-center">
                <Text className="text-gray-700 text-lg mr-2">
                  {proposal?.currency || '$'}
                </Text>
                <TextInput
                  className="flex-1 p-3 rounded-lg bg-gray-100 text-gray-800"
                  keyboardType="numeric"
                  value={agreementDetails.paymentAmount}
                  onChangeText={(text) => setAgreementDetails((prev) => ({ ...prev, paymentAmount: text }))}
                  placeholder="Enter hourly rate"
                />
              </View>
            </View>
            <View className="mb-4">
              <Text className="text-gray-700 font-pmedium mb-1">Estimated Total Hours</Text>
              <TextInput
                className="p-3 rounded-lg bg-gray-100 text-gray-800"
                keyboardType="numeric"
                value={totalHours}
                onChangeText={setTotalHours}
                placeholder="Enter estimated hours"
              />
              
              {/* Show calculation preview */}
              {totalHours && agreementDetails.paymentAmount ? (
                <Text className="text-xs text-gray-500 mt-1">
                  Total estimated: {proposal?.currency || '$'}{(parseFloat(totalHours) * parseFloat(agreementDetails.paymentAmount)).toFixed(2)}
                  ({totalHours} hours × {proposal?.currency || '$'}{parseFloat(agreementDetails.paymentAmount).toFixed(2)}/hour)
                </Text>
              ) : null}
            </View>
          </>
        ) : (
          <View className="mb-4">
            <Text className="text-gray-700 font-pmedium mb-1">Fixed Price Amount</Text>
            <View className="flex-row items-center">
              <Text className="text-gray-700 text-lg mr-2">
                {proposal?.currency || '$'}
              </Text>
              <TextInput
                className="flex-1 p-3 rounded-lg bg-gray-100 text-gray-800"
                keyboardType="numeric"
                value={agreementDetails.paymentAmount}
                onChangeText={(text) => setAgreementDetails((prev) => ({ ...prev, paymentAmount: text }))}
                placeholder="Enter total amount"
              />
            </View>
          </View>
        )}

        <View className="mb-4">
          <Text className="text-gray-700 font-pmedium mb-2">Payment Structure</Text>
          <View className="flex-row">
            <TouchableOpacity 
              onPress={() => setPaymentStructure('full')}
              className={`flex-1 p-3 border rounded-l-lg ${paymentStructure === 'full' ? 'bg-[#0D9F70] border-[#0D9F70]' : 'bg-white border-gray-300'}`}
            >
              <Text className={`text-center font-pmedium ${paymentStructure === 'full' ? 'text-white' : 'text-gray-700'}`}>
                Full Payment
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setPaymentStructure('milestone')}
              className={`flex-1 p-3 border rounded-r-lg ${paymentStructure === 'milestone' ? 'bg-[#0D9F70] border-[#0D9F70]' : 'bg-white border-gray-300'}`}
            >
              <Text className={`text-center font-pmedium ${paymentStructure === 'milestone' ? 'text-white' : 'text-gray-700'}`}>
                Milestone Based
              </Text>
            </TouchableOpacity>
          </View>
          {paymentStructure === 'milestone' && (
            <Text className="text-gray-500 text-sm mt-2">
              You'll be able to create milestones after the agreement is signed.
            </Text>
          )}
        </View>

        <View className="mb-5">
          <Text className="text-gray-700 font-pmedium mb-2">Payment Method</Text>
          <View className="bg-gray-100 rounded-xl overflow-hidden mb-1">
            <TouchableOpacity
              className={`flex-row items-center p-3 ${
                agreementDetails.paymentMethod === "easypaisa" ? "bg-[#E7F7F1]" : ""
              }`}
              onPress={() => setAgreementDetails((prev) => ({ ...prev, paymentMethod: "easypaisa" }))}
            >
              <CreditCard
                size={20}
                color={agreementDetails.paymentMethod === "easypaisa" ? "#0D9F70" : "#6B7280"}
                className="mr-2"
              />
              <Text
                className={`${
                  agreementDetails.paymentMethod === "easypaisa" ? "text-[#0D9F70] font-pmedium" : "text-gray-800"
                }`}
              >
                Easypaisa
              </Text>
              {agreementDetails.paymentMethod === "easypaisa" && (
                <CheckCircle size={18} color="#0D9F70" className="ml-auto" />
              )}
            </TouchableOpacity>

            <View className="h-[1px] bg-gray-200" />

            <TouchableOpacity
              className={`flex-row items-center p-3 ${
                agreementDetails.paymentMethod === "online_transfer" ? "bg-[#E7F7F1]" : ""
              }`}
              onPress={() => setAgreementDetails((prev) => ({ ...prev, paymentMethod: "online_transfer" }))}
            >
              <CreditCard
                size={20}
                color={agreementDetails.paymentMethod === "online_transfer" ? "#0D9F70" : "#6B7280"}
                className="mr-2"
              />
              <Text
                className={`${
                  agreementDetails.paymentMethod === "online_transfer" ? "text-[#0D9F70] font-pmedium" : "text-gray-800"
                }`}
              >
                Online Transfer
              </Text>
              {agreementDetails.paymentMethod === "online_transfer" && (
                <CheckCircle size={18} color="#0D9F70" className="ml-auto" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View className="mb-5">
          <Text className="text-gray-700 font-pmedium mb-2">Additional Notes</Text>
          <View className="bg-gray-100 rounded-xl p-3 mb-1">
            <TextInput
              className="text-gray-800 min-h-[100px]"
              placeholder="Any additional details or terms agreed upon..."
              multiline
              textAlignVertical="top"
              value={agreementDetails.additionalNotes}
              onChangeText={(text) => setAgreementDetails((prev) => ({ ...prev, additionalNotes: text }))}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  )

  const renderProposedView = () => {
    const isCreator = existingAgreement?.created_by === userId

    // Parse dates from the existing agreement
    const startDate = existingAgreement?.start_date ? new Date(existingAgreement.start_date) : new Date()
    const endDate = existingAgreement?.end_date ? new Date(existingAgreement.end_date) : new Date()

    // Calculate duration in days
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    return (
      <ScrollView className="flex-1">
        <View className="px-6">
          <View className="bg-[#E7F7F1] p-4 rounded-xl mb-5">
            <View className="flex-row items-center mb-3">
              <Clock size={20} color="#0D9F70" className="mr-2" />
              <Text className="text-[#0D9F70] font-pbold">
                {isCreator ? `Waiting for ${isJobOwner ? "freelancer" : "job poster"} to confirm` : "Agreement Proposed"}
              </Text>
            </View>
            <Text className="text-gray-700 mb-2">
              {isCreator
                ? `You've proposed the following agreement. Waiting for the ${
                    isJobOwner ? "freelancer" : "job poster"
                  } to confirm.`
                : `The ${
                    isJobOwner ? "freelancer" : "job poster"
                  } has proposed the following agreement. Please review and confirm if you agree.`}
            </Text>
          </View>

          <View className="bg-gray-50 p-4 rounded-xl mb-4">
            <Text className="text-[#0D9F70] font-pbold mb-3">Agreement Details</Text>

            <View className="mb-3">
              <Text className="text-gray-500 text-sm">Timeline</Text>
              <View className="flex-row justify-between mt-1">
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Start Date</Text>
                  <Text className="text-gray-800 font-pmedium">{format(startDate, "MMMM d, yyyy")}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">End Date</Text>
                  <Text className="text-gray-800 font-pmedium">{format(endDate, "MMMM d, yyyy")}</Text>
                </View>
              </View>
              <Text className="text-gray-500 text-xs mt-1">Duration: {durationDays} days</Text>
            </View>

            <View className="mb-3">
              <Text className="text-gray-500 text-sm">Payment Amount</Text>
              <Text className="text-gray-800 font-pmedium">
                {proposal?.currency} {existingAgreement?.payment_amount}
              </Text>
            </View>

            <View className="mb-3">
              <Text className="text-gray-500 text-sm">Payment Method</Text>
              <Text className="text-gray-800 font-pmedium">
                {existingAgreement?.payment_method === "easypaisa" ? "Easypaisa" : "Online Transfer"}
              </Text>
            </View>

            {existingAgreement?.additional_notes && (
              <View>
                <Text className="text-gray-500 text-sm">Additional Notes</Text>
                <Text className="text-gray-800">{existingAgreement.additional_notes}</Text>
              </View>
            )}
          </View>

          {!isCreator && (
            <TouchableOpacity
              className="bg-[#0D9F70] py-3 rounded-xl mt-3"
              onPress={confirmAgreement}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-pbold text-center">Confirm Agreement</Text>
              )}
            </TouchableOpacity>
          )}

          {isCreator && (
            <View className="flex-row space-x-3 mt-3">
              <TouchableOpacity className="flex-1 bg-gray-200 py-3 rounded-xl" onPress={onClose}>
                <Text className="text-gray-700 font-pbold text-center">Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-[#F59E0B] py-3 rounded-xl"
                onPress={handleEditAgreement}
                disabled={isSubmitting}
              >
                <Text className="text-white font-pbold text-center">Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-red-500 py-3 rounded-xl"
                onPress={handleDeleteAgreement}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-pbold text-center">Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    )
  }

  const renderAcceptedView = () => {
    // Parse dates from the existing agreement
    const startDate = existingAgreement?.start_date ? new Date(existingAgreement.start_date) : new Date()
    const endDate = existingAgreement?.end_date ? new Date(existingAgreement.end_date) : new Date()

    // Calculate duration in days
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    return (
      <ScrollView className="flex-1">
        <View className="px-6">
          <View className="bg-green-100 p-4 rounded-xl mb-5">
            <View className="flex-row items-center mb-3">
              <CheckCircle size={20} color="#16A34A" className="mr-2" />
              <Text className="text-green-700 font-pbold">Agreement Confirmed</Text>
            </View>
            <Text className="text-gray-700 mb-2">Both parties have agreed to the terms. The job is now in progress!</Text>
          </View>

          <View className="bg-gray-50 p-4 rounded-xl mb-4">
            <Text className="text-[#0D9F70] font-pbold mb-3">Agreement Details</Text>

            <View className="mb-3">
              <Text className="text-gray-500 text-sm">Timeline</Text>
              <View className="flex-row justify-between mt-1">
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Start Date</Text>
                  <Text className="text-gray-800 font-pmedium">{format(startDate, "MMMM d, yyyy")}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">End Date</Text>
                  <Text className="text-gray-800 font-pmedium">{format(endDate, "MMMM d, yyyy")}</Text>
                </View>
              </View>
              <Text className="text-gray-500 text-xs mt-1">Duration: {durationDays} days</Text>
            </View>

            <View className="mb-3">
              <Text className="text-gray-500 text-sm">Payment Details</Text>
              {existingAgreement?.is_hourly ? (
                <>
                  <Text className="text-gray-800 font-pmedium">
                    {proposal?.currency} {existingAgreement?.hourly_rate} per hour
                  </Text>
                  <Text className="text-gray-500 text-xs">
                    Estimated {existingAgreement?.total_hours} hours
                    ({proposal?.currency} {(parseFloat(existingAgreement?.hourly_rate || 0) * parseFloat(existingAgreement?.total_hours || 0)).toFixed(2)} total)
                  </Text>
                </>
              ) : (
                <Text className="text-gray-800 font-pmedium">
                  {proposal?.currency} {existingAgreement?.payment_amount} fixed price
                </Text>
              )}
              {existingAgreement?.payment_structure === 'milestone' && (
                <Text className="text-gray-500 text-xs">Payment structure: Milestone-based</Text>
              )}
            </View>

            <View className="mb-3">
              <Text className="text-gray-500 text-sm">Payment Method</Text>
              <Text className="text-gray-800 font-pmedium">
                {existingAgreement?.payment_method === "easypaisa" ? "Easypaisa" : "Online Transfer"}
              </Text>
            </View>

            {existingAgreement?.additional_notes && (
              <View>
                <Text className="text-gray-500 text-sm">Additional Notes</Text>
                <Text className="text-gray-800">{existingAgreement.additional_notes}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity className="bg-gray-200 py-3 rounded-xl mt-3" onPress={onClose}>
            <Text className="text-gray-700 font-pbold text-center">Close</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  return (
    <Modal visible={isVisible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <Animated.View
          style={{
            transform: [{ translateY }],
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: "white",
            height: "80%",
            overflow: "hidden",
          }}
        >
          <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />

          <View className="flex-row justify-between items-center mb-5 px-6">
            <Text className="text-xl font-pbold text-gray-800">
              {agreementStatus === "pending"
                ? "Propose Agreement"
                : agreementStatus === "proposed"
                  ? "Review Agreement"
                  : "Agreement Confirmed"}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="p-2 rounded-full bg-gray-100"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {agreementStatus === "pending" && (
            <>
              {renderPendingView()}
              <View className="px-6 pb-6">
                <TouchableOpacity
                  className="bg-[#0D9F70] py-3 rounded-xl mt-3"
                  onPress={submitAgreement}
                  disabled={isSubmitting || !agreementDetails.paymentAmount}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white font-pbold text-center">Propose Agreement</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
          {agreementStatus === "proposed" && renderProposedView()}
          {agreementStatus === "accepted" && renderAcceptedView()}
        </Animated.View>
      </View>
    </Modal>
  )
}
