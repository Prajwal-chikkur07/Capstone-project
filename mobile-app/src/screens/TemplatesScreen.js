import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme';

const TEMPLATES = [
  {
    category: 'Leave Request',
    items: [
      {
        title: 'Sick Leave',
        text: 'Dear Manager, I am not feeling well today and would like to request a sick leave. I will keep you updated on my health. Thank you for your understanding.',
      },
      {
        title: 'Casual Leave',
        text: 'Dear Manager, I would like to request a day off on [date] for personal reasons. I will ensure all pending tasks are completed before my leave. Thank you.',
      },
    ],
  },
  {
    category: 'Meeting Request',
    items: [
      {
        title: 'Schedule a Meeting',
        text: 'Hi, I would like to schedule a meeting to discuss [topic]. Could you please share your availability for this week? Thank you.',
      },
      {
        title: 'Reschedule Meeting',
        text: 'Hi, I need to reschedule our meeting originally planned for [date]. Would [new date] work for you? Apologies for the inconvenience.',
      },
    ],
  },
  {
    category: 'Introduction',
    items: [
      {
        title: 'Self Introduction',
        text: 'Hello, my name is [Name]. I am a [role] working at [company]. I am excited to connect with you and look forward to collaborating.',
      },
      {
        title: 'Team Introduction',
        text: 'Hi everyone, I would like to introduce [Name], who is joining our team as [role]. Please join me in welcoming them. They will be working on [project].',
      },
    ],
  },
  {
    category: 'Complaint',
    items: [
      {
        title: 'Service Complaint',
        text: 'Dear Sir/Madam, I am writing to express my dissatisfaction with the [service/product]. The issue is [describe issue]. I request you to look into this matter and resolve it at the earliest.',
      },
      {
        title: 'Workplace Issue',
        text: 'Dear HR, I would like to bring to your attention an issue regarding [describe issue]. I believe this needs immediate attention. I look forward to your response.',
      },
    ],
  },
  {
    category: 'Thank You',
    items: [
      {
        title: 'Thank You for Help',
        text: 'Hi [Name], I wanted to take a moment to thank you for your help with [task/project]. Your support made a real difference. I truly appreciate it.',
      },
      {
        title: 'Thank You for Opportunity',
        text: 'Dear [Name], Thank you for giving me the opportunity to [describe]. I am grateful for your trust and will make the most of it. Best regards.',
      },
    ],
  },
];

export default function TemplatesScreen({ navigation }) {
  const [expandedCategory, setExpandedCategory] = useState(null);

  const handleCopy = async (text) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', 'Template copied to clipboard.');
    } catch {
      Alert.alert('Error', 'Could not copy text.');
    }
  };

  const handleUse = (text) => {
    if (navigation) {
      navigation.navigate('EnglishToNative', { prefillText: text });
    } else {
      handleCopy(text);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategory((prev) => (prev === category ? null : category));
  };

  const categoryIcon = (cat) => {
    switch (cat) {
      case 'Leave Request': return 'LR';
      case 'Meeting Request': return 'MR';
      case 'Introduction': return 'IN';
      case 'Complaint': return 'CO';
      case 'Thank You': return 'TY';
      default: return 'TM';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Templates</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Quick message templates for common scenarios. Tap to expand, then use or copy.
        </Text>

        {TEMPLATES.map((group) => (
          <View key={group.category} style={styles.categoryCard}>
            <TouchableOpacity
              style={styles.categoryHeader}
              onPress={() => toggleCategory(group.category)}
              activeOpacity={0.7}
            >
              <View style={styles.categoryIconContainer}>
                <Text style={styles.categoryIconText}>{categoryIcon(group.category)}</Text>
              </View>
              <Text style={styles.categoryName}>{group.category}</Text>
              <Text style={styles.categoryCount}>{group.items.length}</Text>
              <Text style={styles.chevron}>
                {expandedCategory === group.category ? '▴' : '▾'}
              </Text>
            </TouchableOpacity>

            {expandedCategory === group.category && (
              <View style={styles.templatesList}>
                {group.items.map((template, idx) => (
                  <View key={idx} style={styles.templateItem}>
                    <Text style={styles.templateTitle}>{template.title}</Text>
                    <Text style={styles.templatePreview} numberOfLines={3}>
                      {template.text}
                    </Text>
                    <View style={styles.templateActions}>
                      <TouchableOpacity
                        style={styles.useBtn}
                        onPress={() => handleUse(template.text)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.useBtnText}>Use Template</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.copyBtn}
                        onPress={() => handleCopy(template.text)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.copyBtnText}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
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
  content: { padding: 20, paddingBottom: 40 },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  categoryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  categoryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.saffronLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconText: { fontSize: 12, fontWeight: '700', color: colors.saffron },
  categoryName: { fontSize: 15, fontWeight: '600', color: colors.textInk, flex: 1 },
  categoryCount: {
    fontSize: 12,
    color: colors.textFaded,
    backgroundColor: colors.bg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  chevron: { fontSize: 14, color: colors.textMuted },
  templatesList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  templateItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  templateTitle: { fontSize: 14, fontWeight: '700', color: colors.textInk, marginBottom: 6 },
  templatePreview: { fontSize: 13, color: colors.textWarm, lineHeight: 19 },
  templateActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  useBtn: {
    backgroundColor: colors.saffron,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  useBtnText: { fontSize: 13, fontWeight: '600', color: colors.white },
  copyBtn: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderWarm,
  },
  copyBtnText: { fontSize: 13, fontWeight: '600', color: colors.textInk },
});
