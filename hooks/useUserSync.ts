import { useUserStore } from "@/store/userStore";
import { useUser } from "@clerk/expo";
import { useSupabase } from "./useSupabase";
import { useEffect } from "react";

export const useUserSync = () => {
    const { user } = useUser();
    const setIsAdmin = useUserStore((state) => state.setIsAdmin);

    const authSupabase = useSupabase();

    useEffect(() => {
        if (!user) {
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
                console.error("Failed to fetch Supabase user:", error);
                setIsAdmin(false);
                return;
            }

            if (data) {
                await authSupabase
                    .from("users")
                    .update(profile)
                    .eq("clerk_id", user.id);

                setIsAdmin(data.is_admin ?? false);
                return;
            }

            const { data: newUser, error: insertError } = await authSupabase
                .from("users")
                .insert({
                    clerk_id: user.id,
                    ...profile,
                    is_admin: false,
                })
                .select("is_admin")
                .single();

            if (insertError) {
                console.error("Failed to create Supabase user:", insertError);
                setIsAdmin(false);
                return;
            }

            setIsAdmin(newUser?.is_admin ?? false);
        };

        void syncUser();
    }, [authSupabase, setIsAdmin, user]);
};
