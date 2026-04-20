import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { colors, LANG_LABELS } from '../theme';
import * as api from '../services/api';
import LanguagePicker from '../components/LanguagePicker';

const VOICE_TYPES = ['female', 'male'];
const TONES_LIST = ['neutral', 'professional', 'casual', 'energetic'];

export default function VideoTranslateScreen() {
  const navigation = useNavigation();
  const [selectedLang, setSelectedLang] = useState('kn-IN');
  const [voiceType, setVoiceType] = useState('female');
  const [tone, setTone] = useState('neutral');

  // Upload state
  const [videoUri, setVideoUri] = useState(null);
  const [videoName, setVideoName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [videoId, setVideoId] = useState(null);
  const [uploadInfo, setUploadInfo] = useState(null);

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [status, setStatus] = useState(null); // 'processing' | 'completed' | 'failed'
  const [result, setResult] = useState(null);
  const pollRef = useRef(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const pickVideo = useCallback(async () => {
    const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert('Permission needed', 'Please grant gallery access to pick videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
      videoMaxDuration: 300, // 5 min max
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setVideoUri(asset.uri);
      setVideoName(asset.fileName || 'video.mp4');
      setVideoId(null);
      setUploadInfo(null);
      setStatus(null);
      setResult(null);
    }
  }, []);

  const recordVideo = useCallback(async () => {
    const { status: permStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera access to record videos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
      videoMaxDuration: 120, // 2 min max
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setVideoUri(asset.uri);
      setVideoName(asset.fileName || 'recording.mp4');
      setVideoId(null);
      setUploadInfo(null);
      setStatus(null);
      setResult(null);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!videoUri) return;
    setIsUploading(true);
    try {
      const data = await api.uploadVideo(videoUri, videoName);
      setVideoId(data.video_id);
      setUploadInfo(data);
    } catch (err) {
      Alert.alert('Upload Failed', err.message || 'Could not upload video.');
    }
    setIsUploading(false);
  }, [videoUri, videoName]);

  const handleTranslate = useCallback(async () => {
    if (!videoId) return;
    setIsTranslating(true);
    setStatus('processing');
    setResult(null);

    try {
      await api.translateVideo({
        video_id: videoId,
        target_language: selectedLang,
        voice_type: voiceType,
        tone,
      });

      // Poll for status
      pollRef.current = setInterval(async () => {
        try {
          const statusData = await api.getVideoStatus(videoId);
          if (statusData.status === 'completed') {
            clearInterval(pollRef.current);
            setStatus('completed');
            setResult(statusData);
            setIsTranslating(false);
          } else if (statusData.status === 'failed') {
            clearInterval(pollRef.current);
            setStatus('failed');
            setIsTranslating(false);
          }
        } catch {
          clearInterval(pollRef.current);
          setStatus('failed');
          setIsTranslating(false);
        }
      }, 3000);
    } catch (err) {
      setStatus('failed');
      setIsTranslating(false);
      Alert.alert('Translation Failed', err.message || 'Could not start translation.');
    }
  }, [videoId, selectedLang, voiceType, tone]);

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setVideoUri(null);
    setVideoName('');
    setVideoId(null);
    setUploadInfo(null);
    setStatus(null);
    setResult(null);
    setIsTranslating(false);
    setIsUploading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Video Translate</Text>
        <LanguagePicker selected={selectedLang} onSelect={setSelectedLang} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Step 1: Pick / Record Video */}
        {!videoUri && (
          <View style={styles.pickSection}>
            <Text style={styles.stepLabel}>Step 1: Choose a video</Text>
            <View style={styles.pickRow}>
              <TouchableOpacity style={styles.pickBtn} onPress={recordVideo} activeOpacity={0.7}>
                <Text style={styles.pickIcon}>🎥</Text>
                <Text style={styles.pickBtnText}>Record Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickBtn} onPress={pickVideo} activeOpacity={0.7}>
                <Text style={styles.pickIcon}>📁</Text>
                <Text style={styles.pickBtnText}>Pick from Gallery</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Max 5 minutes. Supported: MP4, MOV.</Text>
          </View>
        )}

        {/* Video selected — show info + upload */}
        {videoUri && !videoId && (
          <View style={styles.card}>
            <View style={styles.fileRow}>
              <Text style={styles.fileIcon}>🎬</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>{videoName}</Text>
                <Text style={styles.fileHint}>Ready to upload</Text>
              </View>
              <TouchableOpacity onPress={reset} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.actionBtn, isUploading && { opacity: 0.5 }]}
              onPress={handleUpload}
              disabled={isUploading}
              activeOpacity={0.8}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.actionBtnText}>Upload Video</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Configure + Translate */}
        {videoId && !status && (
          <View style={styles.card}>
            <Text style={styles.stepLabel}>Step 2: Configure translation</Text>

            {uploadInfo && (
              <View style={styles.infoRow}>
                <Text style={styles.infoText}>Uploaded: {uploadInfo.filename} ({uploadInfo.size_kb} KB)</Text>
              </View>
            )}

            {/* Voice type */}
            <Text style={styles.optionLabel}>Voice Type</Text>
            <View style={styles.optionRow}>
              {VOICE_TYPES.map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.optionBtn, voiceType === v && styles.optionBtnActive]}
                  onPress={() => setVoiceType(v)}
                >
                  <Text style={[styles.optionBtnText, voiceType === v && styles.optionBtnTextActive]}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tone */}
            <Text style={styles.optionLabel}>Tone</Text>
            <View style={styles.optionRow}>
              {TONES_LIST.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.optionBtn, tone === t && styles.optionBtnActive]}
                  onPress={() => setTone(t)}
                >
                  <Text style={[styles.optionBtnText, tone === t && styles.optionBtnTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.translateBtn} onPress={handleTranslate} activeOpacity={0.8}>
              <Text style={styles.translateBtnText}>
                Translate to {LANG_LABELS[selectedLang]}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <View style={styles.statusCard}>
            <ActivityIndicator size="large" color={colors.saffron} />
            <Text style={styles.statusTitle}>Translating video...</Text>
            <Text style={styles.statusHint}>This may take a few minutes. Please wait.</Text>
          </View>
        )}

        {/* Completed */}
        {status === 'completed' && result && (
          <View style={[styles.statusCard, { borderColor: colors.green }]}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.statusTitle}>Translation Complete</Text>
            {result.transcript && (
              <View style={styles.resultSection}>
                <Text style={styles.resultLabel}>Transcript</Text>
                <Text style={styles.resultText}>{result.transcript}</Text>
              </View>
            )}
            {result.translated_text && (
              <View style={styles.resultSection}>
                <Text style={[styles.resultLabel, { color: colors.saffron }]}>
                  {LANG_LABELS[selectedLang]} Translation
                </Text>
                <Text style={styles.resultText}>{result.translated_text}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.resetBtn} onPress={reset} activeOpacity={0.7}>
              <Text style={styles.resetBtnText}>Translate Another Video</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Failed */}
        {status === 'failed' && (
          <View style={[styles.statusCard, { borderColor: colors.red }]}>
            <Text style={styles.successIcon}>❌</Text>
            <Text style={styles.statusTitle}>Translation Failed</Text>
            <Text style={styles.statusHint}>Something went wrong. Please try again.</Text>
            <TouchableOpacity style={styles.resetBtn} onPress={reset} activeOpacity={0.7}>
              <Text style={styles.resetBtnText}>Try Again</Text>
            </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: { width: 60 },
  backBtnText: { fontSize: 16, color: colors.saffron, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.textInk },
  content: { padding: 20, paddingBottom: 40 },
  pickSection: { marginBottom: 16 },
  stepLabel: { fontSize: 14, fontWeight: '700', color: colors.textInk, marginBottom: 12 },
  pickRow: { flexDirection: 'row', gap: 12 },
  pickBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: 8,
  },
  pickIcon: { fontSize: 32 },
  pickBtnText: { fontSize: 14, fontWeight: '600', color: colors.textInk },
  hint: { fontSize: 12, color: colors.textFaded, marginTop: 8, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  fileIcon: { fontSize: 28 },
  fileName: { fontSize: 15, fontWeight: '600', color: colors.textInk },
  fileHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  removeBtn: { padding: 8 },
  removeBtnText: { fontSize: 18, color: colors.textMuted },
  actionBtn: {
    backgroundColor: colors.surfaceInk,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: colors.white },
  infoRow: {
    backgroundColor: colors.saffronLight,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  infoText: { fontSize: 13, color: colors.saffron, fontWeight: '500' },
  optionLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginTop: 12 },
  optionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  optionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderWarm,
  },
  optionBtnActive: { backgroundColor: colors.saffron, borderColor: colors.saffron },
  optionBtnText: { fontSize: 13, fontWeight: '600', color: colors.textInk },
  optionBtnTextActive: { color: colors.white },
  translateBtn: {
    backgroundColor: colors.saffron,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: colors.saffron,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  translateBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  successIcon: { fontSize: 40 },
  statusTitle: { fontSize: 17, fontWeight: '700', color: colors.textInk },
  statusHint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  resultSection: { width: '100%', marginTop: 8 },
  resultLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textFaded,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  resultText: { fontSize: 14, color: colors.textInk, lineHeight: 20 },
  resetBtn: {
    backgroundColor: colors.surfaceInk,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  resetBtnText: { fontSize: 14, fontWeight: '600', color: colors.white },
});
