import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { colors } from '../theme';
import * as api from '../services/api';

export default function SettingsScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();

  const handleClearCache = async () => {
    try {
      const result = await api.clearCache();
      Alert.alert('Cache Cleared', `Deleted ${result.deleted} entries.`);
    } catch {
      Alert.alert('Error', 'Could not clear cache.');
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.firstName?.[0] || '?'}</Text>
            </View>
            <View>
              <Text style={styles.profileName}>{user?.fullName || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.primaryEmailAddress?.emailAddress || ''}</Text>
            </View>
          </View>
        </View>

        {/* Cache */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Translation Cache</Text>
          <Text style={styles.cardDesc}>Clear cached translations to free space or force fresh translations.</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={handleClearCache} activeOpacity={0.7}>
            <Text style={styles.actionBtnText}>Clear Cache</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textInk },
  content: { padding: 20, gap: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.saffronLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.saffron },
  profileName: { fontSize: 16, fontWeight: '700', color: colors.textInk },
  profileEmail: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textInk, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: colors.textMuted, marginBottom: 12, lineHeight: 18 },
  actionBtn: {
    backgroundColor: colors.surfaceInk,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: colors.white },
  signOutBtn: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: colors.red },
});
