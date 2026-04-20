import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { colors, LANG_LABELS } from '../theme';
import * as api from '../services/api';
import LanguagePicker from '../components/LanguagePicker';

const STATUS = { IDLE: 'Stopped', LISTENING: 'Listening', PAUSED: 'Paused' };

export default function ContinuousListeningScreen() {
  const [selectedLang, setSelectedLang] = useState('hi-IN');
  const [status, setStatus] = useState(STATUS.IDLE);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const recordingRef = useRef(null);
  const timerRef = useRef(null);
  const scrollRef = useRef(null);

  // Timer
  useEffect(() => {
    if (status === STATUS.LISTENING) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

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
      setStatus(STATUS.LISTENING);
      setSeconds(0);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, []);

  const stopAndProcess = useCallback(async () => {
    if (!recordingRef.current) return;
    setStatus(STATUS.IDLE);
    setIsProcessing(true);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      const result = await api.translateAudioFromBlob(uri);
      const newText = result.original_text || result.translated_text || '';
      if (newText) {
        setTranscript((prev) => (prev ? prev + '\n' + newText : newText));
      }
    } catch (err) {
      console.error('Processing error:', err);
    }
    setIsProcessing(false);
  }, []);

  const handleToggle = useCallback(() => {
    if (status === STATUS.LISTENING) {
      stopAndProcess();
    } else {
      startRecording();
    }
  }, [status, stopAndProcess, startRecording]);

  const statusColor =
    status === STATUS.LISTENING ? colors.green :
    status === STATUS.PAUSED ? colors.saffron : colors.textMuted;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Continuous Listening</Text>
        <LanguagePicker selected={selectedLang} onSelect={setSelectedLang} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {/* Status + Timer */}
        <View style={styles.statusRow}>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
          </View>
          <Text style={styles.timer}>{formatTime(seconds)}</Text>
        </View>

        {/* Transcript Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.dot, { backgroundColor: colors.saffron }]} />
            <Text style={styles.cardLabel}>Transcript</Text>
          </View>
          <View style={styles.cardBody}>
            {transcript ? (
              <Text style={styles.transcriptText}>{transcript}</Text>
            ) : (
              <Text style={styles.placeholder}>
                {status === STATUS.LISTENING
                  ? 'Listening... speak now'
                  : 'Tap the button below to start listening'}
              </Text>
            )}
            {isProcessing && (
              <View style={styles.processingRow}>
                <ActivityIndicator size="small" color={colors.saffron} />
                <Text style={styles.processingText}>Processing audio...</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Large Circular Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.circleBtn,
            status === STATUS.LISTENING && styles.circleBtnActive,
          ]}
          onPress={handleToggle}
          activeOpacity={0.7}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="large" color={colors.white} />
          ) : (
            <Text style={styles.circleBtnText}>
              {status === STATUS.LISTENING ? 'Stop' : 'Start'}
            </Text>
          )}
        </TouchableOpacity>
        <Text style={styles.buttonHint}>
          {status === STATUS.LISTENING ? 'Tap to stop' : 'Tap to start listening'}
        </Text>
      </View>
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
  scrollContent: { padding: 20, paddingBottom: 20 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '600' },
  timer: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textInk,
    fontVariant: ['tabular-nums'],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardLabel: { fontSize: 14, fontWeight: '700', color: colors.textInk },
  cardBody: { padding: 16, minHeight: 200 },
  transcriptText: { fontSize: 16, color: colors.textInk, lineHeight: 26 },
  placeholder: { fontSize: 15, color: colors.textFaded, fontStyle: 'italic' },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  processingText: { fontSize: 13, color: colors.textMuted },
  buttonContainer: { alignItems: 'center', paddingVertical: 24, paddingBottom: 32 },
  circleBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.saffron,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.saffron,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  circleBtnActive: { backgroundColor: colors.red },
  circleBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  buttonHint: { fontSize: 13, color: colors.textMuted, marginTop: 10 },
});
