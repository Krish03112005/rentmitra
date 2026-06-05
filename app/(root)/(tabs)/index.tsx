import FeaturedCard from "@/components/FeaturedCard";
import PropertyCard from "@/components/PropertyCard";
import { useSignedPropertyImage } from "@/hooks/usePropertyImages";
import { useSavedProperties } from "@/hooks/useSavedProperties";
import { PUBLIC_PROPERTY_SELECT } from "@/lib/propertySelect";
import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";
import { PropertyType, useFilterStore } from "@/store/filterStore";
import { Property } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const NEARBY_FETCH_LIMIT = 80;
const NEARBY_LIMIT = 10;

type Coordinates = {
  latitude: number;
  longitude: number;
};

type NearbyProperty = Property & {
  distanceKm: number;
};

const fallbackImage = require("@/assets/images/livora.png");

const QUICK_FILTERS: {
  label: string;
  type: Exclude<PropertyType, null>;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { label: "House", type: "house", icon: "home" },
  { label: "Villa", type: "villa", icon: "business" },
  { label: "Apartment", type: "apartment", icon: "business-outline" },
  { label: "Bungalow", type: "bungalow", icon: "storefront" },
];

const getPageRange = (page: number, pageSize: number) => {
  const from = page * pageSize;
  return { from, to: from + pageSize - 1 };
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const getDistanceKm = (from: Coordinates, to: Coordinates) => {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(to.latitude - from.latitude);
  const lonDelta = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isValidCoordinate = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  Math.abs(latitude) <= 90 &&
  Math.abs(longitude) <= 180;

const getLocationLabel = (address?: Location.LocationGeocodedAddress) => {
  if (!address) return "Current location";

  const place =
    address.city || address.district || address.subregion || address.region;
  const region = address.country || address.isoCountryCode;

  return [place, region].filter(Boolean).join(", ") || "Current location";
};

export default function HomeScreen() {
  const { user } = useUser();
  const router = useRouter();
  const requestIdRef = useRef(0);
  const { resetFilters, setType } = useFilterStore();

  const [featured, setFeatured] = useState<Property[]>([]);
  const [recommended, setRecommended] = useState<Property[]>([]);
  const [nearby, setNearby] = useState<NearbyProperty[]>([]);
  const [recommendedPage, setRecommendedPage] = useState(0);
  const [hasMoreRecommended, setHasMoreRecommended] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationLabel, setLocationLabel] = useState("Use current location");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const savedPropertyIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...recommended.map((property) => property.id),
          ...nearby.map((property) => property.id),
        ]),
      ),
    [nearby, recommended],
  );
  const savedProperties = useSavedProperties(savedPropertyIds);

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
          .from("public_properties")
          .select(PUBLIC_PROPERTY_SELECT)
          .eq("is_featured", true)
          .order("created_at", { ascending: false })
          .limit(FEATURED_LIMIT),
        supabase
          .from("public_properties")
          .select(PUBLIC_PROPERTY_SELECT)
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
        setFeatured((featuredResult.data as unknown as Property[] | null) ?? []);
      }

      if (recommendedResult.error) {
        console.error(
          "Error fetching recommended properties:",
          recommendedResult.error,
        );
        setError("Failed to load recommended properties");
      } else {
        const nextRecommended =
          (recommendedResult.data as unknown as Property[] | null) ?? [];
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
      .from("public_properties")
      .select(PUBLIC_PROPERTY_SELECT)
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
      const nextItems = (data as unknown as Property[] | null) ?? [];
      setRecommended((prev) => [...prev, ...nextItems]);
      setRecommendedPage(nextPage);
      setHasMoreRecommended(nextItems.length === RECOMMENDED_PAGE_SIZE);
    }

    setLoadingMore(false);
  }, [hasMoreRecommended, loading, loadingMore, recommendedPage]);

  const fetchNearbyProperties = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setLocationLabel("Location unavailable");
        setLocationError("Allow location access to see nearby properties.");
        setNearby([]);
        return;
      }

      const lastKnownLocation = await Location.getLastKnownPositionAsync({
        maxAge: 5 * 60 * 1000,
        requiredAccuracy: 5000,
      });
      const currentLocation =
        lastKnownLocation ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));

      const userCoordinates = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      try {
        const [address] = await Location.reverseGeocodeAsync(userCoordinates);
        setLocationLabel(getLocationLabel(address));
      } catch {
        setLocationLabel("Current location");
      }

      const { data, error: nearbyError } = await supabase
        .from("public_properties")
        .select(PUBLIC_PROPERTY_SELECT)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("created_at", { ascending: false })
        .limit(NEARBY_FETCH_LIMIT);

      if (nearbyError) {
        console.error("Error fetching nearby properties:", nearbyError);
        setLocationError("Failed to load nearby properties.");
        setNearby([]);
        return;
      }

      const sortedNearby = ((data as unknown as Property[] | null) ?? [])
        .map((property) => {
          const latitude = Number(property.latitude);
          const longitude = Number(property.longitude);

          if (!isValidCoordinate(latitude, longitude)) return null;

          return {
            ...property,
            distanceKm: getDistanceKm(userCoordinates, { latitude, longitude }),
          };
        })
        .filter((property): property is NearbyProperty => !!property)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, NEARBY_LIMIT);

      setNearby(sortedNearby);
    } catch (nearbyError) {
      console.error("Unexpected error fetching nearby properties:", nearbyError);
      setLocationError("Could not detect your location.");
      setNearby([]);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const openTypeSearch = useCallback(
    (type: Exclude<PropertyType, null>) => {
      resetFilters();
      setType(type);
      router.push("/(root)/(tabs)/search");
    },
    [resetFilters, router, setType],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchProperties();
    }, [fetchProperties]),
  );

  useEffect(() => {
    void fetchNearbyProperties();
  }, [fetchNearbyProperties]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="z-10 flex-row items-center justify-between bg-gray-50 px-4 pt-4 pb-5">
        <Image
          source={require("../../../assets/images/livora.png")}
          style={{ width: 100, height: 36 }}
          resizeMode="contain"
        />

        <View className="items-end">
          <Text>Hello! 👋</Text>
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
              onPress={fetchNearbyProperties}
              disabled={locationLoading}
              className="mx-5 mb-4 self-start"
            >
              <Text className="mb-1 text-xs font-semibold text-gray-400">
                Location
              </Text>
              <View className="flex-row items-center gap-2">
                <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                  <Ionicons name="location" size={14} color="#FFFFFF" />
                </View>
                <Text className="text-base font-bold text-gray-800">
                  {locationLoading ? "Detecting location..." : locationLabel}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#6B7280" />
              </View>
            </TouchableOpacity>

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

            <View className="mx-5 mb-6 flex-row justify-between">
              {QUICK_FILTERS.map((item) => (
                <TouchableOpacity
                  key={item.type}
                  onPress={() => openTypeSearch(item.type)}
                  className="items-center"
                >
                  <View className="mb-2 h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                    <Ionicons name={item.icon} size={29} color="#2563EB" />
                  </View>
                  <Text className="text-xs font-bold text-gray-700">
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
              <View className="mb-4 flex-row items-center justify-between px-5">
                <Text className="text-lg font-bold text-gray-900">
                  Nearby Property
                </Text>
                <TouchableOpacity onPress={() => router.push("/(root)/(tabs)/search")}>
                  <Text className="text-sm font-semibold text-blue-500">
                    See all
                  </Text>
                </TouchableOpacity>
              </View>

              {locationLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#2563EB"
                  className="py-8"
                />
              ) : nearby.length > 0 ? (
                <FlatList
                  data={nearby}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <NearbyPropertyCard
                      property={item}
                      onPress={() => router.push(`/(root)/property/${item.id}`)}
                    />
                  )}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20 }}
                />
              ) : (
                <View className="mx-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                  <Text className="text-sm font-medium text-blue-700">
                    {locationError ??
                      "Add coordinates to listings to recommend nearby properties."}
                  </Text>
                </View>
              )}
            </View>

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

