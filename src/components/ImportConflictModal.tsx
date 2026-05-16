import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ImportStrategy } from '../repositories/entriesRepository';
import { useColors } from '../theme/useColors';
import { PressableScale } from './PressableScale';

type Props = {
  visible: boolean;
  totalCount: number;
  newCount: number;
  conflictCount: number;
  invalidCount: number;
  onCancel: () => void;
  onConfirm: (strategy: ImportStrategy) => void;
};

const STRATEGIES: ReadonlyArray<{
  value: ImportStrategy;
  label: string;
  description: string;
}> = [
  { value: 'overwrite', label: '上書き', description: '既存を消してインポート側に置き換える' },
  { value: 'skip', label: 'スキップ', description: '既存を残してインポート側を捨てる' },
  { value: 'newer', label: '新しい方を採用', description: '更新時刻が新しい方を残す' },
];

export function ImportConflictModal({
  visible,
  totalCount,
  newCount,
  conflictCount,
  invalidCount,
  onCancel,
  onConfirm,
}: Props) {
  const colors = useColors();
  const [strategy, setStrategy] = useState<ImportStrategy>('overwrite');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>インポート内容の確認</Text>

          <Text style={[styles.summary, { color: colors.textMuted }]}>
            合計 {totalCount} 件 (新規 {newCount} / 重複 {conflictCount} / 不正 {invalidCount})
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            重複の扱い
          </Text>

          {STRATEGIES.map((opt) => {
            const isSelected = strategy === opt.value;
            return (
              <PressableScale
                testID={`import-strategy-${opt.value}`}
                key={opt.value}
                onPress={() => setStrategy(opt.value)}
                style={[styles.row, { borderBottomColor: colors.divider }]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.label, { color: colors.text }]}>{opt.label}</Text>
                  <Text style={[styles.desc, { color: colors.textMuted }]}>
                    {opt.description}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark" size={22} color={colors.primary} />
                )}
              </PressableScale>
            );
          })}

          <View style={styles.actions}>
            <PressableScale testID="import-cancel" onPress={onCancel} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>
                キャンセル
              </Text>
            </PressableScale>
            <PressableScale
              testID="import-confirm"
              onPress={() => onConfirm(strategy)}
              style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.confirmText, { color: colors.primaryText }]}>
                インポート実行
              </Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 12,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  summary: { fontSize: 14, marginBottom: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowText: { flex: 1, paddingRight: 12 },
  label: { fontSize: 16 },
  desc: { fontSize: 12, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { fontSize: 16 },
  confirmBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  confirmText: { fontSize: 16, fontWeight: '600' },
});
