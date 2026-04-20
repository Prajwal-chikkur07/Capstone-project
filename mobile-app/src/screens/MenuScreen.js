import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme';

const MENU_ITEMS = [
  { label: 'Native to English', icon: '🎙', tab: 'N2E' },
  { label: 'English to Native', icon: '🌐', tab: 'E2N' },
  { label: 'History', icon: '🕐', tab: 'History' },
  { label: 'Settings', icon: '⚙️', tab: 'Settings' },
];

export default function MenuScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.tab)}
            activeOpacity={0.7}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>
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
  content: { padding: 20, gap: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  menuIcon: { fontSize: 24 },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.textInk },
  menuChevron: { fontSize: 24, color: colors.textFaded },
});
