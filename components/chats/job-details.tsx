import { useState } from "react"
import { View, Text, Modal, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator } from "react-native"
import { X, MapPin, DollarSign, Clock, Star, Calendar, Wrench, Banknote, Trash2 } from "lucide-react-native"
import { format } from "date-fns"

type JobDetailsProps = {
  isVisible: boolean
  onClose: () => void
  job: {
    id: string
    title: string
    description: string
    images?: string[]
    payment_type: string
    amount: number
    currency: string
    time_required: number
    time_unit: string
    skill_level: string
    location_address?: string
    required_skills?: string[]
    status: string
    category?: { name: string } | null
    created_at: string
  }
  isJobOwner: boolean
  onDeleteJob?: (jobId: string) => Promise<void>
}

export function JobDetails({ isVisible, onClose, job, isJobOwner, onDeleteJob }: JobDetailsProps) {
  if (!job) return null

  const [deleting, setDeleting] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return { bg: "bg-[#0D9F70]", text: "text-white" }
      case "in_progress":
        return { bg: "bg-amber-500", text: "text-white" }
      case "completed":
        return { bg: "bg-green-500", text: "text-white" }
      case "cancelled":
        return { bg: "bg-red-500", text: "text-white" }
      default:
        return { bg: "bg-gray-500", text: "text-white" }
    }
  }

  const getSkillLevelBadge = (level: string) => {
    switch (level) {
      case "amateur":
        return "bg-emerald-100 text-emerald-700"
      case "intermediate":
        return "bg-blue-100 text-blue-700"
      case "professional":
        return "bg-purple-100 text-purple-700"
      default:
        return "bg-gray-100 text-gray-600"
    }
  }

  const getSkillLevelIcon = (level: string) => {
    const starColor = "#0D9F70"
    const starSize = 14

    let count = 1
    if (level === "intermediate") count = 2
    if (level === "professional") count = 3

    return (
      <View className="flex-row items-center ml-1">
        {Array.from({ length: count }).map((_, index) => (
          <Star key={index} size={starSize} color={starColor} />
        ))}
      </View>
    )
  }

  const handleDeleteJob = () => {
    if (!job || !onDeleteJob) return;
    
    Alert.alert(
      "Delete Job",
      "Are you sure you want to delete this job? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await onDeleteJob(job.id);
              onClose();
            } catch (error) {
              Alert.alert("Error", "Failed to delete job. Please try again.");
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  const statusColors = getStatusColor(job.status)

  return (
    <Modal visible={isVisible} animationType="slide" transparent={true}>
      <View className="flex-1 bg-transparent justify-end">
        <View className="bg-white rounded-t-3xl max-h-[50%]">
          <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center my-3" />
          
          <View className="px-6 pb-4 border-b border-gray-100 flex-row justify-between items-center">
            <Text className="text-xl font-pbold text-gray-800">Job Details</Text>
            <TouchableOpacity onPress={onClose} className="p-2 rounded-full bg-gray-100">
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
            <Text className="text-2xl font-pbold text-gray-800 mt-4 mb-2">{job.title}</Text>

            {/* Status badge and category */}
            <View className="flex-row flex-wrap mb-5">
              <View className={`${statusColors.bg} rounded-full px-3 py-1.5 mr-2 mb-2`}>
                <Text className={`${statusColors.text} text-sm font-pmedium capitalize`}>
                  {job.status.replace("_", " ")}
                </Text>
              </View>

              {job.category?.name && (
                <View className="bg-[#E7F7F1] px-3 py-1.5 rounded-full mr-2 mb-2">
                  <Text className="text-sm font-pmedium text-[#0D9F70]">{job.category.name}</Text>
                </View>
              )}

              <View className={`px-3 py-1.5 rounded-full mb-2 ${getSkillLevelBadge(job.skill_level)}`}>
                <View className="flex-row items-center">
                  <Text className="text-sm font-pmedium capitalize">{job.skill_level}</Text>
                  {getSkillLevelIcon(job.skill_level)}
                </View>
              </View>
            </View>

            {/* Job images */}
            {job.images && job.images.length > 0 && (
              <View className="mb-6">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-1">
                  {job.images.map((imageUrl, index) => (
                    <Image
                      key={index}
                      source={{ uri: imageUrl }}
                      className="w-32 h-32 rounded-2xl mr-3"
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Job description */}
            <View className="bg-gray-50 p-4 rounded-2xl mb-6">
              <Text className="text-[#0D9F70] mb-2 text-base font-pbold">Description</Text>
              <Text className="text-gray-700 font-pregular leading-6">{job.description}</Text>
            </View>

            {/* Job details section */}
            <View className="bg-gray-50 p-4 rounded-2xl mb-6">
              <Text className="text-[#0D9F70] mb-3 text-base font-pbold">Job Details</Text>

              <View className="flex-row items-center mb-4">
                <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                  <Banknote size={18} color="#0D9F70" />
                </View>
                <View className="ml-3">
                  <Text className="text-gray-500 text-xs font-pregular">Payment</Text>
                  <Text className="text-gray-800 font-pmedium">
                    {job.currency} {job.amount} • {job.payment_type === "hourly" ? "Hourly rate" : "Fixed price"}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center mb-4">
                <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                  <Clock size={18} color="#0D9F70" />
                </View>
                <View className="ml-3">
                  <Text className="text-gray-500 text-xs font-pregular">Time Required</Text>
                  <Text className="text-gray-800 font-pmedium">
                    {job.time_required} {job.time_unit}
                  </Text>
                </View>
              </View>

              {job.location_address && (
                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                    <MapPin size={18} color="#0D9F70" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-gray-500 text-xs font-pregular">Location</Text>
                    <Text className="text-gray-800 font-pmedium">{job.location_address}</Text>
                  </View>
                </View>
              )}

              <View className="flex-row items-center mb-4">
                <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                  <Wrench size={18} color="#0D9F70" />
                </View>
                <View className="ml-3">
                  <Text className="text-gray-500 text-xs font-pregular">Skill Level</Text>
                  <Text className="text-gray-800 font-pmedium capitalize flex-row items-center">
                    {job.skill_level}
                    {getSkillLevelIcon(job.skill_level)}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-[#E7F7F1] items-center justify-center">
                  <Calendar size={18} color="#0D9F70" />
                </View>
                <View className="ml-3">
                  <Text className="text-gray-500 text-xs font-pregular">Posted Date</Text>
                  <Text className="text-gray-800 font-pmedium">
                    {job.created_at && !isNaN(new Date(job.created_at).getTime())
                      ? format(new Date(job.created_at), "MMMM dd, yyyy")
                      : "N/A"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Required Skills - Display name instead of ID */}
            {job.required_skills && job.required_skills.length > 0 && (
              <View className="mb-6">
                <Text className="text-lg font-pbold text-gray-800 mb-2">Skills Required</Text>
                <View className="flex-row flex-wrap">
                  {job.required_skills.map((skill, index) => (
                    <View key={index} className="bg-gray-100 rounded-full px-3 py-1.5 mr-2 mb-2">
                      <Text className="text-gray-700 text-sm">{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Actions */}
            <View className="my-6">
              {isJobOwner ? (
                <TouchableOpacity
                  className="bg-red-500 py-3.5 rounded-xl items-center flex-row justify-center"
                  onPress={handleDeleteJob}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Trash2 size={18} color="#fff" />
                      <Text className="text-white font-pmedium ml-2">Delete Job</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity className="bg-[#0D9F70] py-3.5 rounded-xl items-center" onPress={onClose}>
                  <Text className="text-white font-pmedium">Close</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}