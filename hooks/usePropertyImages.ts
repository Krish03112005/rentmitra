import {
  getSignedPropertyImageUrl,
  getSignedPropertyImageUrls,
} from "@/lib/propertyImages";
import { useEffect, useState } from "react";

export const useSignedPropertyImage = (image?: string | null) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    if (!image) {
      setSignedUrl(null);
      return;
    }

    setSignedUrl(null);

    getSignedPropertyImageUrl(image).then((url) => {
      if (isActive) setSignedUrl(url);
    });

    return () => {
      isActive = false;
    };
  }, [image]);

  return signedUrl;
};

export const useSignedPropertyImages = (images: string[]) => {
  const [signedUrls, setSignedUrls] = useState<string[]>([]);

  useEffect(() => {
    let isActive = true;

    if (images.length === 0) {
      setSignedUrls([]);
      return;
    }

    setSignedUrls([]);

    getSignedPropertyImageUrls(images).then((urls) => {
      if (isActive) setSignedUrls(urls);
    });

    return () => {
      isActive = false;
    };
  }, [images]);

  return signedUrls;
};
