import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ImportStrategy } from '../repositories/entriesRepository';
import { useColors } from '../theme/useColors';
import { PressableScale } from './PressableScale';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';
import { radius } from '../theme/radius';

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
  const reduceMotion = useReduceMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            インポート内容の確認
          </Text>

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
                accessibilityRole="radio"
                accessibilityLabel={`${opt.label}。${opt.description}`}
                accessibilityState={{ checked: isSelected }}
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
    padding: space.xl,
  },
  card: {
    borderRadius: radius.lg,
    padding: space.xl,
  },
  title: {
    fontSize: typography.size.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: space.sm,
  },
  summary: { fontSize: typography.size.button, marginBottom: space.lg },
  sectionTitle: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
    marginBottom: space.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: 1,
  },
  rowText: { flex: 1, paddingRight: space.md },
  label: { fontSize: typography.size.title },
  desc: { fontSize: typography.size.caption, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: space.xl,
    gap: space.md,
  },
  cancelBtn: { paddingVertical: space.md, paddingHorizontal: space.lg },
  cancelText: { fontSize: typography.size.title },
  confirmBtn: {
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
  },
  confirmText: { fontSize: typography.size.title, fontWeight: typography.weight.semibold },
});
