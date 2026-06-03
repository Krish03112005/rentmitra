import { supabase } from "@/lib/supabase";
import { Property } from "@/types";
import { useUser } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import FeaturedCard from "@/components/FeaturedCard";
import PropertyCard from "@/components/PropertyCard";

export default function HomeScreen() {
  const { user } = useUser();
  const router = useRouter();

  const [featured, setFeatures] = React.useState<Property[]>([]);
  const [recommended, setRecommended] = React.useState<Property[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchProperties = async () => {
    setLoading(true);
    
  const { data: featuredData } = await supabase
    .from("properties")
    .select("*")
    .eq("is_featured", true)
    .order("created_at", { ascending: false });

  const { data: recommendedData } = await supabase
    .from("properties")
    .select("*")
    .eq("is_featured", false)
    .order("created_at", { ascending: false }); 

  setFeatures(featuredData ?? []);
  setRecommended(recommendedData ?? []);
  setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      fetchProperties();
    }, []),
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <FlatList 
        data={recommended}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 pt-4 pb-5">
              <Image 
                source={require("../../../assets/images/rentmitra.png")}
                style={{ width: 150, height: 36 }}
                resizeMode="contain" 
              />

              <View className="items-end">
                <Text>Good Morning! 👋</Text>
                <Text className="text-gray-700 text-base font-bold">{user?.firstName || "User"}</Text>
              </View>
            </View>

            {/* Search Bar */}
            <TouchableOpacity 
              onPress={() => router.push("/(root)/(tabs)/search")}
              className="mx-5 mb-6 flex-row items-center bg-white rounded-2xl px-4 py-3 gap-3 border border-gray-100"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <Ionicons name="search-outline" size={20} color="#888" />
              <Text className="flex-1 text-gray-500" numberOfLines={1}>
                Search properties, cities...
              </Text>
              
              <TouchableOpacity
                onPress={() => {
                  
                  router.push("/(root)/(tabs)/search?openFilters=true");
                }}
                className="w-8 h-8 bg-blue-500 rounded-md items-center justify-center"
              >
                <Ionicons name="options-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>

            </TouchableOpacity>

            {/* featured Properties Section */}
            <View className="mb-6">
                <Text className="text-gray-900 text-lg font-bold px-5 mb-4">
                  Featured
                </Text>

                {loading ? (
                  <ActivityIndicator 
                    size="small"
                    color="#2563EB"
                    className="py-10"
                  />
                ):(
                  <FlatList
                    data={featured}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <FeaturedCard property={item} />}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20 }}
                  />
                )}
            </View>
            
            {/* Header */}
            <Text className="text-gray-900 text-lg font-bold px-5 mb-4">
              Recommended
            </Text>
          </View>
        }

        renderItem={({ item }) => (
          <View className="px-5">
            <PropertyCard property={item} />
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View className="items-center py-10">
              <Text className="text-gray-500">No properties found.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
