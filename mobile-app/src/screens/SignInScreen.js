import { useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, SafeAreaView } from 'react-native';
import { useSSO } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { colors } from '../theme';

// Required for OAuth redirect handling
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { startSSOFlow } = useSSO();

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: Linking.createURL('/oauth-callback'),
        redirectUrlComplete: Linking.createURL('/oauth-callback'),
      });

      if (createdSessionId) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      console.error('OAuth error:', err);
    }
  }, [startSSOFlow]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={styles.brandName}>SeedlingSpeaks</Text>
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>Translate speech across{'\n'}10 Indian languages</Text>

        {/* Features */}
        <View style={styles.features}>
          {[
            'Transcribe speech in native languages',
            'Translate to English instantly',
            'Rewrite in Email, Slack, LinkedIn tones',
            'Vision translate from photos',
          ].map((item) => (
            <View key={item} style={styles.featureRow}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Sign In Button */}
        <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} activeOpacity={0.8}>
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Powered by Seedlinglabs</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textInk,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textInk,
    lineHeight: 36,
    marginBottom: 32,
  },
  features: {
    marginBottom: 48,
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.saffron,
  },
  featureText: {
    fontSize: 15,
    color: colors.textWarm,
    flex: 1,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInk,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textFaded,
    marginTop: 24,
  },
});
