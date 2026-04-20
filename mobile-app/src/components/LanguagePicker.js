import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { colors, LANG_LABELS } from '../theme';

const LANG_LIST = Object.entries(LANG_LABELS).map(([code, name]) => ({ code, name }));

export default function LanguagePicker({ selected, onSelect }) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setVisible(true)} activeOpacity={0.7}>
        <Text style={styles.triggerText}>{LANG_LABELS[selected] || 'Select'}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Select Language</Text>
            <FlatList
              data={LANG_LIST}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.langItem, selected === item.code && styles.langItemActive]}
                  onPress={() => { onSelect(item.code); setVisible(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.langName, selected === item.code && styles.langNameActive]}>
                    {item.name}
                  </Text>
                  {selected === item.code && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  triggerText: { fontSize: 13, fontWeight: '600', color: colors.textInk },
  chevron: { fontSize: 12, color: colors.textMuted },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textInk,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  langItemActive: { backgroundColor: colors.saffronLight },
  langName: { fontSize: 16, color: colors.textInk, fontWeight: '500' },
  langNameActive: { color: colors.saffron, fontWeight: '700' },
  check: { fontSize: 18, color: colors.saffron },
});
