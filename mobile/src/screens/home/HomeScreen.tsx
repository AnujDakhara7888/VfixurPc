import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, StatusBar, TouchableOpacity, useWindowDimensions, Animated, AccessibilityInfo, Easing, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { offersApi, placesApi, srApi } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import Brand from '@/components/Brand';
import StatusBadge from '@/components/StatusBadge';
import { Colors } from '@/theme';
import { useServiceCatalog, formatDeviceName } from '@/catalog/services';
import type { Offer, ServiceRequest } from '@/types';
import NotificationBell from '@/components/NotificationBell';
import { formatDateTime } from '@/utils/dateTime';
import { openGoogleReviewComposer, openGoogleReviews } from '@/utils/googleReviews';
import ServiceArtwork from '@/components/ServiceArtwork';

export default function HomeScreen({ navigation }: any) {
  const { top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const entrance = React.useRef(new Animated.Value(0)).current;
  const liveMotion = React.useRef(new Animated.Value(0)).current;
  const reviewScroll = React.useRef<ScrollView>(null);
  const [reviewIndex, setReviewIndex] = React.useState(0);
  const serviceColumns = width < 370 ? 2 : 3;
  const serviceWidth = Math.floor((width - 36 - (serviceColumns - 1) * 10) / serviceColumns);
  const { user } = useAuth();
  const services = useServiceCatalog();
  const requests = useQuery<ServiceRequest[]>({ queryKey: ['my-requests'], queryFn: srApi.list, refetchInterval: 30000 });
  const profile = useQuery({ queryKey: ['google-business-profile'], queryFn: placesApi.businessProfile, staleTime: 0, retry: 1, refetchOnMount: true, refetchInterval: 5 * 60 * 1000 });
  const offers = useQuery<Offer[]>({ queryKey: ['offers'], queryFn: offersApi.list, staleTime: 60000 });
  const visibleReviews = profile.data?.reviews ?? [];
  const reviewCount = profile.data?.reviewCount;
  const rating = profile.data?.rating;
  const reviewCardWidth = Math.max(236, width - 106);
  const carouselReviews = visibleReviews.slice(0, 6);
  const active = (requests.data ?? []).filter(r => !['DELIVERED', 'CANCELLED'].includes(r.status));
  const latest = active.find(r => r.status === 'QUOTATION_SHARED') ?? active[0];
  const otherRequests = active.filter(request => request.id !== latest?.id).slice(0, 3);
  const tabs = navigation.getParent();
  const primaryIds = ['laptop', 'desktop', 'mac', 'data', 'upgrade', 'virus'];
  const secondaryIds = ['network', 'cctv', 'backup', 'custom', 'business'];
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (reduced) entrance.setValue(1);
      else {
        Animated.timing(entrance, { toValue: 1, duration: 720, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        Animated.loop(Animated.sequence([
          Animated.timing(liveMotion, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(liveMotion, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])).start();
      }
    });
  }, [entrance, liveMotion]);
  const openService = (id: string) => tabs?.navigate('BookTab', { screen: 'Step1Device', params: { preselectCategory: id } });
  const moveReview = (direction: -1 | 1) => {
    const next = Math.max(0, Math.min(carouselReviews.length - 1, reviewIndex + direction));
    setReviewIndex(next);
    reviewScroll.current?.scrollTo({ x: next * (reviewCardWidth + 10), animated: true });
  };
  const renderServices = (ids: string[]) => services.data?.filter(service => ids.includes(service.id)).map((service, index) => (
    <Animated.View key={service.id} style={{ width: serviceWidth, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18 + index * 3, 0] }) }, { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={service.label} style={[s.service, { width: '100%' }]} onPress={() => openService(service.id)}>
      <ServiceArtwork category={service.id} size={52} />
      <Text style={s.serviceLabel} numberOfLines={2}>{service.label}</Text>
      <Text style={s.serviceTag} numberOfLines={2}>{service.tagline}</Text>
    </TouchableOpacity>
    </Animated.View>
  ));
  return <View style={[s.root, { paddingTop: top }]}>
    <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={requests.isRefetching || services.isRefetching || profile.isRefetching} onRefresh={() => { requests.refetch(); services.refetch(); profile.refetch(); }} />}>
      <View style={s.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open company information" onPress={() => tabs?.navigate('ProfileTab', { screen: 'Profile' })}><Brand size="md" /></TouchableOpacity>
        <NotificationBell />
      </View>
      <View style={s.greeting}><Text style={s.name}>Hi {user?.name?.trim().split(/\s+/)[0] || 'there'}</Text><Text style={s.subtitle}>Your tech is in safe hands.</Text></View>
      <View style={s.sectionHead}><Text style={s.title}>What we fix</Text><TouchableOpacity onPress={() => tabs?.navigate('BookTab')}><Text style={s.link}>All services</Text></TouchableOpacity></View>
      {services.isLoading && <Text style={s.muted}>Loading services...</Text>}
      {services.isError && <TouchableOpacity onPress={() => services.refetch()}><Text style={s.error}>Services could not load. Retry</Text></TouchableOpacity>}
      <View style={s.grid}>{renderServices(primaryIds)}</View>
      <Text style={[s.title, s.servicesTitle]}>Our services</Text>
      <View style={s.grid}>{renderServices(secondaryIds)}</View>
      {!!offers.data?.length && <View style={s.offersSection}>
        <View style={s.row}><View><Text style={s.offerEyebrow}>APP EXCLUSIVE</Text><Text style={s.title}>Offers for you</Text></View><Ionicons name="sparkles-outline" size={23} color={Colors.accentInk} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.offerRail}>
          {offers.data.map((offer, index) => <TouchableOpacity key={offer.id} style={[s.offerCard, index % 2 === 1 && s.offerCardAlt]} onPress={() => navigation.navigate('OfferDetail', { id: offer.id })}>
            <View style={s.offerTop}><View style={s.offerIcon}><Ionicons name={offer.offerType === 'CONSULTATION' ? 'chatbubbles-outline' : offer.offerType === 'FREE_ADD_ON' ? 'gift-outline' : 'pricetag-outline'} size={20} color="#fff" /></View><Text style={s.offerExpiry}>Until {new Date(offer.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text></View>
            <Text style={s.offerTitle}>{offer.title}</Text><Text style={s.offerBody} numberOfLines={2}>{offer.shortDescription}</Text>
            <View style={s.offerAction}><Text style={s.offerActionText}>{offer.ctaLabel}</Text><Ionicons name="arrow-forward" size={17} color="#fff" /></View>
          </TouchableOpacity>)}
        </ScrollView>
      </View>}
      {latest ? <TouchableOpacity style={[s.activeCard, s.activeCardAfterServices]} onPress={() => navigation.navigate('RequestDetail', { id: latest.id })}>
        <Animated.View pointerEvents="none" style={[s.liveSheen, { opacity: liveMotion.interpolate({ inputRange: [0, 1], outputRange: [.08, .18] }), transform: [{ translateX: liveMotion.interpolate({ inputRange: [0, 1], outputRange: [-120, width] }) }, { rotate: '16deg' }] }]} />
        <View style={s.row}><Text style={s.eyebrow}>ACTIVE REQUEST</Text><StatusBadge status={latest.status} size="sm" /></View>
        <Text style={s.activeName}>{formatDeviceName(latest.device)}</Text>
        <Text style={s.activeIssue} numberOfLines={1}>{latest.issues?.map(issue => issue.category).join(' · ') || 'Service request'}</Text>
        <View style={s.progressRow}>{homeProgress(latest.status).labels.map((label, index) => {
          const progress = homeProgress(latest.status);
          const complete = index < progress.current;
          const current = index === progress.current;
          return <View key={label} style={s.progressStep}><Animated.View style={[s.progressDot, complete && s.progressDone, current && s.progressCurrent, current && { transform: [{ scale: liveMotion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }] }]}>{complete ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}</Animated.View><Text style={s.progressLabel}>{label}</Text></View>;
        })}</View>
        <View style={s.heroDivider} />
        <View style={s.activeMetaRow}><View style={s.activeMeta}><Ionicons name="calendar-outline" size={19} color="#D7E7FA" /><View><Text style={s.metaLabel}>BOOKING</Text><Text style={s.metaValue}>{latest.booking?.reference || latest.serviceRequestNumber || latest.ticketNumber}</Text></View></View><View style={s.metaRule} /><View style={s.activeMeta}><Ionicons name="time-outline" size={19} color="#D7E7FA" /><View><Text style={s.metaLabel}>LAST UPDATED</Text><Text style={s.metaValue}>{formatDateTime(latest.updatedAt)}</Text></View></View></View>
        <View style={s.row}><Text style={s.activeTicket}>{latest.serviceRequestNumber ?? latest.ticketNumber}</Text><View style={s.detailsButton}><Text style={s.detailsText}>View details</Text><Ionicons name="arrow-forward" size={17} color="#fff" /></View></View>
      </TouchableOpacity> : null}
      <View style={s.section}>
        <View style={s.row}><Text style={s.title}>Your requests</Text><TouchableOpacity accessibilityRole="button" onPress={() => tabs?.navigate('OrdersTab')} style={s.linkButton}><Text style={s.link}>View all</Text><Ionicons name="arrow-forward" size={18} color={Colors.accentInk} /></TouchableOpacity></View>
        {requests.isError ? <TouchableOpacity onPress={() => requests.refetch()}><Text style={s.error}>Requests could not load. Retry</Text></TouchableOpacity> : requests.isLoading ? <Text style={s.muted}>Loading requests...</Text> : otherRequests.length ? otherRequests.map(request => <TouchableOpacity key={request.id} style={s.requestRow} onPress={() => navigation.navigate('RequestDetail', { id: request.id })}><View style={{ flex: 1 }}><Text style={s.ticket}>{request.serviceRequestNumber ?? request.ticketNumber}</Text><Text style={s.orderName} numberOfLines={1}>{formatDeviceName(request.device)}</Text></View><StatusBadge status={request.status} size="sm" /><Ionicons name="chevron-forward" size={18} color={Colors.inkSecondary} /></TouchableOpacity>) : <Text style={s.muted}>{latest ? 'No other active requests' : 'No active requests'}</Text>}
      </View>
      <View style={s.trustSection}>
        <View style={s.row}><Text style={s.trustTitle}>Why choose VfixurPC?</Text><Text style={s.trustMeta}>Reliable service</Text></View>
        <View style={s.trustRow}>
        {([
          ['car-outline', 'Pickup & drop', 'Safe and convenient'], ['shield-checkmark-outline', 'Expert diagnosis', 'Clear recommendations'], ['lock-closed-outline', 'Secure handling', 'Your data stays protected'],
        ] as const).map(([icon, title, detail]) => <View key={title} style={s.benefit}><Ionicons name={icon} size={21} color={Colors.brandBright} /><Text style={s.benefitTitle}>{title}</Text><Text style={s.benefitDetail}>{detail}</Text></View>)}
        </View>
      </View>
      <View style={s.reviewSection}>
        <View style={s.reviewHeader}><View style={s.googleMark}><Text style={s.googleG}>G</Text></View><View style={{ flex: 1 }}><Text style={s.reviewTitle}>{reviewCount != null ? `${reviewCount} Google reviews` : 'Google reviews'}</Text>{rating != null ? <View style={s.ratingRow}><Text style={s.stars}>★★★★★</Text><Text style={s.rating}>{rating.toFixed(1)}/5</Text></View> : <Text style={s.reviewUnavailable}>Live rating unavailable</Text>}</View><TouchableOpacity accessibilityRole="link" onPress={() => openGoogleReviewComposer(profile.data?.writeReviewUrl)}><Text style={s.writeReview}>Write a review</Text></TouchableOpacity></View>
        {carouselReviews.length ? <><ScrollView
          ref={reviewScroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={reviewCardWidth + 10}
          decelerationRate="fast"
          contentContainerStyle={s.reviewRail}
          onMomentumScrollEnd={(event) => setReviewIndex(Math.max(0, Math.min(carouselReviews.length - 1, Math.round(event.nativeEvent.contentOffset.x / (reviewCardWidth + 10)))))}
        >{carouselReviews.map((review, index) => <TouchableOpacity key={`${review.author}-${index}`} activeOpacity={.86} style={[s.reviewCard, { width: reviewCardWidth }]} onPress={() => openGoogleReviews(review.reviewUrl || profile.data?.mapsUrl)}><View style={s.reviewTop}>{review.authorPhoto ? <Image source={{ uri: review.authorPhoto }} style={s.avatarPhoto} /> : <View style={s.avatar}><Text style={s.avatarText}>{review.author.trim().charAt(0).toUpperCase()}</Text></View>}<View style={{ flex: 1 }}><Text style={s.reviewAuthor}>{review.author}</Text><Text style={s.reviewAge}>{review.relativeTime}</Text></View><Text style={s.reviewStars}>{'★'.repeat(Math.max(1, Math.min(5, review.rating)))}</Text></View><Text style={s.reviewText} numberOfLines={3}>“{review.text}”</Text></TouchableOpacity>)}</ScrollView>
        <View style={s.reviewControls}>
          <TouchableOpacity accessibilityLabel="Previous review" disabled={reviewIndex === 0} onPress={() => moveReview(-1)} style={[s.reviewArrow, reviewIndex === 0 && s.reviewArrowDisabled]}><Ionicons name="chevron-back" size={19} color={Colors.brandNavy} /></TouchableOpacity>
          <View style={s.reviewDots}>{carouselReviews.map((_, index) => <View key={index} style={[s.reviewDot, reviewIndex === index && s.reviewDotActive]} />)}</View>
          <TouchableOpacity accessibilityLabel="Next review" disabled={reviewIndex === carouselReviews.length - 1} onPress={() => moveReview(1)} style={[s.reviewArrow, reviewIndex === carouselReviews.length - 1 && s.reviewArrowDisabled]}><Ionicons name="chevron-forward" size={19} color={Colors.brandNavy} /></TouchableOpacity>
        </View>
        <Text style={s.reviewNotice}>{profile.data?.reviewsNotice || 'Reviews shown here are selected by Google and ordered by relevance.'}</Text></> : <View style={s.reviewEmpty}><Ionicons name="cloud-offline-outline" size={22} color={Colors.inkSecondary} /><Text style={s.reviewEmptyText}>{profile.isPending ? 'Loading live Google reviews...' : 'Live reviews are temporarily unavailable.'}</Text>{profile.isError ? <TouchableOpacity onPress={() => { void profile.refetch(); }}><Text style={s.retryReview}>Try again</Text></TouchableOpacity> : null}</View>}
        <TouchableOpacity accessibilityRole="link" style={s.reviewFallback} onPress={() => openGoogleReviews(profile.data?.mapsUrl)}><Text style={s.reviewMeta}>See all reviews on Google</Text><Ionicons name="open-outline" size={16} color={Colors.accentInk} /></TouchableOpacity>
      </View>
      <Text style={s.footer}>VfixurPC · Mumbai</Text>
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp }, content: { padding: 18, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  greeting: { paddingBottom: 15, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.line },
  name: { fontSize: 25, fontWeight: '800', color: Colors.ink },
  title: { fontSize: 21, fontWeight: '700', color: Colors.ink, flexShrink: 1 },
  subtitle: { fontSize: 14, lineHeight: 20, color: Colors.inkSecondary, marginTop: 4 },
  muted: { color: Colors.inkSecondary, fontSize: 14, lineHeight: 21 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  service: { minHeight: 142, padding: 12, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8 },
  icon: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  serviceLabel: { color: Colors.ink, fontSize: 13, lineHeight: 17, fontWeight: '800', paddingRight: 12, marginTop: 9 },
  serviceTag: { color: Colors.inkSecondary, fontSize: 11, lineHeight: 15, marginTop: 4 },
  servicesTitle: { marginTop: 22, marginBottom: 12 },
  offersSection: { marginTop: 24 }, offerEyebrow: { color: Colors.accentInk, fontSize: 9, fontWeight: '900', marginBottom: 2 }, offerRail: { gap: 10, paddingTop: 12, paddingRight: 18 },
  offerCard: { width: 268, minHeight: 190, borderRadius: 8, padding: 16, backgroundColor: '#095A9B' }, offerCardAlt: { backgroundColor: Colors.brandNavy },
  offerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, offerIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,.15)', alignItems: 'center', justifyContent: 'center' }, offerExpiry: { color: '#C9DDF2', fontSize: 10, fontWeight: '700' },
  offerTitle: { color: '#fff', fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 14 }, offerBody: { color: '#D5E6F5', fontSize: 12, lineHeight: 18, marginTop: 5 }, offerAction: { marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 5 }, offerActionText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  section: { paddingTop: 24, marginTop: 16, borderTopWidth: 1, borderTopColor: Colors.line, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  link: { color: Colors.accentInk, fontSize: 14, fontWeight: '600' },
  activeCard: { backgroundColor: Colors.brandNavy, borderRadius: 8, padding: 16, marginBottom: 22, gap: 12, overflow: 'hidden' },
  liveSheen: { position: 'absolute', top: -80, bottom: -80, width: 64, backgroundColor: '#8DC4FF' },
  activeCardAfterServices: { marginTop: 22, marginBottom: 0 },
  eyebrow: { color: '#C8DCFA', fontSize: 11, fontWeight: '800' },
  activeName: { color: '#fff', fontSize: 19, fontWeight: '800' },
  activeIssue: { color: '#D2E1F4', fontSize: 12.5, marginTop: -6 },
  activeTicket: { color: '#C8DCFA', fontSize: 13, fontWeight: '600' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  progressStep: { flex: 1, alignItems: 'center', gap: 5 },
  progressDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: '#8CA9CC', backgroundColor: Colors.brandNavy, alignItems: 'center', justifyContent: 'center' },
  progressDone: { backgroundColor: '#31C78A', borderColor: '#31C78A' }, progressCurrent: { backgroundColor: Colors.warning, borderColor: '#FFE182' },
  progressLabel: { color: '#D9E6F5', fontSize: 9.5 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,.22)', marginTop: 2 },
  activeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeMeta: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 8, alignItems: 'center' },
  metaRule: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,.2)' },
  metaLabel: { color: '#9EB9D9', fontSize: 8.5, fontWeight: '800' },
  metaValue: { color: '#fff', fontSize: 10.5, fontWeight: '700', marginTop: 2, flexShrink: 1 },
  detailsButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,.45)' }, detailsText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  order: { padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.line, borderRadius: 8 },
  ticket: { fontSize: 12, fontWeight: '700', color: Colors.accentInk },
  orderName: { color: Colors.ink, fontSize: 17, fontWeight: '600' },
  requestRow: { minHeight: 64, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: Colors.line },
  trustSection: { backgroundColor: Colors.brandNavy, borderRadius: 8, padding: 14, marginTop: 20 },
  trustTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  trustMeta: { color: '#B9CCE4', fontSize: 11, marginBottom: 12 },
  trustRow: { flexDirection: 'row', gap: 8 },
  benefit: { flex: 1, gap: 6, minWidth: 0 },
  benefitTitle: { color: '#fff', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  benefitDetail: { color: '#B9CCE4', fontSize: 9.5, lineHeight: 13 },
  reviewSection: { marginTop: 12, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, paddingVertical: 14, overflow: 'hidden' },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14 },
  googleMark: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bgApp, alignItems: 'center', justifyContent: 'center' },
  googleG: { color: '#4285F4', fontSize: 24, fontWeight: '900' },
  reviewTitle: { color: Colors.ink, fontSize: 14, fontWeight: '800' },
  reviewUnavailable: { color: Colors.inkSecondary, fontSize: 11, marginTop: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  stars: { color: '#F7B500', fontSize: 13, letterSpacing: 0 },
  rating: { color: Colors.ink, fontSize: 12, fontWeight: '800' },
  writeReview: { color: Colors.accentInk, fontSize: 12, fontWeight: '800', paddingVertical: 12 },
  reviewRail: { paddingHorizontal: 14, paddingTop: 12, gap: 10 },
  reviewCard: { minHeight: 116, backgroundColor: Colors.bgApp, borderRadius: 8, padding: 12, justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.line },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EDE7FF', alignItems: 'center', justifyContent: 'center' },
  avatarPhoto: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.brandSoft },
  avatarText: { color: '#6642C1', fontWeight: '900', fontSize: 15 },
  reviewStars: { color: '#F7B500', fontSize: 13 },
  reviewText: { color: Colors.ink, fontSize: 13, lineHeight: 19, marginVertical: 7 },
  reviewAuthor: { color: Colors.inkSecondary, fontSize: 11.5, fontWeight: '600' },
  reviewAge: { color: Colors.inkTertiary, fontSize: 10, marginTop: 2 },
  reviewMeta: { color: Colors.inkSecondary, fontSize: 12 },
  reviewNotice: { color: Colors.inkTertiary, fontSize: 9.5, lineHeight: 13, textAlign: 'center', paddingHorizontal: 18, paddingTop: 4 },
  reviewFallback: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingTop: 13 },
  reviewControls: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 7 },
  reviewArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  reviewArrowDisabled: { opacity: .28 },
  reviewDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reviewDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.gray300 },
  reviewDotActive: { width: 16, backgroundColor: Colors.accent },
  reviewEmpty: { minHeight: 112, margin: 14, padding: 16, borderRadius: 8, backgroundColor: Colors.bgApp, alignItems: 'center', justifyContent: 'center', gap: 7 },
  reviewEmptyText: { color: Colors.inkSecondary, fontSize: 12, textAlign: 'center' },
  retryReview: { color: Colors.accentInk, fontSize: 12, fontWeight: '800', paddingVertical: 6 },
  footer: { textAlign: 'center', fontSize: 12, color: Colors.inkSecondary, marginTop: 24 },
  error: { color: Colors.error, paddingVertical: 12 },
});

function homeProgress(status: string) {
  const labels = ['Received', 'Diagnosis', 'Quote', 'Repair', 'Ready'];
  const stages: Record<string, number> = {
    REQUEST_RECEIVED: 0, PICKUP_SCHEDULED: 0, PICKED_UP: 0,
    RECEIVED_AT_WORKSHOP: 1, DIAGNOSING: 1,
    DIAGNOSED: 2, QUOTATION_SHARED: 2, QUOTE_APPROVED: 2, QUOTE_REJECTED: 2,
    PAYMENT_RECEIVED: 3, AWAITING_PARTS: 3, UNDER_REPAIR: 3, TESTING: 3, REPAIR_COMPLETE: 3,
    READY_FOR_HANDOVER: 4, OUT_FOR_DELIVERY: 4, DELIVERED: 4,
  };
  return { labels, current: stages[status] ?? 0 };
}
