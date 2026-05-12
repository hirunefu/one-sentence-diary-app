import React, { useMemo } from 'react';
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import licensesData from '../assets/licenses.json';
import type { LicenseEntry } from '../types/license';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useColors } from '../theme/useColors';
import { PressableScale } from '../components/PressableScale';

const ENTRIES: LicenseEntry[] = licensesData as LicenseEntry[];

type Props = {
  route: RouteProp<RootStackParamList, 'LicenseDetail'>;
};

export function LicenseDetailScreen({ route }: Props) {
  const colors = useColors();
  const { name, version } = route.params;

  const entry = useMemo(
    () => ENTRIES.find((e) => e.name === name && e.version === version),
    [name, version]
  );

  if (!entry) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <Text style={[styles.missing, { color: colors.textMuted }]}>
          ライセンス情報が見つかりませんでした。
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.name, { color: colors.text }]}>{entry.name}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          v{entry.version} · {entry.license}
        </Text>
        {entry.author && (
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            Author: {entry.author}
          </Text>
        )}
        {entry.homepage && (
          <PressableScale
            onPress={() => Linking.openURL(entry.homepage as string)}
            style={styles.homepage}
          >
            <Text style={[styles.homepageText, { color: colors.primary }]}>
              {entry.homepage}
            </Text>
          </PressableScale>
        )}

        <View
          style={[
            styles.divider,
            { backgroundColor: colors.divider, marginVertical: 16 },
          ]}
        />

        {entry.licenseText ? (
          <Text style={[styles.licenseText, { color: colors.text }]}>
            {entry.licenseText}
          </Text>
        ) : (
          <Text style={[styles.licenseText, { color: colors.textMuted }]}>
            ライセンス本文がパッケージに同梱されていません。ライセンス種別:{' '}
            {entry.license}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  name: { fontSize: 20, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 4 },
  homepage: { marginTop: 8, alignSelf: 'flex-start' },
  homepageText: { fontSize: 13, textDecorationLine: 'underline' },
  divider: { height: 1 },
  licenseText: {
    fontFamily: 'Courier',
    fontSize: 12,
    lineHeight: 18,
  },
  missing: { textAlign: 'center', marginTop: 32, fontSize: 14 },
});