function NearbyPropertyCard({
  property,
  onPress,
}: {
  property: NearbyProperty;
  onPress: () => void;
}) {
  const coverImage = useSignedPropertyImage(property.images?.[0]);

  return (
    <TouchableOpacity
      onPress={onPress}
      className="mr-3 w-72 overflow-hidden rounded-2xl bg-white p-2"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 2,
      }}
    >
      <Image
        source={coverImage ? { uri: coverImage } : fallbackImage}
        className="h-36 w-full rounded-xl"
        resizeMode="cover"
      />

      <View className="p-2">
        <View className="mb-1 flex-row items-center justify-between">
          <View className="rounded-md bg-blue-50 px-2 py-1">
            <Text className="text-[10px] font-bold capitalize text-blue-600">
              {property.type}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="navigate" size={12} color="#F59E0B" />
            <Text className="text-xs font-semibold text-gray-500">
              {property.distanceKm < 1
                ? `${Math.round(property.distanceKm * 1000)} m`
                : `${property.distanceKm.toFixed(1)} km`}
            </Text>
          </View>
        </View>

        <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
          {property.title}
        </Text>
        <Text className="mt-1 text-xs text-gray-500" numberOfLines={1}>
          {property.address}, {property.city}
        </Text>
        <Text className="mt-2 text-base font-bold text-blue-600">
          {formatPrice(property.price)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
