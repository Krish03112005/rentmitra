import { View, Text, Image, TouchableOpacity } from 'react-native'
import React from 'react'
import { Property } from '@/types';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@/lib/utils';


export default function FeaturedCard({ property }: { property: Property }) {
    const router = useRouter();

  return (
    <TouchableOpacity
       className="w-72 mr-2 rounded-2xl overflow-hidden bg-white p-1"
       style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
        elevation: 2,
        opacity: property.is_sold ? 0.5 : 1,
       }}
       onPress={()=>router.push(`/(root)/property/${property.id}`)}
    >
        <Image 
          source = {
            property.images.length > 0
             ? { uri: property.images[0] }
             : require("@/assets/images/rentmitra.png")
          }
          className="w-full h-44 rounded-xl"
          resizeMode="cover"
        />

       <View className="absolute top-3 left-3 bg-white/90 px-3 py-1 rounded-full">
        <Text className="text-xs font-semibold text-blue-600 capitalize">
            {property.type}
        </Text>
       </View>

       {/* Sold-Badge */}
       {property.is_sold && (
        <View className="absolute top-3 right-3 bg-red-500 px-3 py-1 rounded-full">
         <Text className="text-xs font-semibold text-white">
          Sold
         </Text>
        </View>
       )}

       <View className="p-3">
        <Text className="text-gray-800 text-base font-bold mb-1"
          numberOfLines={1}
        >
         {property.title}
        </Text>
        
        <View className="flex-row items-center gap-1 mb-3">
            <Ionicons name="location-outline" size={13} color="#6B7280" />
            <Text className="text-xs text-gray-600" numberOfLines={1}>
           {property.address}, {property.city}
          </Text>
        </View>

       <View className="flex-row items-center justify-between">
          <Text className="text-blue-600 font-bold text-base">
            {formatPrice(property.price)}
          </Text>

          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <Ionicons name="bed-outline" size={14} color="#6B7280" />
               <Text className="text-xs text-gray-500">
                 {property.bedrooms}
               </Text>
            </View>  

          <View className="flex-row items-center gap-1">
            <Ionicons name="water-outline" size={14} color="#6B7280" />
            <Text className="text-xs text-gray-500">
              {property.bathrooms}
            </Text>
          </View>
          </View>
       </View>
        </View>
    </TouchableOpacity>
  )
}





