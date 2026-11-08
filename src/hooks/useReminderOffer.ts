import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useEntries } from '../contexts/EntriesContext';
import { useSettings } from '../contexts/SettingsContext';
import { useAppActive } from './useAppActive';
import { notificationPermission, type NotificationPermission } from '../services/notifications';
import { reminderOfferLine, reminderSetCopy } from '../services/firstRunCopy';
import { today } from '../utils/date';

// 'set': Reminders are on. 'refused': Android's dialog said no (or was swiped
// away). 'unavailable': no dialog could appear (notifications are off outside
// the app).
export type OfferAnswer = 'declined' | 'set' | 'refused' | 'unavailable';

// Android 13+ opens its permission screen even when there is nothing to ask
// (a refusal it keeps, for instance) and closes it at once, so the app going
// away is not enough: someone answering takes longer than this.
const DIALOG_MIN_MS = 400;

// The one Reminder offer of a first-time user's first day on Home (Q24, ADR
// 0002): open until answered, for the rest of that day. Home adds where it may
// show (keyboard, saved feedback, celebration, repair offer, room).
export function useReminderOffer({
  beforeChange,
  onAnswered,
}: {
  // Runs just before the card leaves or turns into the confirmation.
  beforeChange: () => void;
  // Called with the app in front. afterDialog: it was away for Android's
  // screen, and has just come back.
  onAnswered: (how: OfferAnswer, afterDialog: boolean) => void;
}) {
  const { firstRun, answerReminderOffer, reminderSetDay, setReminderSetDay } = useEntries();
  const { settings, ready: settingsReady, enableReminders } = useSettings();
  const active = useAppActive();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [asking, setAsking] = useState(false);

  const offerOpen = firstRun?.kind === 'started' && firstRun.offer === 'open';
  const mayOffer = firstRun?.kind === 'new' || offerOpen;

  // Known before the offer opens, and again on coming back to the app (the
  // user may have changed it in the system settings).
  useEffect(() => {
    if (!mayOffer || !active) return;
    let live = true;
    notificationPermission()
      .then((p) => live && setPermission(p))
      .catch(() => live && setPermission('askable'));
    return () => {
      live = false;
    };
  }, [mayOffer, active]);

  // An offer that could not help closes without being shown: Reminders are
  // already on, or this app's own request was refused for good.
  useEffect(() => {
    if (offerOpen && !asking && (settings.reminderEnabled || permission === 'blocked')) {
      answerReminderOffer();
    }
  }, [offerOpen, asking, settings.reminderEnabled, permission, answerReminderOffer]);

  const open =
    offerOpen && settingsReady && !settings.reminderEnabled && permission !== null && permission !== 'blocked';

  const decline = useCallback(() => {
    beforeChange();
    answerReminderOffer();
    onAnswered('declined', false);
  }, [beforeChange, answerReminderOffer, onAnswered]);

  const accept = useCallback(async () => {
    if (asking) return;
    setAsking(true);
    // Answered first, so a dialog interrupted by the app being killed never
    // brings the offer back. The card stays while asking.
    answerReminderOffer();
    // How long the app was away for Android's permission screen.
    let awayAt: number | null = null;
    let away = 0;
    let back: (() => void) | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') awayAt = Date.now();
      else if (state === 'active' && awayAt !== null) {
        away += Date.now() - awayAt;
        awayAt = null;
        back?.();
      }
    });
    const on = await enableReminders();
    // Answered while still away: the answer is told once the app is back.
    if (awayAt !== null) await new Promise<void>((resolve) => (back = resolve));
    sub.remove();
    const sawDialog = away >= DIALOG_MIN_MS;
    beforeChange();
    // Confirmed on the day the answer came, also after midnight.
    if (on) setReminderSetDay(today());
    setAsking(false);
    onAnswered(on ? 'set' : sawDialog ? 'refused' : 'unavailable', sawDialog);
  }, [asking, answerReminderOffer, enableReminders, beforeChange, setReminderSetDay, onAnswered]);

  return {
    open,
    asking,
    permission,
    line: reminderOfferLine(settings.reminderHour, settings.reminderMinute),
    decline,
    accept,
    set:
      reminderSetDay !== null ? reminderSetCopy(settings.reminderHour, settings.reminderMinute) : null,
  };
}
