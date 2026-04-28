import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EntryInput } from '../components/EntryInput';
import { useEntries } from '../contexts/EntriesContext';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'EntryEditor'>;

export function EntryEditorModal({ route, navigation }: Props) {
  const { date } = route.params;
  const { getByDate, upsert, remove } = useEntries();
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    (async () => {
      const e = await getByDate(date);
      setText(e?.text ?? '');
      setExists(e !== null);
      setLoaded(true);
    })();
  }, [date, getByDate]);

  const handleSave = async () => {
    if (text.trim().length === 0) return;
    try {
      await upsert(date, text);
      navigation.goBack();
    } catch {
      Alert.alert('保存に失敗しました');
    }
  };

  const handleDelete = () => {
    Alert.alert('削除しますか？', `${date} のエントリを削除します`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(date);
            navigation.goBack();
          } catch {
            Alert.alert('削除に失敗しました');
          }
        },
      },
    ]);
  };

  if (!loaded) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>読み込み中…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.date}>{date}</Text>
      <EntryInput value={text} onChangeText={setText} autoFocus />
      <View style={styles.row}>
        {exists && (
          <Pressable onPress={handleDelete} style={[styles.button, styles.delete]}>
            <Text style={styles.buttonText}>削除</Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleSave}
          disabled={text.trim().length === 0}
          style={[
            styles.button,
            styles.save,
            text.trim().length === 0 && styles.disabled,
          ]}
        >
          <Text style={styles.buttonText}>保存</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fafafa' },
  date: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  row: { flexDirection: 'row', marginTop: 16, gap: 8 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  save: { backgroundColor: '#1976d2' },
  delete: { backgroundColor: '#c62828' },
  disabled: { backgroundColor: '#bbb' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
