import { useSupabase } from "@/hooks/useSupabase";
import {
  getSignedPropertyImageUrls,
  MAX_PROPERTY_IMAGE_BYTES,
  PROPERTY_IMAGE_BUCKET,
} from "@/lib/propertyImages";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { decode } from "base64-arraybuffer";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TYPES = ["apartment", "house", "villa", "studio"] as const;
type PropertyType = (typeof TYPES)[number];

const MIN_PRICE = 1;
const MAX_PRICE = 999_999_999;
const MAX_IMAGES = 6;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

// Reusable class string - avoid repeating long className sring
const inputClass =
  "bg-white border border-gray-200 rounded-2xl px-4 py-3 text-gray-800";
const labelClass = "text-sm font-semibold text-gray-700 mb-1.5";
const sectionClass = "mb-5";

const normalizeWhatsappNumber = (value: string) => value.replace(/\D/g, "");

const isValidWhatsappNumber = (value: string) => {
  const normalized = normalizeWhatsappNumber(value);
  return normalized.length >= 10 && normalized.length <= 15;
};

const getImageContentType = (asset: ImagePicker.ImagePickerAsset) =>
  asset.mimeType || asset.file?.type || "image/jpeg";

const isAllowedImageContentType = (asset: ImagePicker.ImagePickerAsset) =>
  ALLOWED_IMAGE_MIME_TYPES.has(getImageContentType(asset).toLowerCase());

const getImageFileSize = (asset: ImagePicker.ImagePickerAsset) =>
  asset.fileSize ?? asset.file?.size;

const isAllowedImageSize = (asset: ImagePicker.ImagePickerAsset) =>
  !getImageFileSize(asset) ||
  Number(getImageFileSize(asset)) <= MAX_PROPERTY_IMAGE_BYTES;

