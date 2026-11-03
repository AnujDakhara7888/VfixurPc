import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import RootNavigator from '@/navigation';
import PushPermissionGate from '@/notifications/PushPermissionGate';

function AccountApp() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));
  useEffect(() => () => { queryClient.cancelQueries(); queryClient.clear(); }, [queryClient]);
  return <QueryClientProvider client={queryClient}><RootNavigator /><PushPermissionGate /><Toast /></QueryClientProvider>;
}

function AccountBoundary() {
  const { user } = useAuth();
  return <AccountApp key={user?.id ?? 'signed-out'} />;
}

export default function App() {
  return (
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <AccountBoundary />
        </AuthProvider>
      </SafeAreaProvider>
  );
}
