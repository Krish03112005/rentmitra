import { useAuth } from "@clerk/expo";
import { createClerkSupabaseClient } from "../lib/supabase";
import { useMemo } from "react";

export function useSupabase() {
    const { getToken } = useAuth();

    const client = useMemo(
        () => createClerkSupabaseClient(() => getToken()),
        [getToken],
    );

    return client;
}