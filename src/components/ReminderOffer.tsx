import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Phrases } from './Phrases';
import { OutlinedButton } from './OutlinedButton';
import { useFade } from './FirstRunLines';
import {
  REMINDER_OFFER_ACCEPT,
  REMINDER_OFFER_ACCEPT_HINT,
  REMINDER_OFFER_DECLINE,
  REMINDER_OFFER_DECLINE_HINT,
  type reminderSetCopy,
} from '../services/firstRunCopy';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';

// The one Reminder offer on a first-time user's first day: one line and two
// equal buttons, inline like the Streak repair offer (Material banner: the
// dismissive action first). While Android's own screen is being answered the
// card stays, with both buttons disabled.
export function ReminderOffer({
  line,
  asking,
  onDecline,
  onAccept,
}: {
  line: string;
  asking: boolean;
  onDecline: () => void;
  onAccept: () => void;
}) {
  const colors = useColors();
  const opacity = useFade(1, 0);
  return (
    <Animated.View testID="reminder-offer" style={[styles.box, { opacity }]}>
      <View accessible accessibilityLabel={line}>
        <Phrases text={line} align="right" style={[styles.text, { color: colors.textMuted }]} />
      </View>
      <View style={styles.buttons}>
        <OutlinedButton
          testID="reminder-offer-decline"
          label={REMINDER_OFFER_DECLINE}
          hint={REMINDER_OFFER_DECLINE_HINT}
          disabled={asking}
          onPress={onDecline}
        />
        <OutlinedButton
          testID="reminder-offer-accept"
          label={REMINDER_OFFER_ACCEPT}
          hint={REMINDER_OFFER_ACCEPT_HINT}
          disabled={asking}
          onPress={onAccept}
        />
      </View>
    </Animated.View>
  );
}

// After the offer turned Reminders on: what was set, and where to change it.
export function ReminderSetLine({
  copy,
  ref,
}: {
  copy: ReturnType<typeof reminderSetCopy>;
  ref?: React.Ref<View>;
}) {
  const colors = useColors();
  const opacity = useFade(1, 0);
  const text = [styles.text, { color: colors.textMuted }];
  return (
    <Animated.View
      ref={ref}
      testID="reminder-set"
      accessible
      accessibilityLabel={copy.spoken}
      style={[styles.right, { opacity }]}
    >
      <Phrases text={copy.line} align="right" style={text} />
      <Phrases text={copy.note} align="right" style={text} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    gap: space.xs,
  },
  right: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  text: {
    fontSize: typography.size.caption,
    lineHeight: typography.size.caption + 6,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: space.sm,
  },
});
