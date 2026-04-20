import * as SecureStore from 'expo-secure-store';

/**
 * Clerk token cache using expo-secure-store.
 * Stores auth tokens securely in the iOS Keychain.
 */
export const tokenCache = {
  async getToken(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
};
