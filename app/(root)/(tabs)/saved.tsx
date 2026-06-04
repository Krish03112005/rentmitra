import { View, Text, ActivityIndicator, FlatList } from 'react-native'
import React, { useCallback, useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@clerk/expo'
import { useSupabase } from '@/hooks/useSupabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { Property } from '@/types';
import PropertyCard from '@/components/PropertyCard';
import { Ionicons } from '@expo/vector-icons';

interface SavedProperty {
  id: string;
  property_id: string;
  properties: Property;
}

export default function Saved() {

  const { userId } = useAuth();
  const authSupabase = useSupabase();
  const router = useRouter();

  const [ saved, setSaved ] = useState<SavedProperty[]>([]);
  const [ loading, setLoading ] = useState(true);

  const fetchSaved = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data } = await authSupabase
      .from("saved_properties")
      .select("id, property_id, properties(*)")
      .eq("user_clerk_id", userId)
      .order("id", {ascending: false})

    setSaved((data as unknown as SavedProperty[]) ?? []);
    setLoading(false);
  },[userId]);

  useFocusEffect(
    useCallback(() => {
      fetchSaved();
    }, [fetchSaved]),
  );

  return (
    <SafeAreaView className='flex-1 bg-gray-50'>
      <View className='px-5 pt-4 pb-3'>
        <Text className='text-gray-900 font-bold text-2xl'>Saved</Text>
        {!loading && (
          <Text className='text-sm text-gray-400 mt-1'>
            {saved.length} {saved.length === 1 ? "property" : "properties"}
            {" "}
            Saved
          </Text>
        )}
      </View>

      {loading ? (
        <View className='flex-1 items-center justify-center'>
          <ActivityIndicator size="large" color="#2563EB"/>
        </View> 
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100}}  
          showsVerticalScrollIndicator={false}
          renderItem={({item}) => (
            <PropertyCard 
              property={item.properties}
              onUnsave={() => 
                setSaved((prev) => prev.filter((s) => s.id !==item.id))
              }
              showSave
            />
          )}

          ListEmptyComponent={
            <View className='flex-1 items-center justify-center py-24'>
              <View className='w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-4'>
                <Ionicons name='heart-outline' size={36} color="#EF4444"/>
              </View>
              <Text className='text-gray-700 text-lg font-bold mb-1'>
                No Saved Properties
              </Text>
              <Text className='text-gray-400 text-sm text-center px-8'>
                Tap the heart icon on any property to save it here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}







