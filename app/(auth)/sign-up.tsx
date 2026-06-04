import { View, Text, ScrollView, Image, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import React, { useState } from 'react'
import { Redirect, useRouter } from "expo-router"
import { useAuth, useSignUp } from '@clerk/expo';
import GoogleAuthButton from '@/components/GoogleAuthButton';

export default function SignUp() {

    const { signUp, errors, fetchStatus } = useSignUp();
    const { isLoaded, isSignedIn } = useAuth();

    const router = useRouter();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");

    const isLoading = fetchStatus === 'fetching';

    if (!isLoaded) return null;

    if (isSignedIn) {
        return <Redirect href="/(root)/(tabs)" />;
    }

    if (signUp.status === 'complete') {
        return <Redirect href="/(root)/(tabs)" />;
    }

    const onSignUpPress = async () => {
        const { error } = await signUp.password({
        emailAddress: email,
        password,
        firstName,
        lastName,
        });
    if (error) {
      alert(error.message);
      return;
    }

    if (!error) await signUp.verifications.sendEmailCode();
  };

  const onVerifyPress = async () => {
    await signUp.verifications.verifyEmailCode({
        code,
    })

    if (signUp.status === 'complete') {
        await signUp.finalize({
            navigate:({decorateUrl}) => {
                const url = decorateUrl("/");
                router.replace(url as any);
            }
        })
    }  
  };

  if (
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0
  ) {
    return (
    <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
        <ScrollView
            contentContainerStyle={{
                flexGrow: 1,
                alignItems: "center",
                paddingHorizontal: 24,
                paddingTop: 96,
                paddingBottom: 48,
            }}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
    <View className='w-full'>
         <Image 
            source={require('../../assets/images/livora.png')}
            className='w-32 h-16 mb-8 self-center'
            resizeMode='contain'
        />
          <Text className='text-3xl font-bold text-gray-800 mb-2 self-center'>
              Verify your Account{" "}
          </Text>
            <Text className='text-gray-500 mb-8 self-center'>We have sent a code to {email}.</Text>
            <TextInput
                className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-4"
                placeholder="Enter verification code"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
            />
            {errors.fields.code && (
            <Text className="text-red-500 mb-4">
                {errors.fields.code.message}
            </Text>
            )}
            <TouchableOpacity
                onPress={onVerifyPress}
                disabled={isLoading}
                className="w-full bg-blue-600 py-4 rounded-xl items-center mb-4"
                >
                {isLoading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text className="text-white font-bold text-base">Verify</Text>
                 )}
            </TouchableOpacity> 

            <TouchableOpacity
            onPress={() => signUp.verifications.sendEmailCode()}
            className="py-2"
            >
            <Text className="text-blue-600">I need a new code</Text>
            </TouchableOpacity>
    </View>
        </ScrollView>
    </KeyboardAvoidingView>
    )
  }
    return (
        <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <ScrollView
            contentContainerStyle={{
                flexGrow: 1,
                alignItems: "center",
                paddingHorizontal: 24,
                paddingTop: 96,
                paddingBottom: 48,
            }}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps='handled'
            showsVerticalScrollIndicator={false}
        >
            <View className='w-full'>
                <Image 
                    source={require('../../assets/images/livora.png')} 
                    className='w-32 h-16 mb-8 self-center'
                    resizeMode='contain'
                />
                <Text className='text-3xl font-bold text-gray-800 mb-2 self-center'>
                    Create Account
                </Text>
                <Text className='text-gray-500 mb-8 self-center'>Find your dream Home today</Text>

                <GoogleAuthButton label="Sign up with Google" />

                <View className="flex-row items-center mb-5">
                    <View className="h-px flex-1 bg-gray-200" />
                    <Text className="mx-3 text-xs font-semibold uppercase text-gray-400">
                        or
                    </Text>
                    <View className="h-px flex-1 bg-gray-200" />
                </View>

                <View className='flex-row gap-3 mb-4'>
                    <TextInput
                        className='flex-1 border border-gray-300 p-4 rounded-xl py-3'
                        placeholder='First Name'
                        placeholderTextColor='#9CA3AF'
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                    />

                    <TextInput
                        className="flex-1 border border-gray-300 rounded-xl px-4 py-3"
                        placeholder="Last name"
                        placeholderTextColor="#9CA3AF"
                        value={lastName}
                        onChangeText={setLastName}
                        autoCapitalize="words"
                    />
                </View>
                <TextInput
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-4"
                    placeholder="Email address"
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
                {errors.fields.emailAddress && (
                    <Text className="text-red-500 mb-4">
                        {errors.fields.emailAddress.message}
                    </Text>
                )}
                
                <TextInput
                className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-6"
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                />
                {errors.fields.password && (
                <Text className="text-red-500 mb-4">
                    {errors.fields.password.message}
                </Text>
                )}

                <TouchableOpacity
                onPress={onSignUpPress}
                disabled={isLoading}
                className="w-full bg-blue-600 py-4 rounded-xl items-center mb-4"
                >
                {isLoading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text className="text-white font-bold text-base">Sign Up</Text>
                 )}
                </TouchableOpacity>

                <View className="flex-row justify-center items-center">
                    <Text className="text-gray-500">Already have an account? </Text>
                    <TouchableOpacity onPress={() => router.push("/sign-in")}>
                        <Text className="text-blue-600 font-semibold">Sign In</Text>
                    </TouchableOpacity>
                </View>

                <View nativeID="clerk-captcha" />
            </View>
        </ScrollView>
        </KeyboardAvoidingView>
    )
}
