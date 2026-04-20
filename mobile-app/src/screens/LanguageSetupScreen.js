import { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { colors, LANG_LABELS } from '../theme';

const LANG_LIST = Object.entries(LANG_LABELS).map(([code, name]) => ({ code, name }));

export default function LanguageSetupScreen({ navigation }) {
  const [selected, setSelected] = useState([]);

  const toggle = (code) => {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Choose your languages</Text>
        <Text style={styles.subtitle}>Select the languages you speak</Text>

        <FlatList
          data={LANG_LIST}
          keyExtractor={(item) => item.code}
          numColumns={2}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.langCard, selected.includes(item.code) && styles.langCardActive]}
              onPress={() => toggle(item.code)}
              activeOpacity={0.7}
            >
              <Text style={[styles.langName, selected.includes(item.code) && styles.langNameActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />

        <TouchableOpacity
          style={[styles.continueBtn, selected.length === 0 && { opacity: 0.4 }]}
          disabled={selected.length === 0}
          onPress={() => navigation.replace('Main')}
          activeOpacity={0.8}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: colors.textInk, marginBottom: 4 },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: 24 },
  grid: { gap: 12 },
  langCard: {
    flex: 1,
    margin: 4,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  langCardActive: {
    backgroundColor: colors.saffronLight,
    borderColor: colors.saffron,
  },
  langName: { fontSize: 15, fontWeight: '600', color: colors.textInk },
  langNameActive: { color: colors.saffron },
  continueBtn: {
    backgroundColor: colors.saffron,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  continueBtnText: { fontSize: 17, fontWeight: '700', color: colors.white },
});
