import { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { Audio } from 'expo-av';
import { colors, LANG_LABELS, TONES } from '../theme';
import * as api from '../services/api';
import LanguagePicker from '../components/LanguagePicker';

export default function NativeToEnglishScreen() {
  const { user } = useUser();
  const [selectedLang, setSelectedLang] = useState('kn-IN');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [nativeText, setNativeText] = useState('');
  const [selectedTone, setSelectedTone] = useState(null);
  const [tonedText, setTonedText] = useState('');
  const [isRetoning, setIsRetoning] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recordingRef = useRef(null);
  const timerRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setRecSeconds(0);
      setTranscript('');
      setNativeText('');
      setTonedText('');
      setSelectedTone(null);

      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error('Recording failed:', err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    clearInterval(timerRef.current);
    setIsRecording(false);
    setIsLoading(true);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const data = await api.translateAudioFromBlob(uri, 'recording.m4a');
      setTranscript(data.transcript || '');
      setNativeText(data.native_transcript || '');

      // Save N2E session
      if (user?.id && data.transcript) {
        api.saveNativeToEnglishSession({
          userId: user.id,
          originalLanguage: selectedLang,
          originalText: data.native_transcript || '',
          translatedText: data.transcript,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Transcription failed:', err);
      setTranscript('Could not transcribe. Try again.');
    }
    setIsLoading(false);
  }, [selectedLang, user?.id]);

  const handleTone = useCallback(async (tone) => {
    if (!transcript) return;
    setSelectedTone(tone);
    setIsRetoning(true);
    try {
      const result = await api.rewriteTone(transcript, tone);
      setTonedText(result);
    } catch {
      setTonedText('Tone rewrite failed.');
    }
    setIsRetoning(false);
  }, [transcript]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Native to English</Text>
        <LanguagePicker selected={selectedLang} onSelect={setSelectedLang} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Record Button */}
        <View style={styles.recordSection}>
          <TouchableOpacity
            onPressIn={startRecording}
            onPressOut={stopRecording}
            activeOpacity={0.7}
            style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
            disabled={isLoading}
          >
            <Text style={styles.recordIcon}>{isRecording ? '⏹' : '🎙'}</Text>
          </TouchableOpacity>
          <Text style={styles.recordHint}>
            {isRecording ? `Recording... ${fmt(recSeconds)}` : isLoading ? 'Translating...' : 'Hold to record'}
          </Text>
        </View>

        {isLoading && <ActivityIndicator size="large" color={colors.saffron} style={{ marginVertical: 20 }} />}

        {/* Native Text */}
        {nativeText ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{LANG_LABELS[selectedLang] || 'Native'}</Text>
            <Text style={styles.cardText}>{nativeText}</Text>
          </View>
        ) : null}

        {/* English Transcript */}
        {transcript ? (
          <View style={[styles.card, styles.cardHighlight]}>
            <Text style={[styles.cardLabel, { color: colors.saffron }]}>English</Text>
            <Text style={styles.cardText}>{transcript}</Text>
          </View>
        ) : null}

        {/* Tone Buttons */}
        {transcript ? (
          <View style={styles.toneRow}>
            {TONES.map((tone) => (
              <TouchableOpacity
                key={tone}
                style={[styles.toneBtn, selectedTone === tone && styles.toneBtnActive]}
                onPress={() => handleTone(tone)}
              >
                <Text style={[styles.toneBtnText, selectedTone === tone && styles.toneBtnTextActive]}>
                  {tone}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Toned Text */}
        {isRetoning && <ActivityIndicator size="small" color={colors.saffron} style={{ marginTop: 12 }} />}
        {tonedText ? (
          <View style={[styles.card, { borderColor: colors.saffron, borderWidth: 1 }]}>
            <Text style={[styles.cardLabel, { color: colors.saffron }]}>{selectedTone}</Text>
            <Text style={styles.cardText}>{tonedText}</Text>
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
  recordSection: { alignItems: 'center', marginVertical: 24 },
  recordBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceInk,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  recordBtnActive: { backgroundColor: colors.red },
  recordIcon: { fontSize: 32 },
  recordHint: { marginTop: 12, fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHighlight: { backgroundColor: colors.saffronLight, borderColor: 'rgba(232,130,12,0.2)' },
  cardLabel: { fontSize: 11, fontWeight: '700', color: colors.textFaded, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  cardText: { fontSize: 15, color: colors.textInk, lineHeight: 22 },
  toneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 12 },
  toneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderWarm,
  },
  toneBtnActive: { backgroundColor: colors.saffron, borderColor: colors.saffron },
  toneBtnText: { fontSize: 13, fontWeight: '600', color: colors.textInk },
  toneBtnTextActive: { color: colors.white },
});
