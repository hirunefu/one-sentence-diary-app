import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EntryInput } from '../components/EntryInput';
import { StreakBadge } from '../components/StreakBadge';
import { useEntries } from '../contexts/EntriesContext';
import { today } from '../utils/date';
import { useColors } from '../theme/useColors';

const SAVED_FEEDBACK_MS = 1500;

export function HomeScreen() {
  const colors = useColors();
  const { ready, initError, retryInit, getByDate, upsert, streak } = useEntries();
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todayStr = today();

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const e = await getByDate(todayStr);
      setText(e?.text ?? '');
      setLoaded(true);
    })();
  }, [ready, todayStr, getByDate]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  if (initError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{initError}</Text>
        <Pressable onPress={retryInit} style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={[styles.buttonText, { color: colors.primaryText }]}>再試行</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!ready || !loaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.loadingMessage }}>読み込み中…</Text>
      </SafeAreaView>
    );
  }

  const handleChangeText = (next: string) => {
    setText(next);
    if (justSaved) setJustSaved(false);
  };

  const handleSave = async () => {
    if (text.trim().length === 0) return;
    try {
      setSaving(true);
      await upsert(todayStr, text);
      setJustSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setJustSaved(false), SAVED_FEEDBACK_MS);
    } catch (e) {
      console.error('save failed', e);
      Alert.alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const isEmpty = text.trim().length === 0;
  const buttonDisabled = saving || justSaved || isEmpty;
  const buttonLabel = saving ? '保存中…' : justSaved ? '✓ 保存しました' : '保存';

  const buttonBg = justSaved
    ? colors.success
    : saving || isEmpty
      ? colors.disabled
      : colors.primary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.date, { color: colors.text }]}>{todayStr}</Text>
        <StreakBadge days={streak} />
      </View>
      <View style={styles.body}>
        <EntryInput value={text} onChangeText={handleChangeText} autoFocus />
      </View>
      <Pressable
        onPress={handleSave}
        disabled={buttonDisabled}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: buttonBg },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.primaryText }]}>{buttonLabel}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  date: { fontSize: 18, fontWeight: '600' },
  body: { flex: 1 },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  pressed: { opacity: 0.8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  errorText: { marginBottom: 16, textAlign: 'center' },
});
