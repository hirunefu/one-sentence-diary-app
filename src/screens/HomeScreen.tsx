import React, { useEffect, useState } from 'react';
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

export function HomeScreen() {
  const { ready, initError, retryInit, getByDate, upsert, streak } = useEntries();
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const todayStr = today();

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const e = await getByDate(todayStr);
      setText(e?.text ?? '');
      setLoaded(true);
    })();
  }, [ready, todayStr, getByDate]);

  if (initError) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{initError}</Text>
        <Pressable onPress={retryInit} style={styles.button}>
          <Text style={styles.buttonText}>再試行</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!ready || !loaded) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>読み込み中…</Text>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    if (text.trim().length === 0) return;
    try {
      setSaving(true);
      await upsert(todayStr, text);
      Alert.alert('保存しました');
    } catch (e) {
      console.error('save failed', e);
      Alert.alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.date}>{todayStr}</Text>
        <StreakBadge days={streak} />
      </View>
      <View style={styles.body}>
        <EntryInput value={text} onChangeText={setText} autoFocus />
      </View>
      <Pressable
        onPress={handleSave}
        disabled={saving || text.trim().length === 0}
        style={({ pressed }) => [
          styles.button,
          (saving || text.trim().length === 0) && styles.buttonDisabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.buttonText}>保存</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fafafa' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  date: { fontSize: 18, fontWeight: '600' },
  body: { flex: 1 },
  button: {
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: { backgroundColor: '#bbb' },
  pressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { color: '#c00', marginBottom: 16, textAlign: 'center' },
});
