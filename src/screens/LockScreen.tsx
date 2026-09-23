import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authenticate, isLocalAuthAvailable } from '../services/localAuth';
import { useAuthLock } from '../contexts/AuthLockContext';
import { useColors } from '../theme/useColors';
import { typography } from '../theme/typography';
import { space } from '../theme/spacing';
import { radius } from '../theme/radius';

export function LockScreen() {
  const colors = useColors();
  const { unlock } = useAuthLock();
  const [error, setError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  const tryAuth = useCallback(async () => {
    setError(null);
    setAuthenticating(true);
    try {
      const available = await isLocalAuthAvailable();
      if (!available) {
        setError('設定アプリから生体認証を有効にしてください');
        return;
      }
      const ok = await authenticate();
      if (ok) {
        unlock();
      } else {
        setError('認証に失敗しました');
      }
    } finally {
      setAuthenticating(false);
    }
  }, [unlock]);

  useEffect(() => {
    tryAuth();
  }, [tryAuth]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* A monochrome icon instead of the 🔒 emoji, which renders in colour. */}
        <Ionicons
          name="lock-closed-outline"
          size={32}
          color={colors.text}
          style={styles.icon}
          importantForAccessibility="no"
        />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          ロックされています
        </Text>
        {error && (
          <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.error }]}>
            {error}
          </Text>
        )}
        <Pressable
          testID="lock-authenticate"
          onPress={tryAuth}
          disabled={authenticating}
          accessibilityRole="button"
          accessibilityState={{ disabled: authenticating, busy: authenticating }}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.primaryText }]}>
            {authenticating ? '認証中…' : '認証する'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.lg },
  icon: { marginBottom: space.md },
  title: {
    fontSize: typography.size.heading,
    fontWeight: typography.weight.medium,
    marginBottom: space.xxl,
  },
  error: { marginBottom: space.lg },
  button: {
    paddingVertical: space.md,
    paddingHorizontal: space.xxl,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.8 },
  buttonText: { fontSize: typography.size.title, fontWeight: typography.weight.semibold },
});
