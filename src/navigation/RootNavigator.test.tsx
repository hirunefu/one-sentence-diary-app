import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import type { NotificationResponse } from 'expo-notifications';

// The real navigators with stand-in screens, so the test sees where a tap on a
// Reminder lands.
let mockResponseListeners: Array<(response: NotificationResponse) => void> = [];
jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: (listener: (r: unknown) => void) => {
    mockResponseListeners.push(listener);
    return {
      remove: () => {
        mockResponseListeners = mockResponseListeners.filter((l) => l !== listener);
      },
    };
  },
}));
let mockLocked = false;
jest.mock('../contexts/AuthLockContext', () => ({ useAuthLock: () => ({ isLocked: mockLocked }) }));
jest.mock('../contexts/SettingsContext', () => ({ useSettings: () => ({ ready: true }) }));
jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return { useColors: () => lightColors, useIsDark: () => false };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
// A function declaration, so the hoisted jest.mock factories can call it.
function mockScreen(name: string) {
  return function StandIn() {
    return <Text>{name}</Text>;
  };
}
jest.mock('../screens/HomeScreen', () => ({ HomeScreen: mockScreen('home') }));
jest.mock('../screens/HistoryScreen', () => ({ HistoryScreen: mockScreen('history') }));
jest.mock('../screens/SettingsScreen', () => ({ SettingsScreen: mockScreen('settings') }));
jest.mock('../screens/EntryEditorModal', () => ({ EntryEditorModal: mockScreen('editor') }));
jest.mock('../screens/LicensesScreen', () => ({ LicensesScreen: mockScreen('licenses') }));
jest.mock('../screens/LicenseDetailScreen', () => ({
  LicenseDetailScreen: mockScreen('license-detail'),
}));
jest.mock('../screens/LockScreen', () => ({ LockScreen: mockScreen('lock') }));

import { navigationRef, RootNavigator } from './RootNavigator';
import { REMINDER_NOTIFICATION_ID_PREFIX } from '../services/notifications';

const response = (identifier: string) =>
  ({
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: { request: { identifier, content: {}, trigger: null }, date: 0 },
  }) as unknown as NotificationResponse;
const tapReminder = () =>
  act(async () => {
    for (const l of mockResponseListeners) l(response(`${REMINDER_NOTIFICATION_ID_PREFIX}2026-09-25`));
  });
const current = () => navigationRef.getCurrentRoute()?.name;
const go = (fn: () => void) => act(async () => fn());

beforeEach(() => {
  mockResponseListeners = [];
  mockLocked = false;
});

// The Reminder is titled 「今日の一文」 and asks the day's Prompt, which Home
// shows; a tap brings the app back where it was unless it says where to go.
describe('a tap on a Reminder', () => {
  test('shows Home from another tab', async () => {
    await render(<RootNavigator />);
    await go(() => navigationRef.navigate('MainTabs', { screen: 'Settings' }));
    expect(current()).toBe('Settings');
    await tapReminder();
    expect(current()).toBe('Home');
  });

  test('closes a screen pushed over the tabs', async () => {
    await render(<RootNavigator />);
    await go(() => navigationRef.navigate('MainTabs', { screen: 'Settings' }));
    await go(() => navigationRef.navigate('Licenses'));
    await go(() => navigationRef.navigate('LicenseDetail', { name: 'x', version: '1' }));
    await tapReminder();
    expect(current()).toBe('Home');
    expect(navigationRef.getRootState()?.routes.map((r) => r.name)).toEqual(['MainTabs']);
  });

  // The editor keeps no draft: closing it would throw away what is being written.
  test('keeps an open editor, with Home under it', async () => {
    await render(<RootNavigator />);
    await go(() => navigationRef.navigate('MainTabs', { screen: 'History' }));
    await go(() => navigationRef.navigate('EntryEditor', { date: '2026-09-24' }));
    await tapReminder();
    expect(current()).toBe('EntryEditor');
    await go(() => navigationRef.goBack());
    expect(current()).toBe('Home');
  });

  test('another notification leaves the app where it was', async () => {
    await render(<RootNavigator />);
    await go(() => navigationRef.navigate('MainTabs', { screen: 'Settings' }));
    await act(async () => {
      for (const l of mockResponseListeners) l(response('something-else'));
    });
    expect(current()).toBe('Settings');
  });

  test('does nothing behind the lock screen, which opens on Home', async () => {
    mockLocked = true;
    const view = await render(<RootNavigator />);
    await tapReminder();
    expect(view.getByText('lock')).toBeTruthy();
    mockLocked = false;
    await view.rerender(<RootNavigator />);
    expect(current()).toBe('Home');
  });
});
