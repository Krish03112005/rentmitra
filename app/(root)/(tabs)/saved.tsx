import PropertyCard from "@/components/PropertyCard";
import { useSavedProperties } from "@/hooks/useSavedProperties";
import { useSupabase } from "@/hooks/useSupabase";
import { Property } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SavedProperty {
  id: string;
  property_id: string;
  properties: Property;
}

export default function Saved() {
  const { isLoaded, userId } = useAuth();
  const authSupabase = useSupabase();

  const [saved, setSaved] = useState<SavedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const savedPropertyIds = useMemo(
    () => saved.map((item) => item.property_id),
    [saved],
  );
  const savedProperties = useSavedProperties(savedPropertyIds);

  const fetchSaved = useCallback(async () => {
    if (!isLoaded) return;

    if (!userId) {
      setSaved([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await authSupabase
      .from("saved_properties")
      .select("id, property_id, properties(*)")
      .eq("user_clerk_id", userId)
      .order("id", { ascending: false });

    if (fetchError) {
      console.error("Failed to fetch saved properties:", fetchError);
      setError("Failed to load saved properties.");
      setSaved([]);
    } else {
      setSaved((data as unknown as SavedProperty[]) ?? []);
    }

    setLoading(false);
  }, [authSupabase, isLoaded, userId]);

  useFocusEffect(
    useCallback(() => {
      void fetchSaved();
    }, [fetchSaved]),
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-4 pb-3">
        <Text className="text-gray-900 font-bold text-2xl">Saved</Text>
        {!loading && (
          <Text className="text-sm text-gray-400 mt-1">
            {saved.length} {saved.length === 1 ? "property" : "properties"}{" "}
            Saved
          </Text>
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <PropertyCard
              property={item.properties}
              isSaved
              saveLoading={savedProperties.isPending(item.property_id)}
              onToggleSave={() =>
                savedProperties.toggleSaved(item.property_id, () =>
                  setSaved((prev) =>
                    prev.filter((savedItem) => savedItem.id !== item.id),
                  ),
                )
              }
            />
          )}
          ListHeaderComponent={
            error || savedProperties.error ? (
              <View className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <Text className="text-sm font-medium text-red-600">
                  {error ?? savedProperties.error}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-24">
              <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-4">
                <Ionicons name="heart-outline" size={36} color="#EF4444" />
              </View>
              <Text className="text-gray-700 text-lg font-bold mb-1">
                No Saved Properties
              </Text>
              <Text className="text-gray-400 text-sm text-center px-8">
                Tap the heart icon on any property to save it here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
