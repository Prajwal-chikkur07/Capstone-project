import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { Audio } from 'expo-av';
import { colors, LANG_LABELS } from '../theme';
import * as api from '../services/api';

const { height: SCREEN_H } = Dimensions.get('window');

export default function FloatingWidget({ visible, onClose, defaultLang = 'kn-IN' }) {
  const { user } = useUser();
  const [mode, setMode] = useState('speak'); // 'speak' | 'type'
  const [lang, setLang] = useState(defaultLang);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [translated, setTranslated] = useState('');
  const [typedText, setTypedText] = useState('');
  const [recSeconds, setRecSeconds] = useState(0);
  const recordingRef = useRef(null);
  const timerRef = useRef(null);

  const reset = () => {
    setTranscript('');
    setTranslated('');
    setTypedText('');
  };

  const startRec = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setRecSeconds(0);
      reset();
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {}
  }, []);

  const stopRec = useCallback(async () => {
    clearInterval(timerRef.current);
    setIsRecording(false);
    setIsLoading(true);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const data = await api.translateAudioFromBlob(uri, 'widget.m4a');
      setTranscript(data.transcript || '');

      if (data.transcript) {
        const t = await api.translateText(data.transcript, lang, user?.id || null);
        setTranslated(t);
      }

      // Save session
      if (user?.id && data.transcript) {
        api.saveNativeToEnglishSession({
          userId: user.id,
          originalLanguage: lang,
          originalText: data.native_transcript || '',
          translatedText: data.transcript,
        }).catch(() => {});
      }
    } catch {
      setTranscript('Could not transcribe.');
    }
    setIsLoading(false);
  }, [lang, user?.id]);

  const handleTranslateText = useCallback(async () => {
    if (!typedText.trim()) return;
    setIsLoading(true);
    try {
      const t = await api.translateText(typedText.trim(), lang, user?.id || null);
      setTranslated(t);
      setTranscript(typedText.trim());
    } catch {}
    setIsLoading(false);
  }, [typedText, lang, user?.id]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <SafeAreaView style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handleBar}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Quick Translate</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.langBtn} onPress={() => {
                const langs = Object.keys(LANG_LABELS);
                const idx = langs.indexOf(lang);
                setLang(langs[(idx + 1) % langs.length]);
              }}>
                <Text style={styles.langBtnText}>{LANG_LABELS[lang]}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Mode tabs */}
          <View style={styles.modeRow}>
            {['speak', 'type'].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeTab, mode === m && styles.modeTabActive]}
                onPress={() => { setMode(m); reset(); }}
              >
                <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
                  {m === 'speak' ? '🎙 Speak' : '⌨️ Type'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {mode === 'speak' ? (
              <View style={styles.recordSection}>
                <TouchableOpacity
                  onPressIn={startRec}
                  onPressOut={stopRec}
                  disabled={isLoading}
                  style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.recordIcon}>{isRecording ? '⏹' : '🎙'}</Text>
                </TouchableOpacity>
                <Text style={styles.recordHint}>
                  {isRecording ? `Recording... ${fmt(recSeconds)}` : 'Hold to record'}
                </Text>
              </View>
            ) : (
              <View style={styles.typeSection}>
                <TextInput
                  value={typedText}
                  onChangeText={setTypedText}
                  placeholder="Type in English..."
                  placeholderTextColor={colors.textFaded}
                  multiline
                  style={styles.typeInput}
                />
                <TouchableOpacity
                  style={[styles.translateBtn, (!typedText.trim() || isLoading) && { opacity: 0.4 }]}
                  onPress={handleTranslateText}
                  disabled={!typedText.trim() || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.translateBtnText}>Translate to {LANG_LABELS[lang]}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {isLoading && mode === 'speak' && (
              <ActivityIndicator size="large" color={colors.saffron} style={{ marginVertical: 16 }} />
            )}

            {transcript && !isLoading ? (
              <View style={styles.resultCard}>
                <Text style={styles.resultLabel}>Original</Text>
                <Text style={styles.resultText}>{transcript}</Text>
              </View>
            ) : null}

            {translated && !isLoading ? (
              <View style={[styles.resultCard, styles.resultCardHighlight]}>
                <Text style={[styles.resultLabel, { color: colors.saffron }]}>{LANG_LABELS[lang]}</Text>
                <Text style={styles.resultText}>{translated}</Text>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_H * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  handleBar: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textInk },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  langBtnText: { fontSize: 12, fontWeight: '600', color: colors.textInk },
  closeBtn: { padding: 6 },
  closeBtnText: { fontSize: 18, color: colors.textMuted },
  modeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modeTabActive: { backgroundColor: colors.surfaceInk },
  modeTabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  modeTabTextActive: { color: colors.white },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 40 },
  recordSection: { alignItems: 'center', paddingVertical: 24 },
  recordBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtnActive: { backgroundColor: colors.red },
  recordIcon: { fontSize: 28 },
  recordHint: { marginTop: 10, fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  typeSection: { gap: 12 },
  typeInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: colors.textInk,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  translateBtn: {
    backgroundColor: colors.surfaceInk,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  translateBtnText: { fontSize: 14, fontWeight: '600', color: colors.white },
  resultCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  resultCardHighlight: {
    backgroundColor: colors.saffronLight,
    borderColor: 'rgba(232,130,12,0.2)',
  },
  resultLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textFaded,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  resultText: { fontSize: 15, color: colors.textInk, lineHeight: 22 },
});
