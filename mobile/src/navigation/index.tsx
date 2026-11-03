import React, { useEffect, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { notificationsApi } from '@/api/client';
import ActivitySync from '@/notifications/ActivitySync';
import LegalScreen from '@/screens/profile/LegalScreen';
import MyDevicesScreen from '@/screens/profile/MyDevicesScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View, Text, ActivityIndicator, StyleSheet, StatusBar,
  TouchableOpacity, Platform, Animated, AccessibilityInfo, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/theme';
import Brand from '@/components/Brand';

import LoginScreen          from '@/screens/auth/LoginScreen';
import RegisterScreen       from '@/screens/auth/RegisterScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import HomeScreen           from '@/screens/home/HomeScreen';
import OrdersScreen from '@/screens/home/OrdersScreen';
import RequestDetailScreen  from '@/screens/home/RequestDetailScreen';
import QuoteApprovalScreen  from '@/screens/home/QuoteApprovalScreen';
import OfferDetailScreen from '@/screens/home/OfferDetailScreen';
import Step1DeviceScreen    from '@/screens/book/Step1DeviceScreen';
import Step2IssuesScreen    from '@/screens/book/Step2IssuesScreen';
import Step3PickupScreen    from '@/screens/book/Step3PickupScreen';
import BookingSuccessScreen from '@/screens/book/BookingSuccessScreen';
import NotificationsScreen  from '@/screens/notifications/NotificationsScreen';
import ProfileScreen        from '@/screens/profile/ProfileScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DeleteAccountScreen from '@/screens/profile/DeleteAccountScreen';
import ChangeEmailScreen from '@/screens/profile/ChangeEmailScreen';
import FaqScreen            from '@/screens/faq/FaqScreen';
import { BookingProvider } from '@/context/BookingContext';

import type {
  RootStackParamList, AuthStackParamList, AppTabParamList,
  HomeStackParamList, BookStackParamList, ProfileStackParamList,
} from '@/types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<any>();
let pendingTicket: string | undefined;
let pendingOffer: string | undefined;
function openNotification(data: Record<string, any>) {
  if (typeof data.offerId === 'string' && data.offerId) {
    pendingOffer = data.offerId;
    if (navigationRef.isReady()) {
      navigationRef.navigate('App', { screen: 'HomeTab', params: { screen: 'OfferDetail', params: { id: pendingOffer } } });
      pendingOffer = undefined;
    }
    return;
  }
  if (typeof data.serviceRequestId !== 'string' || !data.serviceRequestId) return;
  pendingTicket = data.serviceRequestId;
  if (navigationRef.isReady()) {
    navigationRef.navigate('App', { screen: 'HomeTab', params: { screen: 'RequestDetail', params: {id: pendingTicket} } });
    pendingTicket = undefined;
  }
}
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTabs   = createBottomTabNavigator<AppTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const BookStack = createNativeStackNavigator<BookStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

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
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="Legal" component={LegalScreen} />
    </AuthStack.Navigator>
  );
}

function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home"          component={HomeScreen} />
      <HomeStack.Screen name="OfferDetail" component={OfferDetailScreen} />
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

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
      <ProfileStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <ProfileStack.Screen name="Faq"     component={FaqScreen} />
      <ProfileStack.Screen name="Legal" component={LegalScreen} />
      <ProfileStack.Screen name="MyDevices" component={MyDevicesScreen} />
    </ProfileStack.Navigator>
  );
}

function OrdersNavigator() {
  return <HomeStack.Navigator screenOptions={{ headerShown: false }}>
    <HomeStack.Screen name="Orders" component={OrdersScreen} />
    <HomeStack.Screen name="OfferDetail" component={OfferDetailScreen} />
    <HomeStack.Screen name="RequestDetail" component={RequestDetailScreen} />
    <HomeStack.Screen name="QuoteApproval" component={QuoteApprovalScreen} />
  </HomeStack.Navigator>;
}

function AppNavigator() {
  const insets = useSafeAreaInsets();
  const {data} = useQuery({queryKey:['unread'],queryFn:notificationsApi.unread,refetchInterval:15000});
  useEffect(()=>{Notifications.setBadgeCountAsync(data?.count??0).catch(()=>{});},[data?.count]);
  return (
    <BookingProvider>
    <AppTabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 64 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
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
        name="OrdersTab"
        component={OrdersNavigator}
        options={{ tabBarIcon: ({focused}) => <TabIcon name={focused ? 'receipt' : 'receipt-outline'} label="Requests" focused={focused} /> }}
      />
      <AppTabs.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} label="Profile" focused={focused} />
          ),
        }}
      />
    </AppTabs.Navigator>
    </BookingProvider>
  );
}

