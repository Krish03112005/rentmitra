import { useUserSync } from "@/hooks/useUserSync";
import { useAuth } from "@clerk/expo";
import { Redirect, Slot } from "expo-router";

export default function RootLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href={"/sign-in"} />;

  return <AuthenticatedRoot />;
}

function AuthenticatedRoot() {
  useUserSync();

  return <Slot />;
}
