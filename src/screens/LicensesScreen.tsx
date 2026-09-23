import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import licensesData from '../assets/licenses.json';
import type { LicenseEntry } from '../types/license';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useColors } from '../theme/useColors';
import { PressableScale } from '../components/PressableScale';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';

const ENTRIES: LicenseEntry[] = licensesData as LicenseEntry[];

type Nav = NativeStackNavigationProp<RootStackParamList, 'Licenses'>;

export function LicensesScreen() {
  const colors = useColors();
  const navigation = useNavigation<Nav>();

  const renderItem = ({ item }: { item: LicenseEntry }) => (
    <PressableScale
      onPress={() =>
        navigation.navigate('LicenseDetail', {
          name: item.name,
          version: item.version,
        })
      }
      accessibilityLabel={`${item.name} ${item.version} ${item.license}`}
      style={[styles.row, { borderBottomColor: colors.divider }]}
    >
      <View style={styles.rowMain}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {item.version} · {item.license}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.textMuted}
        importantForAccessibility="no"
      />
    </PressableScale>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <FlatList
        data={ENTRIES}
        keyExtractor={(item) => `${item.name}@${item.version}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={[styles.intro, { color: colors.textMuted }]}>
            このアプリは以下のオープンソースソフトウェアを利用しています。各
            パッケージのライセンス本文を確認するには項目をタップしてください。
            ({ENTRIES.length} packages)
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  intro: {
    fontSize: typography.size.button,
    lineHeight: typography.size.button * typography.lineHeight.default,
    paddingVertical: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md + 2,
    borderBottomWidth: 1,
  },
  rowMain: { flex: 1, marginRight: space.md },
  name: { fontSize: typography.size.title, fontWeight: typography.weight.semibold },
  sub: { fontSize: typography.size.caption, marginTop: 2 },
});
