import { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { colors, LANG_LABELS } from '../theme';
import * as api from '../services/api';
import LanguagePicker from '../components/LanguagePicker';

export default function DictionaryScreen() {
  const [selectedLang, setSelectedLang] = useState('hi-IN');
  const [searchText, setSearchText] = useState('');
  const [currentResult, setCurrentResult] = useState(null);
  const [recentLookups, setRecentLookups] = useState([]);
  const [isTranslating, setIsTranslating] = useState(false);

  const debounceRef = useRef(null);

  const handleLookup = useCallback(async (word, lang) => {
    if (!word.trim()) return;
    setIsTranslating(true);

    try {
      const translated = await api.translateText(word.trim(), lang);
      const entry = {
        id: Date.now(),
        original: word.trim(),
        translated,
        language: lang,
      };
      setCurrentResult(entry);
      setRecentLookups((prev) => {
        const filtered = prev.filter(
          (item) => !(item.original.toLowerCase() === word.trim().toLowerCase() && item.language === lang)
        );
        return [entry, ...filtered].slice(0, 20);
      });
    } catch {
      setCurrentResult({
        id: Date.now(),
        original: word.trim(),
        translated: 'Translation failed. Try again.',
        language: lang,
        error: true,
      });
    }
    setIsTranslating(false);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    handleLookup(searchText, selectedLang);
  }, [searchText, selectedLang, handleLookup]);

  const handleTextChange = useCallback((text) => {
    setSearchText(text);
    // Auto-translate after user stops typing
    clearTimeout(debounceRef.current);
    if (text.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        handleLookup(text, selectedLang);
      }, 800);
    }
  }, [selectedLang, handleLookup]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dictionary</Text>
        <LanguagePicker selected={selectedLang} onSelect={setSelectedLang} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Search Input */}
        <View style={styles.searchCard}>
          <TextInput
            value={searchText}
            onChangeText={handleTextChange}
            onSubmitEditing={handleSearchSubmit}
            placeholder="Type a word to translate..."
            placeholderTextColor={colors.textFaded}
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.searchBtn, (!searchText.trim() || isTranslating) && styles.searchBtnDisabled]}
            onPress={handleSearchSubmit}
            disabled={!searchText.trim() || isTranslating}
            activeOpacity={0.7}
          >
            {isTranslating ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.searchBtnText}>Look up</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Current Result */}
        {currentResult && (
          <View style={[styles.resultCard, currentResult.error && styles.resultCardError]}>
            <View style={styles.resultHeader}>
              <View style={[styles.dot, { backgroundColor: colors.green }]} />
              <Text style={styles.resultLangLabel}>English</Text>
            </View>
            <Text style={styles.resultOriginal}>{currentResult.original}</Text>

            <View style={styles.resultDivider} />

            <View style={styles.resultHeader}>
              <View style={[styles.dot, { backgroundColor: colors.saffron }]} />
              <Text style={styles.resultLangLabel}>
                {LANG_LABELS[currentResult.language] || currentResult.language}
              </Text>
            </View>
            <Text style={[styles.resultTranslated, currentResult.error && styles.resultError]}>
              {currentResult.translated}
            </Text>
          </View>
        )}

        {/* Recent Lookups */}
        {recentLookups.length > 0 && (
          <>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Recent Lookups</Text>
              <TouchableOpacity onPress={() => setRecentLookups([])} activeOpacity={0.7}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {recentLookups.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.recentItem}
                onPress={() => {
                  setSearchText(item.original);
                  setCurrentResult(item);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.recentContent}>
                  <Text style={styles.recentOriginal}>{item.original}</Text>
                  <Text style={styles.recentTranslated} numberOfLines={1}>
                    {item.translated}
                  </Text>
                </View>
                <Text style={styles.recentLang}>
                  {LANG_LABELS[item.language] || item.language}
                </Text>
              </TouchableOpacity>
            ))}
          </>
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
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  searchCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  searchInput: {
    padding: 16,
    fontSize: 16,
    color: colors.textInk,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBtn: {
    backgroundColor: colors.saffron,
    margin: 12,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchBtnDisabled: { opacity: 0.4 },
  searchBtnText: { fontSize: 14, fontWeight: '600', color: colors.white },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  resultCardError: { borderColor: '#FECACA' },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  resultLangLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  resultOriginal: { fontSize: 22, fontWeight: '700', color: colors.textInk, marginBottom: 4 },
  resultDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  resultTranslated: { fontSize: 22, fontWeight: '600', color: colors.saffron },
  resultError: { color: colors.red, fontSize: 14 },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recentTitle: { fontSize: 15, fontWeight: '700', color: colors.textInk },
  clearText: { fontSize: 13, fontWeight: '600', color: colors.saffron },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentContent: { flex: 1 },
  recentOriginal: { fontSize: 14, fontWeight: '600', color: colors.textInk },
  recentTranslated: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  recentLang: {
    fontSize: 11,
    color: colors.textFaded,
    backgroundColor: colors.bg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    fontWeight: '500',
  },
});
