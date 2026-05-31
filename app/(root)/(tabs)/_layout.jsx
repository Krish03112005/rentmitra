import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';

const TAB_BAR_BACKGROUND = '#FFFFFF';
const ACTIVE_TAB_BACKGROUND = '#C4E9FA';
const ACTIVE_TAB_COLOR = '#0B3A75';
const INACTIVE_TAB_COLOR = '#687D92';

export default function TabLayout() {
  return (
    <NativeTabs
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
      <NativeTabs.Trigger name="index">
        <Label>Home</Label>
        <Icon src={<VectorIcon family={Ionicons} name="home" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search">
        <Icon src={<VectorIcon family={Ionicons} name="search" />} />
        <Label>Search</Label>
      </NativeTabs.Trigger>

      {/* Create Property Button */}

      <NativeTabs.Trigger name="saved">
        <Icon src={<VectorIcon family={Ionicons} name="bookmark" />} />
        <Label>Saved</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Icon src={<VectorIcon family={Ionicons} name="person" />} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
