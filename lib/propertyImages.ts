import { supabase } from "@/lib/supabase";

export const PROPERTY_IMAGE_BUCKET = "property-images";
export const PROPERTY_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60;
export const MAX_PROPERTY_IMAGE_BYTES = 10 * 1024 * 1024;

const SUPABASE_STORAGE_PATH_PATTERNS = [
  `/storage/v1/object/public/${PROPERTY_IMAGE_BUCKET}/`,
  `/storage/v1/object/sign/${PROPERTY_IMAGE_BUCKET}/`,
  `/storage/v1/object/authenticated/${PROPERTY_IMAGE_BUCKET}/`,
];

const isUrl = (value: string) => /^https?:\/\//i.test(value);

export const getPropertyImageStoragePath = (image: string) => {
  if (!image) return null;

  if (!isUrl(image)) return image;

  try {
    const url = new URL(image);

    for (const pattern of SUPABASE_STORAGE_PATH_PATTERNS) {
      const patternIndex = url.pathname.indexOf(pattern);

      if (patternIndex !== -1) {
        const rawPath = url.pathname.slice(patternIndex + pattern.length);
        return decodeURIComponent(rawPath);
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const getSignedPropertyImageUrl = async (image: string) => {
  const storagePath = getPropertyImageStoragePath(image);

  if (!storagePath) return image;

  const { data, error } = await supabase.storage
    .from(PROPERTY_IMAGE_BUCKET)
    .createSignedUrl(storagePath, PROPERTY_IMAGE_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("Failed to sign property image:", error);
    return isUrl(image) ? image : null;
  }

  return data.signedUrl;
};

export const getSignedPropertyImageUrls = async (images: string[]) => {
  const signedUrls = await Promise.all(images.map(getSignedPropertyImageUrl));

  return signedUrls.filter((url): url is string => !!url);
};
