import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { colors, LANG_LABELS } from '../theme';
import * as api from '../services/api';

export default function AnalyticsScreen() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getCacheStats();
      setStats(data);
    } catch {
      Alert.alert('Error', 'Could not load cache stats.');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const StatCard = ({ label, value, accent }) => (
    <View style={[styles.statCard, accent && { borderLeftWidth: 3, borderLeftColor: accent }]}>
      <Text style={styles.statValue}>{value ?? '--'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={fetchStats}
          activeOpacity={0.7}
          disabled={isLoading}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && !stats ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.saffron} />
            <Text style={styles.loadingText}>Loading stats...</Text>
          </View>
        ) : stats ? (
          <>
            {/* Overview */}
            <Text style={styles.sectionTitle}>Cache Overview</Text>
            <View style={styles.statRow}>
              <StatCard
                label="Total Entries"
                value={stats.total_entries}
                accent={colors.saffron}
              />
              <StatCard
                label="Total Hits"
                value={stats.total_hits}
                accent={colors.green}
              />
            </View>

            {/* By Language Breakdown */}
            {stats.by_language && Object.keys(stats.by_language).length > 0 && (
              <>
                <Text style={styles.sectionTitle}>By Language</Text>
                {Object.entries(stats.by_language).map(([langCode, langStats]) => (
                  <View key={langCode} style={styles.langCard}>
                    <View style={styles.langHeader}>
                      <View style={[styles.dot, { backgroundColor: colors.saffron }]} />
                      <Text style={styles.langName}>
                        {LANG_LABELS[langCode] || langCode}
                      </Text>
                      <Text style={styles.langCode}>{langCode}</Text>
                    </View>
                    <View style={styles.langStats}>
                      <View style={styles.langStatItem}>
                        <Text style={styles.langStatValue}>
                          {langStats.entries ?? langStats.count ?? langStats}
                        </Text>
                        <Text style={styles.langStatLabel}>Entries</Text>
                      </View>
                      {langStats.hits != null && (
                        <View style={styles.langStatItem}>
                          <Text style={styles.langStatValue}>{langStats.hits}</Text>
                          <Text style={styles.langStatLabel}>Hits</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Raw data fallback */}
            {(!stats.by_language || Object.keys(stats.by_language).length === 0) && (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No per-language breakdown available.</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No data available. Tap Refresh to try again.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textInk },
  refreshBtn: {
    backgroundColor: colors.saffron,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  refreshText: { fontSize: 13, fontWeight: '600', color: colors.white },
  content: { padding: 20, paddingBottom: 40 },
  loadingContainer: { alignItems: 'center', paddingTop: 60, gap: 12 },
  loadingText: { fontSize: 14, color: colors.textMuted },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textInk,
    marginBottom: 12,
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statValue: { fontSize: 32, fontWeight: '700', color: colors.textInk },
  statLabel: { fontSize: 13, color: colors.textMuted, marginTop: 4, fontWeight: '500' },
  langCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  langHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  langName: { fontSize: 15, fontWeight: '600', color: colors.textInk, flex: 1 },
  langCode: { fontSize: 12, color: colors.textFaded },
  langStats: {
    flexDirection: 'row',
    padding: 16,
    gap: 24,
  },
  langStatItem: { alignItems: 'center' },
  langStatValue: { fontSize: 20, fontWeight: '700', color: colors.textInk },
  langStatLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