const getImageExtension = (asset: ImagePicker.ImagePickerAsset) => {
  const fromFileName = asset.fileName?.split(".").pop();
  const fromMime = getImageContentType(asset).split("/").pop();
  const rawExtension = (fromFileName ?? fromMime ?? "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const extension = rawExtension === "jpeg" ? "jpg" : rawExtension;

  return extension || "jpg";
};

const getUploadBody = (asset: ImagePicker.ImagePickerAsset) => {
  if (Platform.OS === "web" && asset.file) {
    return asset.file;
  }

  if (!asset.base64) {
    throw new Error("Image data was not returned by the picker.");
  }

  return decode(asset.base64);
};

const getUploadPaths = (userId: string, filename: string) => ({
  ownerPath: `${userId}/${filename}`,
});

interface FormState {
  title: string;
  description: string;
  price: string;
  type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  areaSqft: string;
  address: string;
  city: string;
  whatsapp: string;
  latitude: string;
  longitude: string;
  isFeatured: boolean;
  images: string[]; // Supabase storage object paths -> saved to DB
  localImages: string[]; // Device/browser URIs -> shown in preview
}

const INITIAL_FORM: FormState = {
  title: "",
  description: "",
  price: "",
  type: "apartment",
  bedrooms: 1,
  bathrooms: 1,
  areaSqft: "",
  address: "",
  city: "",
  whatsapp: "",
  latitude: "",
  longitude: "",
  isFeatured: false,
  images: [],
  localImages: [],
};

export default function Create() {
  const router = useRouter();
  const { userId } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const authSupabase = useSupabase();
  const editId = typeof id === "string" ? id : undefined;
  const isEditing = !!editId;

  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  // Loading State
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [loadingProperty, setLoadingProperty] = useState(false);

  const updateForm = (fields: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...fields }));

  useEffect(() => {
    if (!editId) {
      setForm(INITIAL_FORM);
      return;
    }

    if (!userId) return;

    const fetchEditableProperty = async () => {
      setLoadingProperty(true);

      const { data, error } = await authSupabase
        .from("properties")
        .select("*")
        .eq("id", editId)
        .single();

      setLoadingProperty(false);

      if (error || !data) {
        Alert.alert("Error", "Could not load this property for editing.");
        router.back();
        return;
      }

      if (data.owner_clerk_id !== userId) {
        Alert.alert(
          "Not allowed",
          "Only the creator of this property can edit it.",
        );
        router.back();
        return;
      }

      const images = Array.isArray(data.images) ? data.images : [];
      const propertyType = TYPES.includes(data.type as PropertyType)
        ? (data.type as PropertyType)
        : "apartment";

      const signedImageUrls = await getSignedPropertyImageUrls(images);

      setForm({
        title: data.title ?? "",
        description: data.description ?? "",
        price: data.price ? String(data.price) : "",
        type: propertyType,
        bedrooms: data.bedrooms ?? 1,
        bathrooms: data.bathrooms ?? 1,
        areaSqft: data.area_sqft ? String(data.area_sqft) : "",
        address: data.address ?? "",
        city: data.city ?? "",
        whatsapp: data.contact_whatsapp ?? "",
        latitude: data.latitude ? String(data.latitude) : "",
        longitude: data.longitude ? String(data.longitude) : "",
        isFeatured: data.is_featured ?? false,
        images,
        localImages: signedImageUrls,
      });
    };

    void fetchEditableProperty();
  }, [authSupabase, editId, router, userId]);

  const handlePickImages = async () => {
    if (!userId) {
      Alert.alert("Authentication", "Please sign in before adding photos.");
      return;
    }

    const remainingSlots = MAX_IMAGES - form.localImages.length;
    if (remainingSlots <= 0) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library.",
      );

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: Platform.OS !== "web",
      selectionLimit: remainingSlots,
    });

    if (result.canceled || !result.assets.length) return;

    const selectedAssets = result.assets
      .slice(0, remainingSlots)
      .filter((asset) => isAllowedImageContentType(asset))
      .filter((asset) => isAllowedImageSize(asset));

    if (selectedAssets.length !== result.assets.slice(0, remainingSlots).length) {
      Alert.alert(
        "Unsupported Photos",
        "Some selected photos were skipped. Use JPEG, PNG, WebP, HEIC, or HEIF images up to 10 MB each.",
      );
    }

    if (selectedAssets.length === 0) return;

    const previewUris = selectedAssets.map((asset) => asset.uri);
    const startIndex = form.localImages.length;

    setForm((prev) => ({
      ...prev,
      images: [...prev.images, ...previewUris.map(() => "")],
      localImages: [...prev.localImages, ...previewUris],
    }));

    setUploadingImages(true);

    const uploadedImages: { index: number; storagePath: string }[] = [];
    let failedUploads = 0;

    for (const [offset, asset] of selectedAssets.entries()) {
      try {
        const extension = getImageExtension(asset);
        const filename = `property_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}.${extension}`;

        const uploadBody = getUploadBody(asset);
        const uploadedPath = getUploadPaths(userId, filename).ownerPath;
        const { error } = await authSupabase.storage
          .from(PROPERTY_IMAGE_BUCKET)
          .upload(uploadedPath, uploadBody, {
            contentType: getImageContentType(asset),
            upsert: false,
          });

        if (error) throw error;

        uploadedImages.push({
          index: startIndex + offset,
          storagePath: uploadedPath,
        });
      } catch (err) {
        failedUploads += 1;
        console.error("Upload error", err);
      }
    }

    if (uploadedImages.length > 0) {
      setForm((prev) => {
        const nextImages = [...prev.images];
        for (const upload of uploadedImages) {
          nextImages[upload.index] = upload.storagePath;
        }

        return { ...prev, images: nextImages };
      });
    }

    setUploadingImages(false);

    if (failedUploads > 0) {
      Alert.alert(
        "Upload Failed",
        "Some photos were selected but could not be uploaded. Check the property-images storage bucket and policies, then remove the failed photo and try again.",
      );
    }
  };

  const handleRemoveImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      localImages: prev.localImages.filter((_, i) => i !== index),
    }));
  };

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to detect coordinates.",
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      updateForm({
        latitude: String(location.coords.latitude),
        longitude: String(location.coords.longitude),
      });
    } catch {
      Alert.alert("Error", "Could not detect location. Enter manually.");
    } finally {
      setDetectingLocation(false);
    }
  };

  // Submit Form Button Handler
  const handleSubmit = async () => {
    if (!userId)
      return Alert.alert(
        "Authentication",
        "Please sign in before listing a property.",
      );

    if (!form.title.trim())
      return Alert.alert("Validation", "Title is required.");

    if (!form.price.trim())
      return Alert.alert("Validation", "Price is required.");

    const priceNum = Number(form.price);
    if (isNaN(priceNum) || priceNum < MIN_PRICE)
      return Alert.alert("Validation", "Price must be greater than ₹0.");
    if (priceNum > MAX_PRICE)
      return Alert.alert(
        "Validation",
        `Price cannot exceed ₹${MAX_PRICE.toLocaleString("en-IN")}.`,
      );

    if (!form.address.trim())
      return Alert.alert("Validation", "Address is required.");
    if (!form.city.trim())
      return Alert.alert("Validation", "City is required.");
    if (!isValidWhatsappNumber(form.whatsapp))
      return Alert.alert(
        "Validation",
        "Enter a valid WhatsApp number with country code.",
      );
    const uploadedImages = form.images.filter((url) => url.trim().length > 0);

    if (form.localImages.length === 0)
      return Alert.alert("Validation", "Please upload at least one image.");
    if (uploadedImages.length !== form.localImages.length)
      return Alert.alert(
        "Image Upload",
        "One or more photos are still uploading or failed. Remove failed photos and add them again.",
      );

    setSubmitting(true);

    const whatsappNumber = normalizeWhatsappNumber(form.whatsapp);
    const propertyPayload = {
      title: form.title.trim(),
      description: form.description.trim(),
      price: priceNum,
      type: form.type,
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      area_sqft: form.areaSqft ? Number(form.areaSqft) : null,
      address: form.address.trim(),
      city: form.city.trim(),
      contact_whatsapp: whatsappNumber,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      images: uploadedImages,
      is_featured: form.isFeatured,
    };

    const ownedPropertyPayload = {
      ...propertyPayload,
      owner_clerk_id: userId,
      is_sold: false,
    };

    if (isEditing) {
      const { data, error } = await authSupabase
        .from("properties")
        .update(propertyPayload)
        .eq("id", editId)
        .eq("owner_clerk_id", userId)
        .select("*")
        .maybeSingle();

      setSubmitting(false);

      if (error || !data) {
        Alert.alert("Error", "Failed to update property. Please try again.");
        console.error(error);
        return;
      }
    } else {
      const { data, error } = await authSupabase
        .from("properties")
        .insert(ownedPropertyPayload)
        .select("*")
        .single();

      setSubmitting(false);

      if (error || !data) {
        Alert.alert("Error", "Failed to create property. Please try again.");
        console.error(error);
        return;
      }
    }

    setForm(INITIAL_FORM);
    Alert.alert(
      "Success!",
      isEditing
        ? "Property updated successfully."
        : "Property listed successfully.",
      [
        {
          text: "OK",
          onPress: () =>
            isEditing
              ? router.replace(`/(root)/property/${editId}`)
              : router.replace("/(root)/(tabs)"),
        },
      ],
    );
  };

  if (loadingProperty) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-gray-500 mt-3">Loading property...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-5 pb-3 pt-4 ">
          <Text className="text-2xl font-bold text-gray-900 flex-1">
            {isEditing ? "Edit Property" : "Add Property"}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className={sectionClass}>
            <Text className={labelClass}>
              Photos{" "}
              <Text className="text-gray-400 font-normal">
                (up to {MAX_IMAGES})
              </Text>
            </Text>

            <View className="flex-row flex-wrap gap-3">
              {form.localImages.map((uri, index) => {
                const isPendingUpload = !form.images[index];
                const uploadLabel = uploadingImages ? "UPLOADING" : "FAILED";

                return (
                  <View key={`${uri}-${index}`} className="relative">
                    <Image
                      source={{ uri }}
                      className="w-24 h-24 rounded-2xl"
                      resizeMode="cover"
                    />
                    {index === 0 && !isPendingUpload && (
                      <View className="absolute top-1 left-1 bg-blue-500 px-1.5 py-0.5 rounded-full">
                        <Text className="text-white text-[9px] font-bold">
                          COVER
                        </Text>
                      </View>
                    )}

                    {isPendingUpload && (
                      <View
                        pointerEvents="none"
                        className="absolute inset-0 rounded-2xl items-center justify-center"
                        style={{ backgroundColor: "rgba(17, 24, 39, 0.58)" }}
                      >
                        {uploadingImages ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Ionicons
                            name="alert-circle"
                            size={18}
                            color="white"
                          />
                        )}
                        <Text className="text-white text-[9px] font-bold mt-1">
                          {uploadLabel}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => handleRemoveImage(index)}
                      disabled={uploadingImages}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full items-center justify-center"
                      style={{ opacity: uploadingImages ? 0.5 : 1 }}
                    >
                      <Ionicons name="close" size={11} color="white" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {form.localImages.length < MAX_IMAGES && (
                <TouchableOpacity
                  onPress={handlePickImages}
                  disabled={uploadingImages}
                  className="w-24 h-24 rounded-2xl bg-white border-2 border-dashed 
                border-gray-300 items-center justify-center"
                >
                  {uploadingImages ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : (
                    <>
                      <Ionicons
                        name="camera-outline"
                        size={23}
                        color="#9CA3AF"
                      />
                      <Text className="text-gray-400 text-xs mt-1">Add</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Basic Info */}
          <View className={sectionClass}>
            <Text className={labelClass}>Title</Text>
            <TextInput
              className={inputClass}
              placeholder="e.g. Modern 3BHK in Bandra"
              placeholderTextColor="#9CA3AF"
              value={form.title}
              onChangeText={(v) => updateForm({ title: v })}
            />
          </View>

          <View className={sectionClass}>
            <Text className={labelClass}>Description</Text>
            <TextInput
              className={`${inputClass} h-24`}
              placeholder="Describe the property..."
              placeholderTextColor="#9CA3AF"
              value={form.description}
              onChangeText={(v) => updateForm({ description: v })}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Price */}
          <View className={sectionClass}>
            <Text className={labelClass}>Price (₹)</Text>
            <TextInput
              className={inputClass}
              placeholder="e.g. 5000000"
              placeholderTextColor="#9CA3AF"
              value={form.price}
              onChangeText={(v) => updateForm({ price: v })}
              keyboardType="numeric"
            />
            <Text className="text-xs text-gray-400 mt-1.5 ml-1">
              Valid range: ₹1 – ₹{MAX_PRICE.toLocaleString("en-IN")}
            </Text>
          </View>

          {/* Property Type */}
          <View className={sectionClass}>
            <Text className={labelClass}>Property Type</Text>
            <View className="flex-row flex-wrap gap-2">
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => updateForm({ type: t })}
                  className={`px-4 py-2 rounded-full border ${
                    form.type === t
                      ? "bg-blue-500 border-blue-500"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold capitalize ${
                      form.type === t ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Bedrooms / Bathrooms */}
          <View className="flex-row gap-4 mb-5">
            <Counter
              label="Bedrooms"
              value={form.bedrooms}
              onChange={(v) => updateForm({ bedrooms: v })}
            />
            <Counter
              label="Bathrooms"
              value={form.bathrooms}
              onChange={(v) => updateForm({ bathrooms: v })}
            />
          </View>

          <View className={sectionClass}>
            <Text className={labelClass}>Area (sq ft)</Text>
            <TextInput
              className={inputClass}
              placeholder="e.g. 1200"
              placeholderTextColor="#9CA3AF"
              value={form.areaSqft}
              onChangeText={(v) => updateForm({ areaSqft: v })}
              keyboardType="numeric"
            />
          </View>

          {/* Location */}
          <View className={sectionClass}>
            <Text className={labelClass}>Address</Text>
            <TextInput
              className={inputClass}
              placeholder="Street address"
              placeholderTextColor="#9CA3AF"
              value={form.address}
              onChangeText={(v) => updateForm({ address: v })}
            />
          </View>

          <View className={sectionClass}>
            <Text className={labelClass}>City</Text>
            <TextInput
              className={inputClass}
              placeholder="e.g. Mumbai"
              placeholderTextColor="#9CA3AF"
              value={form.city}
              onChangeText={(v) => updateForm({ city: v })}
            />
          </View>

          <View className={sectionClass}>
            <Text className={labelClass}>WhatsApp Number</Text>
            <TextInput
              className={inputClass}
              placeholder="e.g. +91 9876543210"
              placeholderTextColor="#9CA3AF"
              value={form.whatsapp}
              onChangeText={(v) => updateForm({ whatsapp: v })}
              keyboardType="phone-pad"
            />
            <Text className="text-xs text-gray-400 mt-1.5 ml-1">
              Buyers will contact you on this number.
            </Text>
          </View>

          {/* Coordinates */}
          <View className={sectionClass}>
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className={labelClass}>Coordinates</Text>
              <TouchableOpacity
                onPress={handleDetectLocation}
                disabled={detectingLocation}
                className="flex-row items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full"
              >
                {detectingLocation ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <Ionicons name="locate-outline" size={13} color="#2563EB" />
                )}
                <Text className="text-blue-600 text-xs font-semibold">
                  {detectingLocation ? "Detecting..." : "Detect Location"}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextInput
                  className={inputClass}
                  placeholder="Latitude"
                  placeholderTextColor="#9CA3AF"
                  value={form.latitude}
                  onChangeText={(v) => updateForm({ latitude: v })}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <TextInput
                  className={inputClass}
                  placeholder="Longitude"
                  placeholderTextColor="#9CA3AF"
                  value={form.longitude}
                  onChangeText={(v) => updateForm({ longitude: v })}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Toggles */}
          <View className="gap-3 mb-5">
            <Toggle
              label="Featured Property"
              description="Show this in the Featured section on home"
              value={form.isFeatured}
              onChange={(v) => updateForm({ isFeatured: v })}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || uploadingImages || loadingProperty}
            className="bg-blue-600 rounded-2xl py-4 items-center"
            style={{
              shadowColor: "#2563EB",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
              opacity:
                submitting || uploadingImages || loadingProperty ? 0.7 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">
                {isEditing ? "Update Property" : "List Property"}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Toggle = ({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) => (
  <TouchableOpacity
    onPress={() => onChange(!value)}
    className={`flex-row items-center justify-between p-4 rounded-2xl border ${
      value ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"
    }`}
  >
    <View className="flex-1 mr-3">
      <Text
        className={`font-semibold ${value ? "text-blue-700" : "text-gray-700"}`}
      >
        {label}
      </Text>
      {description && (
        <Text className="text-xs text-gray-400 mt-0.5">{description}</Text>
      )}
    </View>
    <View
      className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
        value ? "bg-blue-600 border-blue-600" : "border-gray-300"
      }`}
    >
      {value && <Ionicons name="checkmark" size={14} color="white" />}
    </View>
  </TouchableOpacity>
);

const Counter = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) => (
  <View className="flex-1">
    <Text className={labelClass}>{label}</Text>
    <View
      className="flex-row items-center bg-white border border-gray-200
    rounded-2xl overflow-hidden"
    >
      <TouchableOpacity
        onPress={() => onChange(Math.max(1, value - 1))}
        className="w-11 h-11 justify-center items-center"
      >
        <Ionicons name="remove" size={18} color="#374151" />
      </TouchableOpacity>

      <Text className="flex-1 text-center text-gray-800 font-bold text-base ">
        {value}
      </Text>

      <TouchableOpacity
        onPress={() => onChange(Math.max(1, value + 1))}
        className="w-11 h-11 justify-center items-center"
      >
        <Ionicons name="add" size={18} color="#374151" />
      </TouchableOpacity>
    </View>
  </View>
);
