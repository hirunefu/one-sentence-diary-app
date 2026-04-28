import React, { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EntryInput } from '../components/EntryInput';
import { PressableScale } from '../components/PressableScale';
import { useEntries } from '../contexts/EntriesContext';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';
import { radius } from '../theme/radius';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'EntryEditor'>;

export function EntryEditorModal({ route, navigation }: Props) {
  const colors = useColors();
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.loadingMessage }}>読み込み中…</Text>
      </SafeAreaView>
    );
  }

  const isEmpty = text.trim().length === 0;
  const saveBg = isEmpty ? colors.disabled : colors.primary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.date, { color: colors.text }]}>{date}</Text>
      <EntryInput value={text} onChangeText={setText} autoFocus />
      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        {exists && (
          <PressableScale
            onPress={handleDelete}
            style={[styles.actionButton, { backgroundColor: colors.danger }]}
          >
            <Text style={[styles.buttonText, { color: colors.primaryText }]}>削除</Text>
          </PressableScale>
        )}
        <PressableScale
          onPress={handleSave}
          disabled={isEmpty}
          style={[styles.actionButton, { backgroundColor: saveBg }]}
        >
          <Text style={[styles.buttonText, { color: colors.primaryText }]}>保存</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: space.lg + 2,
    paddingTop: space.xl,
    paddingBottom: space.lg + 2,
  },
  date: {
    fontSize: typography.size.title,
    fontWeight: typography.weight.medium,
    marginBottom: space.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.sm,
    marginTop: space.lg,
    paddingTop: space.md + 2,
    borderTopWidth: 1,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
  },
  buttonText: {
    fontSize: typography.size.button,
    fontWeight: typography.weight.medium,
  },
});
