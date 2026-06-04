import FeaturedCard from "@/components/FeaturedCard";
import PropertyCard from "@/components/PropertyCard";
import { useSavedProperties } from "@/hooks/useSavedProperties";
import { supabase } from "@/lib/supabase";
import { Property } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FEATURED_LIMIT = 10;
const RECOMMENDED_PAGE_SIZE = 20;

const getPageRange = (page: number, pageSize: number) => {
  const from = page * pageSize;
  return { from, to: from + pageSize - 1 };
};

export default function HomeScreen() {
  const { user } = useUser();
  const router = useRouter();
  const requestIdRef = useRef(0);

  const [featured, setFeatured] = useState<Property[]>([]);
  const [recommended, setRecommended] = useState<Property[]>([]);
  const [recommendedPage, setRecommendedPage] = useState(0);
  const [hasMoreRecommended, setHasMoreRecommended] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recommendedIds = useMemo(
    () => recommended.map((property) => property.id),
    [recommended],
  );
  const savedProperties = useSavedProperties(recommendedIds);

  const fetchProperties = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLoading(true);
    setError(null);
    setHasMoreRecommended(true);

    const { from, to } = getPageRange(0, RECOMMENDED_PAGE_SIZE);

    try {
      const [featuredResult, recommendedResult] = await Promise.all([
        supabase
          .from("properties")
          .select("*")
          .eq("is_featured", true)
          .order("created_at", { ascending: false })
          .limit(FEATURED_LIMIT),
        supabase
          .from("properties")
          .select("*")
          .eq("is_featured", false)
          .order("created_at", { ascending: false })
          .range(from, to),
      ]);

      if (requestId !== requestIdRef.current) return;

      if (featuredResult.error) {
        console.error(
          "Error fetching featured properties:",
          featuredResult.error,
        );
        setError("Failed to load featured properties");
      } else {
        setFeatured(featuredResult.data ?? []);
      }

      if (recommendedResult.error) {
        console.error(
          "Error fetching recommended properties:",
          recommendedResult.error,
        );
        setError("Failed to load recommended properties");
      } else {
        const nextRecommended = recommendedResult.data ?? [];
        setRecommended(nextRecommended);
        setRecommendedPage(0);
        setHasMoreRecommended(nextRecommended.length === RECOMMENDED_PAGE_SIZE);
      }
    } catch (fetchError) {
      if (requestId !== requestIdRef.current) return;
      console.error("Unexpected error fetching properties:", fetchError);
      setError("Failed to load properties");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  const fetchMoreRecommended = useCallback(async () => {
    if (loading || loadingMore || !hasMoreRecommended) return;

    const requestId = requestIdRef.current;
    setLoadingMore(true);

    const nextPage = recommendedPage + 1;
    const { from, to } = getPageRange(nextPage, RECOMMENDED_PAGE_SIZE);

    const { data, error: nextPageError } = await supabase
      .from("properties")
      .select("*")
      .eq("is_featured", false)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (requestId !== requestIdRef.current) {
      setLoadingMore(false);
      return;
    }

    if (nextPageError) {
      console.error("Error fetching more recommended properties:", nextPageError);
      setError("Failed to load more properties");
    } else {
      const nextItems = data ?? [];
      setRecommended((prev) => [...prev, ...nextItems]);
      setRecommendedPage(nextPage);
      setHasMoreRecommended(nextItems.length === RECOMMENDED_PAGE_SIZE);
    }

    setLoadingMore(false);
  }, [hasMoreRecommended, loading, loadingMore, recommendedPage]);

  useFocusEffect(
    useCallback(() => {
      void fetchProperties();
    }, [fetchProperties]),
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="z-10 flex-row items-center justify-between bg-gray-50 px-4 pt-4 pb-5">
        <Image
          source={require("../../../assets/images/livora.png")}
          style={{ width: 100, height: 36 }}
          resizeMode="contain"
        />

        <View className="items-end">
          <Text>Good Morning! 👋</Text>
          <Text className="text-gray-700 text-base font-bold">
            {user?.firstName || "User"}
          </Text>
        </View>
      </View>

      <FlatList
        data={recommended}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        onEndReached={fetchMoreRecommended}
        onEndReachedThreshold={0.35}
        ListHeaderComponent={
          <View>
            <TouchableOpacity
              onPress={() => router.push("/(root)/(tabs)/search")}
              className="mx-5 mb-6 mt-1 flex-row items-center bg-white rounded-2xl px-4 py-3 gap-3 border border-gray-100"
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

            {error ? (
              <View className="mx-5 mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <Text className="text-sm font-medium text-red-600">
                  {error}
                </Text>
              </View>
            ) : null}
            {savedProperties.error ? (
              <View className="mx-5 mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <Text className="text-sm font-medium text-red-600">
                  {savedProperties.error}
                </Text>
              </View>
            ) : null}

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
              ) : (
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

            <Text className="text-gray-900 text-lg font-bold px-5 mb-4">
              Recommended
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="px-5">
            <PropertyCard
              property={item}
              isSaved={savedProperties.isSaved(item.id)}
              saveLoading={savedProperties.isPending(item.id)}
              onToggleSave={() => savedProperties.toggleSaved(item.id)}
            />
          </View>
        )}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color="#2563EB" className="py-5" />
          ) : null
        }
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
