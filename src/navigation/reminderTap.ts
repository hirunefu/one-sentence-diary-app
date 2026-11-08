import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import {
  StackActions,
  TabActions,
  type NavigationContainerRef,
} from '@react-navigation/native';
import { REMINDER_NOTIFICATION_ID_PREFIX } from '../services/notifications';
import type { RootStackParamList } from './RootNavigator';

// A Reminder is titled 「今日の一文」 and asks the day's Prompt, which Home shows
// in its empty field, so a tap on it shows Home. Without this, a tap while the
// app is still running brings it back on whatever screen was last open. A cold
// start and the lock screen already open on Home.
export function showHomeForReminder(nav: NavigationContainerRef<RootStackParamList>): void {
  const state = nav.isReady() ? nav.getRootState() : undefined;
  if (!state) return;
  const tabs = state.routes.find((r) => r.name === 'MainTabs')?.state;
  if (tabs?.key) nav.dispatch({ ...TabActions.jumpTo('Home'), target: tabs.key });
  // The editor keeps no draft, so it stays open with Home under it rather than
  // throw away what is being written. Other screens over the tabs close.
  const top = state.routes[state.index]?.name;
  if (top !== 'MainTabs' && top !== 'EntryEditor') nav.dispatch(StackActions.popToTop());
}

export function useReminderTap(nav: NavigationContainerRef<RootStackParamList>): void {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.identifier.startsWith(REMINDER_NOTIFICATION_ID_PREFIX)) {
        showHomeForReminder(nav);
      }
    });
    return () => sub.remove();
  }, [nav]);
}
