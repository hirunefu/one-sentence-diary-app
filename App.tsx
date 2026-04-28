import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { EntriesProvider } from './src/contexts/EntriesContext';
import { AuthLockProvider } from './src/contexts/AuthLockContext';
import { RootNavigator } from './src/navigation/RootNavigator';

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
