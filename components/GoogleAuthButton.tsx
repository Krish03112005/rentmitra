import { useSSO } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Text,
  TouchableOpacity,
} from "react-native";

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  React.useEffect(() => {
    if (Platform.OS !== "android") return;

    void WebBrowser.warmUpAsync();

    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function GoogleAuthButton({
  label = "Continue with Google",
}: {
  label?: string;
}) {
  useWarmUpBrowser();

  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const [loading, setLoading] = useState(false);

  const handleGoogleAuth = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri({
          scheme: "reactnative",
          path: "sso-callback",
        }),
      });

      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) {
              console.log(session.currentTask);
              return;
            }

            router.replace(decorateUrl("/") as any);
          },
        });
        return;
      }

      Alert.alert(
        "Google sign-in needs another step",
        "Please finish any additional verification in Clerk, then try again."
      );
    } catch (error) {
      console.error("Google authentication failed:", error);
      Alert.alert(
        "Google sign-in failed",
        "Please check your Clerk Google OAuth setup and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleGoogleAuth}
      disabled={loading}
      className="w-full flex-row items-center justify-center gap-3 border border-gray-300 bg-white py-4 rounded-xl mb-4"
      style={{ opacity: loading ? 0.7 : 1 }}
    >
      {loading ? (
        <ActivityIndicator color="#374151" />
      ) : (
        <>
          <Ionicons name="logo-google" size={18} color="#111827" />
          <Text className="text-gray-800 font-bold text-base">{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
