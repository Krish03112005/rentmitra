import { useAuth } from "@clerk/expo";
import { createClerkSupabaseClient } from "../lib/supabase";
import { useEffect, useMemo, useRef } from "react";

export function useSupabase() {
    const { getToken } = useAuth();
    const getTokenRef = useRef(getToken);

    useEffect(() => {
        getTokenRef.current = getToken;
    }, [getToken]);

    const client = useMemo(
        () => createClerkSupabaseClient(() => getTokenRef.current()),
        [],
    );

    return client;
}
