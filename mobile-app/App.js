import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { tokenCache } from './src/services/tokenCache';
import { setAuthToken } from './src/services/api';
import { useEffect, createContext } from 'react';

import SignInScreen from './src/screens/SignInScreen';
import MainTabs from './src/navigation/MainTabs';

const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_dW5pdGVkLW1vY2Nhc2luLTM5LmNsZXJrLmFjY291bnRzLmRldiQ';

const Stack = createNativeStackNavigator();

// Navigation ref context so drawer menu can navigate
export const NavigationRefContext = createContext(null);

function AuthSync({ children }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    const sync = async () => {
      try {
        const token = await getToken();
        setAuthToken(token || null);
      } catch {
        setAuthToken(null);
      }
    };
    sync();
  }, [isLoaded, isSignedIn, getToken]);

  return children;
}

function RootNavigator() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isSignedIn ? (
        <Stack.Screen name="SignIn" component={SignInScreen} />
      ) : (
        <Stack.Screen name="Main" component={MainTabs} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const navigationRef = useNavigationContainerRef();

  return (
    <ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
      <ClerkLoaded>
        <AuthSync>
          <NavigationRefContext.Provider value={navigationRef}>
            <NavigationContainer ref={navigationRef}>
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
          </NavigationRefContext.Provider>
        </AuthSync>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
