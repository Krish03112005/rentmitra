import { useAuth } from "@clerk/expo";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSupabase } from "./useSupabase";

export function useSavedProperties(propertyIds: string[]) {
  const { isLoaded, userId } = useAuth();
  const authSupabase = useSupabase();

  const uniquePropertyIds = useMemo(
    () => Array.from(new Set(propertyIds.filter(Boolean))).sort(),
    [propertyIds],
  );
  const propertyIdsKey = uniquePropertyIds.join(",");

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isActive = true;

    const fetchSavedIds = async () => {
      if (!isLoaded) return;

      if (!userId || uniquePropertyIds.length === 0) {
        setSavedIds(new Set());
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await authSupabase
        .from("saved_properties")
        .select("property_id")
        .eq("user_clerk_id", userId)
        .in("property_id", uniquePropertyIds);

      if (!isActive) return;

      if (fetchError) {
        console.error("Failed to fetch saved properties:", fetchError);
        setError("Failed to load saved properties.");
        setSavedIds(new Set());
      } else {
        setSavedIds(new Set((data ?? []).map((item) => item.property_id)));
      }

      setLoading(false);
    };

    void fetchSavedIds();

    return () => {
      isActive = false;
    };
  }, [authSupabase, isLoaded, propertyIdsKey, uniquePropertyIds, userId]);

  const toggleSaved = useCallback(
    async (propertyId: string, onUnsave?: () => void) => {
      if (!userId || pendingIds.has(propertyId)) return false;

      const wasSaved = savedIds.has(propertyId);
      setPendingIds((prev) => new Set(prev).add(propertyId));
      setError(null);

      if (wasSaved) {
        const { error: deleteError } = await authSupabase
          .from("saved_properties")
          .delete()
          .eq("user_clerk_id", userId)
          .eq("property_id", propertyId);

        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(propertyId);
          return next;
        });

        if (deleteError) {
          console.error("Failed to unsave property:", deleteError);
          setError("Failed to remove saved property.");
          return false;
        }

        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(propertyId);
          return next;
        });
        onUnsave?.();
        return true;
      }

      const { error: insertError } = await authSupabase
        .from("saved_properties")
        .upsert(
          { user_clerk_id: userId, property_id: propertyId },
          { onConflict: "user_clerk_id,property_id" },
        );

      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(propertyId);
        return next;
      });

      if (insertError) {
        console.error("Failed to save property:", insertError);
        setError("Failed to save property.");
        return false;
      }

      setSavedIds((prev) => new Set(prev).add(propertyId));
      return true;
    },
    [authSupabase, pendingIds, savedIds, userId],
  );

  return {
    error,
    loading,
    savedIds,
    pendingIds,
    isSaved: useCallback((propertyId: string) => savedIds.has(propertyId), [
      savedIds,
    ]),
    isPending: useCallback((propertyId: string) => pendingIds.has(propertyId), [
      pendingIds,
    ]),
    toggleSaved,
  };
}
