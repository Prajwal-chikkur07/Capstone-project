import { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { colors, LANG_LABELS } from '../theme';
import * as api from '../services/api';
import LanguagePicker from '../components/LanguagePicker';

export default function EnglishToNativeScreen() {
  const { user } = useUser();
  const [selectedLang, setSelectedLang] = useState('kn-IN');
  const [englishText, setEnglishText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = useCallback(async () => {
    if (!englishText.trim()) return;
    setIsTranslating(true);
    try {
      const result = await api.translateText(englishText, selectedLang, user?.id || null);
      setTranslatedText(result);
    } catch {
      setTranslatedText('Translation failed. Try again.');
    }
    setIsTranslating(false);
  }, [englishText, selectedLang, user?.id]);

  const handleLangChange = useCallback((lang) => {
    setSelectedLang(lang);
    if (englishText.trim() && translatedText) {
      // Re-translate with new language
      setIsTranslating(true);
      api.translateText(englishText, lang, user?.id || null)
        .then(setTranslatedText)
        .catch(() => setTranslatedText('Translation failed.'))
        .finally(() => setIsTranslating(false));
    }
  }, [englishText, translatedText, user?.id]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>English to Native</Text>
        <LanguagePicker selected={selectedLang} onSelect={handleLangChange} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* English Input */}
        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <View style={[styles.dot, { backgroundColor: colors.green }]} />
            <Text style={styles.inputLabel}>English</Text>
          </View>
          <TextInput
            value={englishText}
            onChangeText={setEnglishText}
            placeholder="Type in English..."
            placeholderTextColor={colors.textFaded}
            multiline
            style={styles.textInput}
          />
        </View>

        {/* Translate Button */}
        <TouchableOpacity
          style={[styles.translateBtn, (!englishText.trim() || isTranslating) && styles.translateBtnDisabled]}
          onPress={handleTranslate}
          disabled={!englishText.trim() || isTranslating}
          activeOpacity={0.8}
        >
          {isTranslating ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.translateBtnText}>Translate</Text>
          )}
        </TouchableOpacity>

        {/* Native Output */}
        {translatedText ? (
          <View style={styles.outputCard}>
            <View style={styles.inputHeader}>
              <View style={[styles.dot, { backgroundColor: colors.saffron }]} />
              <Text style={styles.inputLabel}>{LANG_LABELS[selectedLang] || 'Native'}</Text>
            </View>
            <Text style={styles.outputText}>{translatedText}</Text>
          </View>
        ) : null}
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
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: colors.textInk },
  textInput: {
    padding: 16,
    fontSize: 16,
    color: colors.textInk,
    minHeight: 160,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  translateBtn: {
    backgroundColor: colors.saffron,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.saffron,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  translateBtnDisabled: { opacity: 0.4 },
  translateBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  outputCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  outputText: {
    padding: 16,
    fontSize: 16,
    color: colors.textInk,
    lineHeight: 26,
  },
});
