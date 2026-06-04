import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

const TAB_BAR_BACKGROUND = '#FFFFFF';
const ACTIVE_TAB_BACKGROUND = '#C4E9FA';
const ACTIVE_TAB_COLOR = '#0B3A75';
const INACTIVE_TAB_COLOR = '#687D92';

function AndroidTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false}}
      backgroundColor={TAB_BAR_BACKGROUND}
      indicatorColor={ACTIVE_TAB_BACKGROUND}
      iconColor={{
        default: INACTIVE_TAB_COLOR,
        selected: ACTIVE_TAB_COLOR,
      }}
      labelStyle={{
        default: { color: INACTIVE_TAB_COLOR },
        selected: { color: ACTIVE_TAB_COLOR },
      }}
      tintColor={ACTIVE_TAB_COLOR}>
      <Tabs.Screen 
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen 
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />
        
      <Tabs.Screen 
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen 
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen 
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
     />

    </Tabs>
  );
}

function IOSTabs() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Label>Home</Label>
        <Icon sf="house.fill"/>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Icon sf="search"/>
        <Label>Search</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="create">
        <Icon sf="plus.circle.fill"/>
        <Label>Add Property</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="saved">
        <Icon sf="heart.fill"/>
        <Label>Saved</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Icon sf="person.fill"/>
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

export default function TabsLayout() {
  return Platform.OS==='ios' ? <IOSTabs /> : 
   <AndroidTabs />;
}
