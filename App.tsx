import React from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { EntriesProvider } from './src/contexts/EntriesContext';
import { AuthLockProvider } from './src/contexts/AuthLockContext';
import { RootNavigator } from './src/navigation/RootNavigator';

// Expo Go (Android, SDK 53+) はリモート Push 通知非対応の警告を出すが、
// 本アプリはローカル通知 (毎日定刻のリマインダー) のみ使用するため抑止する。
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
]);

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <EntriesProvider>
          <AuthLockProvider>
            <StatusBar style="auto" />
            <RootNavigator />
          </AuthLockProvider>
        </EntriesProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
