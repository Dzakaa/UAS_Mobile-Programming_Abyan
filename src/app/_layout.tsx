import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    // Paksa DefaultTheme supaya warna background custom tidak ditimpa dark mode
    <ThemeProvider value={DefaultTheme}>
      <Stack>

        {/* Halaman Utama (index.tsx → route "/") */}
        <Stack.Screen
          name="index"
          options={{ headerShown: false }}
        />

        {/* Login (login.tsx → route "/login") */}
        <Stack.Screen
          name="login"
          options={{ headerShown: false }}
        />

        {/* Register (register.tsx → route "/register") */}
        <Stack.Screen
          name="register"
          options={{ headerShown: false }}
        />

        {/* Cek Cuaca (cuaca.tsx → route "/cuaca") */}
        <Stack.Screen
          name="cuaca"
          options={{ headerShown: false }}
        />

      </Stack>

      {/* StatusBar dark supaya cocok dengan background terang */}
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
