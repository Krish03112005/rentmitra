import { useSession } from "@clerk/expo";
import { createClerkSupabaseClient } from "../lib/supabase";
import { useEffect, useMemo, useRef } from "react";

export function useSupabase() {
    const { session } = useSession();
    const sessionRef = useRef(session);

    useEffect(() => {
        sessionRef.current = session;
    }, [session]);

    const client = useMemo(
        () =>
            createClerkSupabaseClient(async () =>
                sessionRef.current?.getToken({ skipCache: true }) ?? null,
            ),
        [],
    );

    return client;
}
