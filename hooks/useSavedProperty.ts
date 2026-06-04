import { useAuth } from "@clerk/expo";
import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "./useSupabase";

export function useSavedProperty(propertyId: string, onUnsave?: () => void) {
  const { isLoaded, userId } = useAuth();
  const authSupabase = useSupabase();

  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const checkIfSaved = async () => {
      if (!isLoaded) return;

      if (!userId || !propertyId) {
        setIsSaved(false);
        setSaveError(null);
        return;
      }

      const { data, error } = await authSupabase
        .from("saved_properties")
        .select("id")
        .eq("user_clerk_id", userId)
        .eq("property_id", propertyId)
        .maybeSingle();

      if (!isActive) return;

      if (error) {
        console.error("Failed to fetch saved property:", error);
        setSaveError("Failed to load saved state.");
        setIsSaved(false);
      } else {
        setSaveError(null);
        setIsSaved(!!data);
      }
    };

    void checkIfSaved();

    return () => {
      isActive = false;
    };
  }, [authSupabase, isLoaded, propertyId, userId]);

  const toggleSave = useCallback(async () => {
    if (!userId || !propertyId || saveLoading) return false;

    setSaveLoading(true);
    setSaveError(null);

    if (isSaved) {
      const { error } = await authSupabase
        .from("saved_properties")
        .delete()
        .eq("user_clerk_id", userId)
        .eq("property_id", propertyId);

      setSaveLoading(false);

      if (error) {
        console.error("Failed to unsave property:", error);
        setSaveError("Failed to remove saved property.");
        return false;
      }

      setIsSaved(false);
      onUnsave?.();
      return true;
    }

    const { error } = await authSupabase.from("saved_properties").upsert(
      { user_clerk_id: userId, property_id: propertyId },
      { onConflict: "user_clerk_id,property_id" },
    );

    setSaveLoading(false);

    if (error) {
      console.error("Failed to save property:", error);
      setSaveError("Failed to save property.");
      return false;
    }

    setIsSaved(true);
    return true;
  }, [authSupabase, isSaved, onUnsave, propertyId, saveLoading, userId]);

  return { isSaved, saveLoading, saveError, toggleSave };
}
