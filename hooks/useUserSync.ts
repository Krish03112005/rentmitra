import { useUserStore } from "@/store/userStore";
import { useAuth, useSession, useUser } from "@clerk/expo";
import { useSupabase } from "./useSupabase";
import { useEffect } from "react";

const logSupabaseError = (message: string, error: unknown) => {
    const supabaseError = error as {
        code?: string;
        details?: string | null;
        hint?: string | null;
        message?: string;
    };

    console.error(message, {
        code: supabaseError?.code ?? null,
        message: supabaseError?.message ?? String(error),
        details: supabaseError?.details ?? null,
        hint: supabaseError?.hint ?? null,
    });
};

export const useUserSync = () => {
    const { isLoaded: authLoaded, isSignedIn } = useAuth();
    const { session } = useSession();
    const { user } = useUser();
    const setIsAdmin = useUserStore((state) => state.setIsAdmin);

    const authSupabase = useSupabase();

    useEffect(() => {
        if (!authLoaded) {
            return;
        }

        if (!isSignedIn || !user || !session) {
            setIsAdmin(false);
            return;
        }

        const syncUser = async () => {
            const email =
                user.primaryEmailAddress?.emailAddress ??
                user.emailAddresses[0]?.emailAddress ??
                "";

            const profile = {
                email,
                first_name: user.firstName,
                last_name: user.lastName,
                avatar_url: user.imageUrl,
            };

            const { data, error } = await authSupabase
                .from("users")
                .select("clerk_id, is_admin")
                .eq("clerk_id", user.id)
                .maybeSingle();

            if (error) {
                logSupabaseError("Failed to fetch Supabase user", error);
                setIsAdmin(false);
                return;
            }

            if (data) {
                const { error: updateError } = await authSupabase
                    .from("users")
                    .update(profile)
                    .eq("clerk_id", user.id);

                if (updateError) {
                    logSupabaseError("Failed to update Supabase user", updateError);
                }

                setIsAdmin(data.is_admin ?? false);
                return;
            }

            const { data: newUser, error: insertError } = await authSupabase
                .from("users")
                .insert({
                    clerk_id: user.id,
                    ...profile,
                })
                .select("is_admin")
                .single();

            if (insertError) {
                logSupabaseError("Failed to create Supabase user", insertError);
                setIsAdmin(false);
                return;
            }

            setIsAdmin(newUser?.is_admin ?? false);
        };

        void syncUser();
    }, [authLoaded, authSupabase, isSignedIn, session, setIsAdmin, user]);
};
