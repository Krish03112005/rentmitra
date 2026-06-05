import FilterModal from "@/components/FilterModal";
import PropertyCard from "@/components/PropertyCard";
import { useSavedProperties } from "@/hooks/useSavedProperties";
import { PUBLIC_PROPERTY_SELECT } from "@/lib/propertySelect";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";
import { useFilterStore } from "@/store/filterStore";
import { Property } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SEARCH_DEBOUNCE_MS = 350;
const SEARCH_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 80;

const getPageRange = (page: number, pageSize: number) => {
  const from = page * pageSize;
  return { from, to: from + pageSize - 1 };
};

const normalizeSearchTerm = (value: string) =>
  value
    .trim()
    .replace(/[%_,()*'"\\]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, MAX_SEARCH_LENGTH);

export default function Search() {
  const requestIdRef = useRef(0);

  const [results, setResults] = useState<Property[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const resultIds = useMemo(
    () => results.map((property) => property.id),
    [results],
  );
  const savedProperties = useSavedProperties(resultIds);

  const { openFilters } = useLocalSearchParams<{ openFilters?: string }>();

  useEffect(() => {
    if (openFilters === "true") {
      setShowFilters(true);
    }
  }, [openFilters]);

  const {
    search,
    type,
    bedrooms,
    minPrice,
    maxPrice,
    setSearch,
    setType,
    setBedrooms,
    setMinPrice,
    setMaxPrice,
  } = useFilterStore();

  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [search]);

  const activeFilterCount = [
    type !== null,
    bedrooms !== null,
    minPrice !== null,
    maxPrice !== null,
  ].filter(Boolean).length;

  const fetchResults = useCallback(
    async (nextPage: number, reset: boolean) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (reset) {
        setLoading(true);
        setError(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const { from, to } = getPageRange(nextPage, SEARCH_PAGE_SIZE);
      const normalizedSearch = normalizeSearchTerm(debouncedSearch);

      let query = supabase
        .from("public_properties")
        .select(PUBLIC_PROPERTY_SELECT);

      if (normalizedSearch) {
        query = query.or(
          `title.ilike.%${normalizedSearch}%,city.ilike.%${normalizedSearch}%`,
        );
      }

      if (type) {
        query = query.eq("type", type);
      }

      if (bedrooms !== null) {
        query = query.eq("bedrooms", bedrooms);
      }

      if (minPrice !== null) {
        query = query.gte("price", minPrice);
      }

      if (maxPrice !== null) {
        query = query.lte("price", maxPrice);
      }

      const { data, error: searchError } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (requestId !== requestIdRef.current) {
        if (!reset) setLoadingMore(false);
        return;
      }

      if (searchError) {
        console.error("Error fetching search results:", searchError);
        setError("Failed to load search results");
        if (reset) setResults([]);
      } else {
        const nextResults = (data as unknown as Property[] | null) ?? [];
        setResults((prev) =>
          reset ? nextResults : [...prev, ...nextResults],
        );
        setPage(nextPage);
        setHasMore(nextResults.length === SEARCH_PAGE_SIZE);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [bedrooms, debouncedSearch, maxPrice, minPrice, type],
  );

  useEffect(() => {
    void fetchResults(0, true);
  }, [fetchResults]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    void fetchResults(page + 1, false);
  }, [fetchResults, hasMore, loading, loadingMore, page]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-gray-900 mb-4">
          Find Property
        </Text>

        <View className="flex-row items-center gap-3">
          <View
            className="flex-1 flex-row items-center bg-white rounded-2xl px-4 gap-3"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              className="flex-1 py-3 text-gray-800"
              placeholder="Search by title or city..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              maxLength={MAX_SEARCH_LENGTH}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            className={`w-12 h-12 rounded-2xl items-center justify-center ${
              activeFilterCount > 0 ? "bg-blue-500" : "bg-white"
            }`}
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={activeFilterCount > 0 ? "#fff" : "#374151"}
            />
            {activeFilterCount > 0 && (
              <View className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center">
                <Text className="text-white text-[10px] font-bold">
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {activeFilterCount > 0 && (
          <View className="flex-row flex-wrap gap-2 mt-3">
            {type && (
              <View className="flex-row items-center bg-blue-50 border border-blue-200 rounded-full px-3 py-1 gap-1">
                <Text className="text-blue-700 text-xs font-semibold capitalize">
                  {type}
                </Text>
                <TouchableOpacity onPress={() => setType(null)}>
                  <Ionicons name="close" size={12} color="#1D4ED8" />
                </TouchableOpacity>
              </View>
            )}

            {bedrooms !== null && (
              <View className="flex-row items-center bg-blue-50 border border-blue-200 rounded-full px-3 py-1 gap-1">
                <Ionicons name="bed-outline" size={11} color="#1D4ED8" />
                <Text className="text-blue-700 text-xs font-semibold capitalize">
                  {bedrooms === 4
                    ? "4+ beds"
                    : `${bedrooms} bed${bedrooms > 1 ? "s" : ""}`}
                </Text>
                <TouchableOpacity onPress={() => setBedrooms(null)}>
                  <Ionicons name="close" size={12} color="#1D4ED8" />
                </TouchableOpacity>
              </View>
            )}

            {(minPrice !== null || maxPrice !== null) && (
              <View className="flex-row items-center bg-blue-50 border border-blue-200 rounded-full px-3 py-1 gap-1">
                <Text className="text-blue-700 text-xs font-semibold capitalize">
                  {minPrice && maxPrice
                    ? `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`
                    : minPrice
                      ? `From ${formatPrice(minPrice)}`
                      : `Up to ${formatPrice(maxPrice!)}`}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setMinPrice(null);
                    setMaxPrice(null);
                  }}
                >
                  <Ionicons name="close" size={12} color="#1D4ED8" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <PropertyCard
            property={item}
            isSaved={savedProperties.isSaved(item.id)}
            saveLoading={savedProperties.isPending(item.id)}
            onToggleSave={() => savedProperties.toggleSaved(item.id)}
          />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        ListHeaderComponent={
          <View>
            <Text className="text-sm text-gray-400 mb-4">
              {loading
                ? "Searching..."
                : `${results.length}${hasMore ? "+" : ""} properties found`}
            </Text>
            {error ? (
              <View className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <Text className="text-sm font-medium text-red-600">
                  {error}
                </Text>
              </View>
            ) : null}
            {savedProperties.error ? (
              <View className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <Text className="text-sm font-medium text-red-600">
                  {savedProperties.error}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color="#2563EB" className="py-5" />
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View className="items-center py-20">
              <Ionicons name="search-outline" size={48} color="#D1D5DB" />
              <Text className="text-gray-400 mt-4 text-base">
                No properties found
              </Text>
              <Text className="text-gray-300 text-sm mt-1">
                Try a different search or adjust filters
              </Text>
            </View>
          ) : (
            <ActivityIndicator size="large" color="#2563EB" className="py-20" />
          )
        }
      />

      <FilterModal visible={showFilters} onClose={() => setShowFilters(false)} />
    </SafeAreaView>
  );
}
