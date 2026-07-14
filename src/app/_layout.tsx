import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>

        {/* Home (index.tsx → route "/") */}
        <Stack.Screen name="index"      options={{ headerShown: false }} />

        {/* Login (login.tsx → route "/login") */}
        <Stack.Screen name="login"      options={{ headerShown: false }} />

        {/* Register (register.tsx → route "/register") */}
        <Stack.Screen name="register"   options={{ headerShown: false }} />

        {/* Cek Cuaca (cuaca.tsx → route "/cuaca") */}
        <Stack.Screen name="cuaca"      options={{ headerShown: false }} />

        {/* Notepad (notepad.tsx → route "/notepad") */}
        <Stack.Screen name="notepad"    options={{ headerShown: false }} />

        {/* Tes Mental (tes_mental.tsx → route "/tes_mental") */}
        <Stack.Screen name="tes_mental" options={{ headerShown: false }} />

      </Stack>

      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
