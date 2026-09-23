import React from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { EntriesProvider } from './src/contexts/EntriesContext';
import { AuthLockProvider } from './src/contexts/AuthLockContext';
import { ReminderScheduler } from './src/components/ReminderScheduler';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useIsDark } from './src/theme/useColors';

// Expo Go (Android, SDK 53+) はリモート Push 通知非対応の警告を出すが、
// 本アプリはローカル通知 (毎日定刻のリマインダー) のみ使用するため抑止する。
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
]);

// `style="auto"` follows the system theme, so with the app set to dark on a
// light system (or the reverse) the status-bar icons would match the
// background. Follow the in-app theme instead.
function ThemedStatusBar() {
  const isDark = useIsDark();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <EntriesProvider>
          <AuthLockProvider>
            <ReminderScheduler />
            <ThemedStatusBar />
            <RootNavigator />
          </AuthLockProvider>
        </EntriesProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