// ── Root ───────────────────────────────────────────────────────────────
function AnimatedLaunchBrand() {
  const reveal = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (reduced) {
        reveal.setValue(1);
        return;
      }
      animation = Animated.parallel([
        Animated.timing(reveal, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(180),
          Animated.timing(glow, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.35, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ]);
      animation.start();
    });
    return () => animation?.stop();
  }, [glow, reveal]);
  return <View style={splash.brandStage}>
    <Animated.View style={[splash.logoGlow, { opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.08] }) }] }]} />
    <Animated.View style={{ opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }, { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}>
      <Brand size="lg" onDark />
    </Animated.View>
  </View>;
}

export default function RootNavigator() {
  const { user, loading, restoreError, retryRestore, logout } = useAuth();
  const qc=useQueryClient();
  useEffect(()=>{
    if(!user)return;
    const received=Notifications.addNotificationReceivedListener(()=>{
      qc.invalidateQueries({queryKey:['notifications']});qc.invalidateQueries({queryKey:['unread']});qc.invalidateQueries({queryKey:['my-requests']});qc.invalidateQueries({queryKey:['sr']});
    });
    const respond=(response: Notifications.NotificationResponse)=>{
      const data=response.notification.request.content.data;
      openNotification(data);
      if(typeof data.notificationId==='string')notificationsApi.read(data.notificationId).then(()=>{qc.invalidateQueries({queryKey:['unread']});qc.invalidateQueries({queryKey:['notifications']});}).catch(()=>{});
      Notifications.clearLastNotificationResponseAsync().catch(()=>{});
    };
    const tapped=Notifications.addNotificationResponseReceivedListener(respond);
    Notifications.getLastNotificationResponseAsync().then(r=>{if(r)respond(r);});
    return()=>{received.remove();tapped.remove();pendingTicket=undefined;pendingOffer=undefined;};
  },[user?.id]);

  if (loading) {
    return (
      <View style={splash.root}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
        <AnimatedLaunchBrand />
        <Text style={splash.tag}>Doorstep Laptop &amp; PC Repair · Mumbai</Text>
        <ActivityIndicator color={Colors.brand} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (!user && restoreError) {
    return (
      <View style={recovery.root}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
        <View style={recovery.icon}><Ionicons name="cloud-offline-outline" size={28} color={Colors.brandDark} /></View>
        <Text style={recovery.title}>Could not reconnect</Text>
        <Text style={recovery.message}>{restoreError}</Text>
        <TouchableOpacity accessibilityRole="button" style={recovery.primary} onPress={() => void retryRestore()}>
          <Text style={recovery.primaryText}>Retry session</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={recovery.secondary} onPress={() => void logout()}>
          <Text style={recovery.secondaryText}>Sign in with another account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={()=>{if(pendingOffer&&user)openNotification({offerId:pendingOffer});else if(pendingTicket&&user)openNotification({serviceRequestId:pendingTicket});}}>
      {user && <ActivitySync userId={user.id} onOpen={openNotification} />}
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user
          ? <><RootStack.Screen name="App" component={AppNavigator} /><RootStack.Screen name="Notifications" component={NotificationsScreen} /></>
          : <RootStack.Screen name="Auth" component={AuthNavigator} />
        }
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const splash = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandStage: { minWidth: 300, minHeight: 130, alignItems: 'center', justifyContent: 'center' },
  logoGlow: { position: 'absolute', width: 280, height: 120, borderRadius: 60, backgroundColor: 'rgba(22,168,255,0.20)' },
  tag:  { fontSize: 13, color: Colors.inkSecondary, marginTop: 18, fontWeight: '600' },
});

const recovery = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center', padding: 28 },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.ink, marginBottom: 10 },
  message: { maxWidth: 340, textAlign: 'center', fontSize: 15, lineHeight: 22, color: Colors.inkSecondary, marginBottom: 24 },
  primary: { minHeight: 48, minWidth: 260, borderRadius: 8, backgroundColor: Colors.brandNavy, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  primaryText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  secondary: { minHeight: 48, minWidth: 260, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, marginTop: 8 },
  secondaryText: { color: Colors.brandDark, fontSize: 15, fontWeight: '700' },
});
