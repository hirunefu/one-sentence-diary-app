import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { EntryEditorModal } from '../screens/EntryEditorModal';
import { LockScreen } from '../screens/LockScreen';
import { useAuthLock } from '../contexts/AuthLockContext';
import { useSettings } from '../contexts/SettingsContext';
import { useColors, useIsDark } from '../theme/useColors';
import { View, Text } from 'react-native';

export type RootStackParamList = {
  MainTabs: undefined;
  EntryEditor: { date: string };
};

export type MainTabsParamList = {
  Home: undefined;
  History: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabsParamList>();

function MainTabs() {
  const colors = useColors();
  return (
    <Tabs.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.divider },
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.text,
      }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: '今日',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'create' : 'create-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: '履歴',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: '設定',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
}

function buildNavTheme(isDark: boolean, colors: ReturnType<typeof useColors>) {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.divider,
    },
  };
}

export function RootNavigator() {
  const colors = useColors();
  const isDark = useIsDark();
  const { isLocked } = useAuthLock();
  const { ready } = useSettings();

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.loadingMessage }}>起動中…</Text>
      </View>
    );
  }

  if (isLocked) {
    return <LockScreen />;
  }

  const navTheme = buildNavTheme(isDark, colors);

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EntryEditor"
          component={EntryEditorModal}
          options={{ presentation: 'modal', title: '編集' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
