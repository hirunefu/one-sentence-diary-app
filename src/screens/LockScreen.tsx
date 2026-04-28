import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { authenticate, isLocalAuthAvailable } from '../services/localAuth';
import { useAuthLock } from '../contexts/AuthLockContext';
import { useColors } from '../theme/useColors';

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
        <Text style={[styles.title, { color: colors.text }]}>🔒 ロックされています</Text>
        {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
        <Pressable
          onPress={tryAuth}
          disabled={authenticating}
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
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  title: { fontSize: 18, fontWeight: '500', marginBottom: 32 },
  error: { marginBottom: 16 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  pressed: { opacity: 0.8 },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
