import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View, Text, ActivityIndicator, StyleSheet, StatusBar,
  TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { Colors, Gradients } from '@/theme';
import Brand from '@/components/Brand';

import LoginScreen          from '@/screens/auth/LoginScreen';
import RegisterScreen       from '@/screens/auth/RegisterScreen';
import HomeScreen           from '@/screens/home/HomeScreen';
import RequestDetailScreen  from '@/screens/home/RequestDetailScreen';
import QuoteApprovalScreen  from '@/screens/home/QuoteApprovalScreen';
import Step1DeviceScreen    from '@/screens/book/Step1DeviceScreen';
import Step2IssuesScreen    from '@/screens/book/Step2IssuesScreen';
import Step3PickupScreen    from '@/screens/book/Step3PickupScreen';
import BookingSuccessScreen from '@/screens/book/BookingSuccessScreen';
import NotificationsScreen  from '@/screens/notifications/NotificationsScreen';
import ProfileScreen        from '@/screens/profile/ProfileScreen';

import type {
  RootStackParamList, AuthStackParamList, AppTabParamList,
  HomeStackParamList, BookStackParamList,
} from '@/types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTabs   = createBottomTabNavigator<AppTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const BookStack = createNativeStackNavigator<BookStackParamList>();

// ── Regular tab icon ───────────────────────────────────────────────────
function TabIcon({
  name, label, focused,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  focused: boolean;
}) {
  return (
    <View style={tab.item}>
      <View style={[tab.pill, focused && tab.pillActive]}>
        <Ionicons
          name={name}
          size={22}
          color={focused ? Colors.brandNavy : '#94A3B8'}
        />
      </View>
      <Text style={[tab.label, focused && tab.labelActive]}>{label}</Text>
    </View>
  );
}

const tab = StyleSheet.create({
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    gap: 3,
    minWidth: 64,
  },
  pill: {
    width: 52,
    height: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pillActive: { backgroundColor: Colors.brandSoft },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: Colors.brandNavy,
    fontWeight: '800',
  },
});

// ── Stack navigators ───────────────────────────────────────────────────
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login"    component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home"          component={HomeScreen} />
      <HomeStack.Screen name="RequestDetail" component={RequestDetailScreen} />
      <HomeStack.Screen name="QuoteApproval" component={QuoteApprovalScreen} />
    </HomeStack.Navigator>
  );
}

function BookNavigator() {
  return (
    <BookStack.Navigator screenOptions={{ headerShown: false }}>
      <BookStack.Screen name="Step1Device"    component={Step1DeviceScreen} />
      <BookStack.Screen name="Step2Issues"    component={Step2IssuesScreen} />
      <BookStack.Screen name="Step3Pickup"    component={Step3PickupScreen} />
      <BookStack.Screen
        name="BookingSuccess"
        component={BookingSuccessScreen}
        options={{ gestureEnabled: false }}
      />
    </BookStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppTabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 82 : 66,
          paddingBottom: Platform.OS === 'ios' ? 22 : 8,
          paddingTop: 4,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E7ECF3',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 20,
        },
      }}
    >
      <AppTabs.Screen
        name="HomeTab"
        component={HomeNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} label="Home" focused={focused} />
          ),
        }}
      />
      <AppTabs.Screen
        name="BookTab"
        component={BookNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'construct' : 'construct-outline'} label="Book" focused={focused} />
          ),
        }}
      />
      <AppTabs.Screen
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'notifications' : 'notifications-outline'} label="Alerts" focused={focused} />
          ),
        }}
      />
      <AppTabs.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} label="Profile" focused={focused} />
          ),
        }}
      />
    </AppTabs.Navigator>
  );
}

// ── Root ───────────────────────────────────────────────────────────────
export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={splash.root}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.brandInk} />
        <LinearGradient colors={Gradients.ink} style={StyleSheet.absoluteFillObject} />
        <View style={splash.glow} />
        <Brand size="lg" onDark />
        <Text style={splash.tag}>Doorstep Laptop &amp; PC Repair · Mumbai</Text>
        <ActivityIndicator color={Colors.brand} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user
          ? <RootStack.Screen name="App"  component={AppNavigator} />
          : <RootStack.Screen name="Auth" component={AuthNavigator} />
        }
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const splash = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.brandInk, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glow: { position: 'absolute', top: '28%', width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(30,136,229,0.16)' },
  tag:  { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 18, fontWeight: '600' },
});
