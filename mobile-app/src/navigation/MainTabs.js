import { useState, useContext } from 'react';
import { NavigationRefContext } from '../../App';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, TouchableOpacity, Modal, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { colors } from '../theme';

// Screens
import NativeToEnglishScreen from '../screens/NativeToEnglishScreen';
import EnglishToNativeScreen from '../screens/EnglishToNativeScreen';
import ContinuousListeningScreen from '../screens/ContinuousListeningScreen';
import VisionTranslateScreen from '../screens/VisionTranslateScreen';
import VideoTranslateScreen from '../screens/VideoTranslateScreen';
import HistoryScreen from '../screens/HistoryScreen';
import TemplatesScreen from '../screens/TemplatesScreen';
import DictionaryScreen from '../screens/DictionaryScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Widget
import FloatingWidget from '../components/FloatingWidget';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabIcon({ label, focused }) {
  const icons = { 'Translate': '🎙', 'Text': '🌐', 'Listen': '👂', 'History': '🕐', 'More': '☰' };
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 20 }}>{icons[label] || '●'}</Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color: focused ? colors.saffron : colors.textMuted }}>{label}</Text>
    </View>
  );
}

// ── Drawer Menu (opened from More tab) ───────────────────────────────────────
function DrawerMenu({ visible, onClose, onNavigate }) {
  const { user } = useUser();
  const { signOut } = useClerk();

  const sections = [
    {
      label: 'Translation',
      items: [
        { icon: '🎙', label: 'Native to English', screen: 'NativeToEnglish' },
        { icon: '👂', label: 'Continuous Listening', screen: 'ContinuousListening' },
        { icon: '🌐', label: 'English to Native', screen: 'EnglishToNative' },
        { icon: '📷', label: 'Vision Translate', screen: 'VisionTranslate' },
        { icon: '🎬', label: 'Video Translate', screen: 'VideoTranslate' },
      ],
    },
    {
      label: 'Library',
      items: [
        { icon: '🕐', label: 'History', screen: 'HistoryStack' },
        { icon: '📋', label: 'Templates', screen: 'Templates' },
        { icon: '📖', label: 'Dictionary', screen: 'Dictionary' },
      ],
    },
    {
      label: 'Insights',
      items: [
        { icon: '📊', label: 'Analytics', screen: 'Analytics' },
      ],
    },
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.drawerOverlay}>
        <TouchableOpacity style={styles.drawerBackdrop} onPress={onClose} activeOpacity={1} />
        <SafeAreaView style={styles.drawer}>
          {/* Profile header */}
          <View style={styles.drawerProfile}>
            <View style={styles.drawerAvatar}>
              <Text style={styles.drawerAvatarText}>{user?.firstName?.[0] || '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.drawerName}>{user?.fullName || 'User'}</Text>
              <Text style={styles.drawerEmail}>{user?.primaryEmailAddress?.emailAddress || ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.drawerCloseBtn}>
              <Text style={styles.drawerCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false}>
            {sections.map((section) => (
              <View key={section.label}>
                <Text style={styles.drawerSectionLabel}>{section.label}</Text>
                {section.items.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={styles.drawerItem}
                    onPress={() => { onClose(); onNavigate(item.screen); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.drawerItemIcon}>{item.icon}</Text>
                    <Text style={styles.drawerItemLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>

          {/* Bottom actions */}
          <View style={styles.drawerBottom}>
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => { onClose(); onNavigate('Profile'); }}
            >
              <Text style={styles.drawerItemIcon}>👤</Text>
              <Text style={styles.drawerItemLabel}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => { onClose(); onNavigate('SettingsStack'); }}
            >
              <Text style={styles.drawerItemIcon}>⚙️</Text>
              <Text style={styles.drawerItemLabel}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.drawerItem, { marginTop: 8 }]}
              onPress={() => signOut()}
            >
              <Text style={styles.drawerItemIcon}>🚪</Text>
              <Text style={[styles.drawerItemLabel, { color: colors.red }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ── More tab placeholder (triggers drawer) ───────────────────────────────────
function MorePlaceholder() {
  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}

// ── Main stack (all screens accessible from drawer) ──────────────────────────
export default function MainTabs() {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [widgetVisible, setWidgetVisible] = useState(false);
  const navigationRef = useContext(NavigationRefContext);

  const navigateTo = (screen) => {
    try {
      navigationRef?.navigate('Main', { screen });
    } catch {
      // Fallback — some screens are nested in tabs
      try { navigationRef?.navigate(screen); } catch {}
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="HomeTabs">
          {() => (
            <Tab.Navigator
              screenOptions={{
                headerShown: false,
                tabBarStyle: {
                  backgroundColor: colors.bg,
                  borderTopColor: colors.border,
                  borderTopWidth: 1,
                  height: 85,
                  paddingBottom: 28,
                  paddingTop: 8,
                },
                tabBarShowLabel: false,
              }}
              screenListeners={{
                tabPress: (e) => {
                  if (e.target?.startsWith('More')) {
                    e.preventDefault();
                    setDrawerVisible(true);
                  }
                },
              }}
            >
              <Tab.Screen name="NativeToEnglish" component={NativeToEnglishScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon label="Translate" focused={focused} /> }} />
              <Tab.Screen name="EnglishToNative" component={EnglishToNativeScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon label="Text" focused={focused} /> }} />
              <Tab.Screen name="ContinuousListening" component={ContinuousListeningScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon label="Listen" focused={focused} /> }} />
              <Tab.Screen name="HistoryStack" component={HistoryScreen}
                options={{ tabBarIcon: ({ focused }) => <TabIcon label="History" focused={focused} /> }} />
              <Tab.Screen name="More" component={MorePlaceholder}
                options={{ tabBarIcon: ({ focused }) => <TabIcon label="More" focused={focused} /> }} />
            </Tab.Navigator>
          )}
        </Stack.Screen>
        <Stack.Screen name="VisionTranslate" component={VisionTranslateScreen} />
        <Stack.Screen name="VideoTranslate" component={VideoTranslateScreen} />
        <Stack.Screen name="Templates" component={TemplatesScreen} />
        <Stack.Screen name="Dictionary" component={DictionaryScreen} />
        <Stack.Screen name="Analytics" component={AnalyticsScreen} />
        <Stack.Screen name="SettingsStack" component={SettingsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>

      {/* Drawer menu */}
      <DrawerMenu
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onNavigate={navigateTo}
      />

      {/* Floating Widget FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setWidgetVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>🎙</Text>
      </TouchableOpacity>

      <FloatingWidget
        visible={widgetVisible}
        onClose={() => setWidgetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Drawer styles
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: colors.bgWarm,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  drawerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  drawerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.saffronLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerAvatarText: { fontSize: 18, fontWeight: '700', color: colors.saffron },
  drawerName: { fontSize: 15, fontWeight: '700', color: colors.textInk },
  drawerEmail: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  drawerCloseBtn: { padding: 8 },
  drawerCloseBtnText: { fontSize: 18, color: colors.textMuted },
  drawerScroll: { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
  drawerSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textFaded,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 6,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  drawerItemIcon: { fontSize: 20 },
  drawerItemLabel: { fontSize: 15, fontWeight: '500', color: colors.textInk },
  drawerBottom: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceInk,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 100,
  },
  fabIcon: { fontSize: 24 },
});
