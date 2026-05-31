import { useAuth } from "@clerk/expo";
import { Redirect, Slot } from "expo-router";

export default function RootLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  // sync Clerk user -> Supabase (we'll build this later)

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href={"/sign-in"} />;

  return <Slot />;
}
