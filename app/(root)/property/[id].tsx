import ImageViewer from "@/components/ImageViewer";
import { useSignedPropertyImages } from "@/hooks/usePropertyImages";
import { useSavedProperty } from "@/hooks/useSavedProperty";
import { useSupabase } from "@/hooks/useSupabase";
import { PUBLIC_PROPERTY_SELECT } from "@/lib/propertySelect";
import { supabase as publicSupabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";
import { Property } from "@/types";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const { width } = Dimensions.get("window");
const fallbackImage = require("@/assets/images/livora.png");
const EMPTY_IMAGES: string[] = [];

const normalizeWhatsappNumber = (value?: string | null) =>
  value?.replace(/\D/g, "") ?? "";

const isValidCoordinate = (
  latitude: number | null | undefined,
  longitude: number | null | undefined,
) =>
  typeof latitude === "number" &&
  typeof longitude === "number" &&
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  Math.abs(latitude) <= 90 &&
  Math.abs(longitude) <= 180;

export default function PropertyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const router = useRouter();

  const [property, setProperty] = useState<Property | null>(null);
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  const authSupabase = useSupabase();

  const { isSaved, saveLoading, toggleSave } = useSavedProperty(id ?? "");
  const signedImages = useSignedPropertyImages(property?.images ?? EMPTY_IMAGES);

  const fetchProperty = useCallback(async () => {
    setLoading(true);
    setPropertyError(null);

    const { data, error } = await publicSupabase
      .from("public_properties")
      .select(PUBLIC_PROPERTY_SELECT)
      .eq("id", id)
      .single();

    if (error) {
      setPropertyError(error.message || "Unable to load property.");
      setProperty(null);
    } else {
      let nextProperty = data as unknown as Property;

      if (userId) {
        const { data: ownedProperty, error: ownedPropertyError } =
          await authSupabase
            .from("properties")
            .select("*")
            .eq("id", id)
            .eq("owner_clerk_id", userId)
            .maybeSingle();

        if (ownedPropertyError) {
          console.error("Failed to fetch owned property details:", ownedPropertyError);
        } else if (ownedProperty) {
          nextProperty = ownedProperty as Property;
        }
      }

      setProperty(nextProperty);
    }

    setLoading(false);
  }, [authSupabase, id, userId]);

  useEffect(() => {
    fetchProperty();
  }, [fetchProperty]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  };

  const handleContact = async () => {
    if (contactLoading) return;

    let phone = normalizeWhatsappNumber(property?.contact_whatsapp);

    if (!phone) {
      if (!userId) {
        Alert.alert(
          "Sign in required",
          "Please sign in before contacting the property owner.",
        );
        return;
      }

      setContactLoading(true);

      const { data, error } = await authSupabase.rpc(
        "get_property_contact_whatsapp",
        {
          target_property_id: id,
        },
      );

      setContactLoading(false);

      if (error || !data) {
        console.error("Failed to fetch property contact:", error);
        Alert.alert(
          "Contact unavailable",
          "The property creator has not added a WhatsApp number yet.",
        );
        return;
      }

      phone = normalizeWhatsappNumber(data as string);
    }

    const message = `Hi! I'm interested in the property: ${property?.title}`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  };

  const updateOwnedProperty = async (updates: Partial<Property>) => {
    return authSupabase
      .from("properties")
      .update(updates)
      .eq("id", id)
      .eq("owner_clerk_id", userId)
      .select("*")
      .maybeSingle();
  };

  const deleteOwnedProperty = async () => {
    return authSupabase
      .from("properties")
      .delete()
      .eq("id", id)
      .eq("owner_clerk_id", userId)
      .select("*")
      .maybeSingle();
  };

  const handleMarkSold = () => {
    Alert.alert("Mark as Sold", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark Sold",
        onPress: async () => {
          const { data, error } = await updateOwnedProperty({ is_sold: true });

          if (error || !data) {
            Alert.alert(
              "Error",
              "Only the property creator can mark it as sold.",
            );
            return;
          }

          setProperty(data as Property);
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert("Delete Property", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { data, error } = await deleteOwnedProperty();

          if (error || !data) {
            Alert.alert("Error", "Only the property creator can delete it.");
            return;
          }

          router.replace("/(root)/(tabs)");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-gray-500 mt-3">Loading property...</Text>
      </View>
    );
  }

  if (!property) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-4">
        <Text className="text-gray-500 mb-4">
          {propertyError ?? "Property not found."}
        </Text>
        <TouchableOpacity
          onPress={fetchProperty}
          className="rounded-full bg-blue-600 px-5 py-3"
        >
          <Text className="text-white font-medium text-center">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasMapCoordinates = isValidCoordinate(
    property.latitude,
    property.longitude,
  );
  const mapUrl = hasMapCoordinates
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${
        property.longitude - 0.003
      }%2C${property.latitude - 0.003}%2C${property.longitude + 0.003}%2C${
        property.latitude + 0.003
      }&layer=mapnik&marker=${property.latitude}%2C${property.longitude}`
    : null;

  const isLongDesc = (property.description?.length ?? 0) > 150;
  const displayDesc =
    expanded || !isLongDesc
      ? property.description
      : property.description?.slice(0, 150) + "...";

  const isOwner = !!userId && property.owner_clerk_id === userId;
  const carouselImages =
    signedImages.length > 0
      ? signedImages
      : property.images.map(() => null);

  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View>
          <View style={{ opacity: property.is_sold ? 0.5 : 1 }}>
            <FlatList
              data={carouselImages}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  disabled={!item}
                  onPress={() => setImageViewerVisible(true)}
                >
                  <Image
                    source={item ? { uri: item } : fallbackImage}
                    style={{ width, height: 300 }}
                  />
                </TouchableOpacity>
              )}
              horizontal
              pagingEnabled
              onScroll={onScroll}
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
            />
          </View>

          {/* Image count badge */}
          <View className="absolute bottom-3 right-4 bg-black/50 px-3 py-1 rounded-full">
            <Text className="text-white text-xs font-medium">
              {activeIndex + 1}/{property.images.length}
            </Text>
          </View>

          <SafeAreaView className="absolute top-0 left-0 right-0">
            <View className="flex-row items-center justify-between px-4 pt-2">
              <TouchableOpacity
                onPress={() => router.back()}
                className="w-10 h-10 bg-white rounded-full items-center justify-center"
                style={{ elevation: 3 }}
              >
                <Ionicons name="arrow-back" size={20} color="#111827" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={toggleSave}
                disabled={saveLoading}
                className="w-10 h-10 bg-white rounded-full items-center justify-center"
                style={{ elevation: 3 }}
              >
                <Ionicons
                  name={isSaved ? "heart" : "heart-outline"}
                  size={20}
                  color={isSaved ? "#EF4444" : "#111827"}
                />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        <View
          className="px-5 pt-5 pb-8"
          style={{ opacity: property.is_sold ? 0.6 : 1 }}
        >
          <View className="flex-row gap-2 mb-3 flex-wrap">
            <View className="bg-blue-50 px-3 py-1 rounded-full">
              <Text className="text-blue-500 text-xs font-semibold capitalize">
                {property.type}
              </Text>
            </View>
            {property.is_featured && (
              <View className="bg-amber-50 px-3 py-1 rounded-full">
                <Text className="text-amber-600 text-xs font-semibold">
                  ⭐ Featured
                </Text>
              </View>
            )}

            {property.is_sold && (
              <View className="bg-red-50 px-3 py-1 rounded-full">
                <Text className="text-red-500 text-xs font-semibold">Sold</Text>
              </View>
            )}
          </View>

          {/* Title + Price */}
          <Text className="text-2xl font-bold text-gray-900 mb-1">
            {property.title}
          </Text>
          <Text className="text-blue-600 text-xl font-bold mb-4">
            {formatPrice(property.price)}
          </Text>

          <View className="flex-row justify-between bg-gray-50 rounded-2xl p-4 mb-5">
            <SpecItem
              icon="bed-outline"
              label="Beds"
              value={`${property.bedrooms}`}
            />
            <SpecItem
              icon="water-outline"
              label="Bathroom"
              value={`${property.bathrooms}`}
            />
            <SpecItem
              icon="expand-outline"
              label="Area"
              value={`${property.area_sqft} ft²`}
            />
            <SpecItem
              icon="home-outline"
              label="Type"
              value={`${property.type}`}
            />
          </View>

          <Text className="text-base font-bold text-gray-900 mb-2">
            Description
          </Text>
          <Text className="text-gray-500 text-sm leading-6 mb-1">
            {displayDesc}
          </Text>

          {isLongDesc && (
            <TouchableOpacity onPress={() => setExpanded(!expanded)}>
              <Text className="text-blue-600 text-sm font-medium mb-5">
                {expanded ? "Show less" : "Read more"}
              </Text>
            </TouchableOpacity>
          )}

          <Text className="text-base font-bold text-gray-900 mb-2 mt-5">
            Location
          </Text>

          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="location-outline" size={16} color="#6B7280" />
            <Text className="text-gray-500 text-sm flex-1">
              {property.address}, {property.city}
            </Text>
          </View>

          {mapUrl ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(root)/property/map",
                  params: {
                    latitude: String(property.latitude),
                    longitude: String(property.longitude),
                    title: property.title,
                    address: `${property.address}, ${property.city}`,
                  },
                })
              }
              activeOpacity={0.9}
              className="rounded-xl overflow-hidden mb-6"
              style={{ height: 200 }}
            >
              <WebView
                source={{ uri: mapUrl }}
                style={{ flex: 1 }}
                scrollEnabled={false}
                pointerEvents="none"
              />

              <View className="absolute bottom-3 right-3 bg-white/90 px-3 py-1 rounded-full flex-row items-center gap-1">
                <Ionicons name="expand-outline" size={12} color="#374151" />
                <Text className="text-gray-600 text-xs font-medium">
                  Tap to expand
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View className="mb-6 h-36 items-center justify-center rounded-xl bg-gray-50">
              <Ionicons name="map-outline" size={24} color="#9CA3AF" />
              <Text className="mt-2 text-sm font-medium text-gray-500">
                Map location unavailable
              </Text>
            </View>
          )}

          {/* Contact Button */}
          <TouchableOpacity
            onPress={handleContact}
            disabled={contactLoading}
            className="flex-row items-center justify-center gap-2 bg-green-600 py-4 rounded-2xl mb-4"
          >
            {contactLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="logo-whatsapp" size={20} color="white" />
            )}
            <Text className="text-white font-bold text-base">
              {contactLoading ? "Opening Contact..." : "Contact Owner"}
            </Text>
          </TouchableOpacity>

          {isOwner && (
            <View className="gap-3">
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/(root)/(tabs)/create",
                    params: { id: property.id },
                  })
                }
                className="flex-row items-center justify-center
                      gap-2 bg-blue-50 py-4 rounded-2xl border border-blue-200
                    "
              >
                <Ionicons name="create-outline" size={18} color="#2563EB" />
                <Text className="text-blue-600 font-semibold">
                  Edit Property
                </Text>
              </TouchableOpacity>

              <View className="flex-row gap-3">
                {!property.is_sold && (
                  <TouchableOpacity
                    onPress={handleMarkSold}
                    className="flex-1 flex-row items-center justify-center
                      gap-2 bg-amber-50 py-4 rounded-2xl border border-amber-200
                    "
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#D97706"
                    />
                    <Text className="text-amber-600 font-semibold">
                      Mark Sold
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={handleDelete}
                  className="flex-1 flex-row items-center justify-center
                      gap-2 bg-red-50 py-4 rounded-2xl border border-red-200
                    "
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  <Text className="text-red-600 font-semibold">Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <ImageViewer
        images={signedImages.map((uri) => ({ uri }))}
        imageIndex={activeIndex}
        visible={imageViewerVisible && signedImages.length > 0}
        onRequestClose={() => setImageViewerVisible(false)}
      />
    </View>
  );
}

function SpecItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View className="items-center gap-1">
      <Ionicons name={icon} size={20} color="#2563EB" />
      <Text className="text-gray-900 font-bold text-sm">{value}</Text>
      <Text className="text-gray-400 text-xs">{label}</Text>
    </View>
  );
}
