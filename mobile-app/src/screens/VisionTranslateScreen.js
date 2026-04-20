import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, ActivityIndicator, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, LANG_LABELS } from '../theme';
import LanguagePicker from '../components/LanguagePicker';

// Direct axios import for the vision endpoint
import axios from 'axios';

const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api'
  : 'https://your-backend.onrender.com/api';

export default function VisionTranslateScreen() {
  const [selectedLang, setSelectedLang] = useState('hi-IN');
  const [imageUri, setImageUri] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);

  const pickImage = useCallback(async (useCamera) => {
    try {
      let result;
      if (useCamera) {
        const { granted } = await ImagePicker.requestCameraPermissionsAsync();
        if (!granted) {
          Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
      } else {
        const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!granted) {
          Alert.alert('Permission Required', 'Gallery permission is needed to pick photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets?.length > 0) {
        setImageUri(result.assets[0].uri);
        setResults(null);
      }
    } catch (err) {
      console.error('Image pick error:', err);
      Alert.alert('Error', 'Failed to pick image.');
    }
  }, []);

  const handleTranslate = useCallback(async () => {
    if (!imageUri) return;
    setIsLoading(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });
      formData.append('target_language', selectedLang);

      const { data } = await axios.post(`${API_BASE_URL}/vision-translate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setResults(data);
    } catch (err) {
      console.error('Vision translate error:', err);
      Alert.alert('Error', 'Failed to translate image text. Make sure the backend supports /vision-translate.');
    }
    setIsLoading(false);
  }, [imageUri, selectedLang]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vision Translate</Text>
        <LanguagePicker selected={selectedLang} onSelect={setSelectedLang} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => pickImage(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>📷</Text>
            <Text style={styles.actionText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => pickImage(false)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>🖼</Text>
            <Text style={styles.actionText}>Pick from Gallery</Text>
          </TouchableOpacity>
        </View>

        {/* Image Preview */}
        {imageUri && (
          <View style={styles.previewCard}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
          </View>
        )}

        {/* Translate Button */}
        {imageUri && (
          <TouchableOpacity
            style={[styles.translateBtn, isLoading && styles.translateBtnDisabled]}
            onPress={handleTranslate}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.translateBtnText}>Translate Image Text</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Loading */}
        {isLoading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.saffron} />
            <Text style={styles.loadingText}>Analyzing image...</Text>
          </View>
        )}

        {/* Results */}
        {results && (
          <View style={styles.resultsCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.dot, { backgroundColor: colors.saffron }]} />
              <Text style={styles.cardLabel}>
                Translated Text ({LANG_LABELS[selectedLang]})
              </Text>
            </View>
            <View style={styles.cardBody}>
              {results.translations ? (
                results.translations.map((item, index) => (
                  <View key={index} style={styles.translationItem}>
                    {item.original && (
                      <Text style={styles.originalText}>{item.original}</Text>
                    )}
                    <Text style={styles.translatedText}>{item.translated}</Text>
                  </View>
                ))
              ) : results.translated_text ? (
                <Text style={styles.translatedText}>{results.translated_text}</Text>
              ) : (
                <Text style={styles.placeholder}>No text detected in image.</Text>
              )}
            </View>
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
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  actionIcon: { fontSize: 28 },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.textInk },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 260,
    borderRadius: 16,
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
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  loadingText: { fontSize: 14, color: colors.textMuted },
  resultsCard: {
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
  cardBody: { padding: 16 },
  translationItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  originalText: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  translatedText: {
    fontSize: 16,
    color: colors.textInk,
    lineHeight: 24,
  },
  placeholder: { fontSize: 15, color: colors.textFaded, fontStyle: 'italic' },
});
