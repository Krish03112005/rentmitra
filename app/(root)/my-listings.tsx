import { useSignedPropertyImage } from "@/hooks/usePropertyImages";
import { useSupabase } from "@/hooks/useSupabase";
import { formatPrice } from "@/lib/utils";
import { Property } from "@/types";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  GestureResponderEvent,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const fallbackImage = require("@/assets/images/livora.png");
const MAX_SEARCH_LENGTH = 80;

const normalizeSearchTerm = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, MAX_SEARCH_LENGTH);

export default function MyListings() {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const authSupabase = useSupabase();

  const [listings, setListings] = useState<Property[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchListings = useCallback(
    async (showRefresh = false) => {
      if (!isLoaded) return;

      if (!userId) {
        setListings([]);
        setLoading(false);
        setRefreshing(false);
        setError(null);
        return;
      }

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const { data, error: fetchError } = await authSupabase
        .from("properties")
        .select("*")
        .eq("owner_clerk_id", userId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Failed to fetch my listings:", fetchError);
        setError("Failed to load your listings.");
        setListings([]);
      } else {
        setListings((data as Property[]) ?? []);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [authSupabase, isLoaded, userId],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchListings();
    }, [fetchListings]),
  );

  const filteredListings = useMemo(() => {
    const term = normalizeSearchTerm(search);
    if (!term) return listings;

    return listings.filter((property) =>
      [
        property.title,
        property.address,
        property.city,
        property.type,
        String(property.price),
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [listings, search]);

  const updateListing = useCallback(
    async (propertyId: string, updates: Partial<Property>) => {
      if (!userId || updatingId) return;

      setUpdatingId(propertyId);
      const { data, error: updateError } = await authSupabase
        .from("properties")
        .update(updates)
        .eq("id", propertyId)
        .eq("owner_clerk_id", userId)
        .select("*")
        .maybeSingle();

      setUpdatingId(null);

      if (updateError || !data) {
        console.error("Failed to update listing:", updateError);
        Alert.alert("Error", "Could not update this listing.");
        return;
      }

      setListings((prev) =>
        prev.map((property) =>
          property.id === propertyId ? (data as Property) : property,
        ),
      );
    },
    [authSupabase, updatingId, userId],
  );

  const confirmSoldToggle = useCallback(
    (property: Property) => {
      const nextSoldState = !property.is_sold;

      Alert.alert(
        nextSoldState ? "Mark as Sold" : "Mark as Available",
        nextSoldState
          ? "This listing will be shown as sold."
          : "This listing will be available again.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: nextSoldState ? "Mark Sold" : "Mark Available",
            onPress: () =>
              updateListing(property.id, { is_sold: nextSoldState }),
          },
        ],
      );
    },
    [updateListing],
  );

  const confirmDelete = useCallback(
    (property: Property) => {
      if (!userId || updatingId) return;

      Alert.alert(
        "Delete Listing",
        "This will permanently remove the property listing.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setUpdatingId(property.id);

              const { data, error: deleteError } = await authSupabase
                .from("properties")
                .delete()
                .eq("id", property.id)
                .eq("owner_clerk_id", userId)
                .select("*")
                .maybeSingle();

              setUpdatingId(null);

              if (deleteError || !data) {
                console.error("Failed to delete listing:", deleteError);
                Alert.alert("Error", "Could not delete this listing.");
                return;
              }

              setListings((prev) =>
                prev.filter((listing) => listing.id !== property.id),
              );
            },
          },
        ],
      );
    },
    [authSupabase, updatingId, userId],
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center px-5 pb-3 pt-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white"
        >
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">My Listings</Text>
          {!loading && (
            <Text className="mt-0.5 text-sm text-gray-400">
              {listings.length} {listings.length === 1 ? "property" : "properties"}
            </Text>
          )}
        </View>
      </View>

      <View className="px-5 pb-3">
        <View className="flex-row items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4">
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            className="flex-1 py-3 text-gray-800"
            placeholder="Search your listings..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            maxLength={MAX_SEARCH_LENGTH}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="mt-3 text-gray-500">Loading your listings...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredListings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => void fetchListings(true)}
          renderItem={({ item }) => (
            <MyListingCard
              property={item}
              updating={updatingId === item.id}
              onOpen={() => router.push(`/(root)/property/${item.id}`)}
              onEdit={() =>
                router.push({
                  pathname: "/(root)/(tabs)/create",
                  params: { id: item.id },
                })
              }
              onToggleSold={() => confirmSoldToggle(item)}
              onDelete={() => confirmDelete(item)}
            />
          )}
          ListHeaderComponent={
            error ? (
              <View className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <Text className="text-sm font-medium text-red-600">{error}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center py-24">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-blue-50">
                <Ionicons
                  name={search.trim() ? "search-outline" : "business-outline"}
                  size={36}
                  color="#2563EB"
                />
              </View>
              <Text className="mb-1 text-lg font-bold text-gray-700">
                {search.trim() ? "No matching listings" : "No listings yet"}
              </Text>
              <Text className="px-8 text-center text-sm text-gray-400">
                {search.trim()
                  ? "Try a different search term."
                  : "Tap the plus button to list your first property."}
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        onPress={() => router.push("/(root)/(tabs)/create")}
        className="absolute bottom-7 right-5 h-14 w-14 items-center justify-center rounded-full bg-blue-600"
        style={{
          shadowColor: "#2563EB",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function MyListingCard({
  property,
  updating,
  onOpen,
  onEdit,
  onToggleSold,
  onDelete,
}: {
  property: Property;
  updating: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggleSold: () => void;
  onDelete: () => void;
}) {
  const coverImage = useSignedPropertyImage(property.images?.[0]);

  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.9}
      className="mb-4 overflow-hidden rounded-2xl border border-gray-100 bg-white"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 2,
      }}
    >
      <View className="flex-row p-3">
        <Image
          source={coverImage ? { uri: coverImage } : fallbackImage}
          className="h-28 w-28 rounded-xl"
          resizeMode="cover"
        />

        <View className="ml-3 flex-1 justify-between">
          <View>
            <View className="flex-row items-start gap-2">
              <Text
                className="flex-1 text-base font-bold text-gray-900"
                numberOfLines={1}
              >
                {property.title}
              </Text>
              <View
                className={`rounded-full px-2 py-0.5 ${
                  property.is_sold ? "bg-red-50" : "bg-green-50"
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    property.is_sold ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {property.is_sold ? "SOLD" : "LIVE"}
                </Text>
              </View>
            </View>

            <View className="mt-1 flex-row items-center gap-1">
              <Ionicons name="location-outline" size={13} color="#6B7280" />
              <Text className="flex-1 text-xs text-gray-500" numberOfLines={1}>
                {property.address}, {property.city}
              </Text>
            </View>
          </View>

          <View>
            <Text className="text-base font-bold text-blue-600">
              {formatPrice(property.price)}
            </Text>
            <View className="mt-1 flex-row items-center gap-3">
              <Text className="text-xs text-gray-500">{property.bedrooms} bd</Text>
              <Text className="text-xs text-gray-500">
                {property.bathrooms} bath
              </Text>
              <Text className="text-xs text-gray-500">
                {property.area_sqft} ft²
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="flex-row border-t border-gray-100">
        <ActionButton
          icon="create-outline"
          label="Edit"
          color="#2563EB"
          disabled={updating}
          onPress={onEdit}
        />
        <ActionButton
          icon={property.is_sold ? "refresh-outline" : "checkmark-circle-outline"}
          label={property.is_sold ? "Available" : "Sold"}
          color={property.is_sold ? "#16A34A" : "#D97706"}
          disabled={updating}
          loading={updating}
          onPress={onToggleSold}
        />
        <ActionButton
          icon="trash-outline"
          label="Delete"
          color="#EF4444"
          disabled={updating}
          onPress={onDelete}
        />
      </View>
    </TouchableOpacity>
  );
}

function ActionButton({
  icon,
  label,
  color,
  disabled,
  loading,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  const handlePress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      className="flex-1 flex-row items-center justify-center gap-1.5 py-3"
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={icon} size={15} color={color} />
      )}
      <Text className="text-xs font-bold" style={{ color }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
