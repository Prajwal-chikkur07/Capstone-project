import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, Alert,
} from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { colors, LANG_LABELS } from '../theme';
import LanguagePicker from '../components/LanguagePicker';

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [defaultLang, setDefaultLang] = useState('hi-IN');

  const firstName = user?.firstName || '';
  const lastName = user?.lastName || '';
  const fullName = user?.fullName || `${firstName} ${lastName}`.trim() || 'User';
  const email = user?.primaryEmailAddress?.emailAddress || '';
  const initial = firstName?.[0] || email?.[0]?.toUpperCase() || '?';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar + Name */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.userName}>{fullName}</Text>
          {email ? <Text style={styles.userEmail}>{email}</Text> : null}
        </View>

        {/* Default Language */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Default Language</Text>
          <Text style={styles.cardDesc}>
            Choose your preferred translation language. This will be pre-selected across screens.
          </Text>
          <View style={styles.langRow}>
            <LanguagePicker selected={defaultLang} onSelect={setDefaultLang} />
            <Text style={styles.langCode}>{defaultLang}</Text>
          </View>
        </View>

        {/* Account Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{fullName}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{email || 'Not set'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={[styles.infoValue, styles.infoMono]}>{user?.id || 'N/A'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Joined</Text>
            <Text style={styles.infoValue}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
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
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.saffronLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 30, fontWeight: '700', color: colors.saffron },
  userName: { fontSize: 20, fontWeight: '700', color: colors.textInk },
  userEmail: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textInk, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: colors.textMuted, marginBottom: 12, lineHeight: 18 },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  langCode: { fontSize: 13, color: colors.textFaded },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  infoValue: { fontSize: 14, color: colors.textInk, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  infoMono: { fontSize: 11, fontFamily: 'Courier' },
  divider: { height: 1, backgroundColor: colors.border },
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
