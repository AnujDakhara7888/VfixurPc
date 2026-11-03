import React, { useState, useRef } from "react";
import * as Crypto from 'expo-crypto';
import { useBooking, BookingDraft } from '@/context/BookingContext';
import AttachmentPreview from '@/components/AttachmentPreview';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { Calendar } from 'react-native-calendars';
import { formatDateOnly, formatTimeSlot } from '@/utils/dateTime';
import {
  slotsApi,
  srApi,
  offersApi,
  api,
  getApiErrorMessage,
} from "@/api/client";
import {
  useServiceCatalog,
  MODE_LABELS,
  OFFICE_ADDRESS,
} from "@/catalog/services";
import { useAuth } from "@/context/AuthContext";
import LargeHeader from "@/components/LargeHeader";
import BookingBar from "@/components/BookingBar";
import Input from "@/components/Input";
import AddressInput from '@/components/AddressInput';
import { Colors } from "@/theme";
import type { AppliedDiscount, PickupSlot } from "@/types";
import legal from "@/content/legal.json";
import Toast from "react-native-toast-message";
import StepIndicator from './StepIndicator';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_E164, supportWhatsAppUrl } from '@/config/contact';
import { findServiceAreaLocality, isInServiceArea } from '@/config/serviceArea';
export default function Step3PickupScreen({ navigation, route }: any) {
  const { categoryId, bookingAnswers, issues, media = [] } = route.params;
  const booking = useBooking();
  const current: BookingDraft = { key: route.params.draftKey ?? route.key, categoryId, bookingAnswers, issues, media, deviceId: route.params.deviceId };
  const drafts = [...booking.drafts.filter(d => d.key !== current.key), current];
  const [locked, setLocked] = useState(false);
  const submitted = useRef<any>(null);
  const scroll = useRef<ScrollView>(null);
  const [preview, setPreview] = useState<{ uri: string; name: string; mime: string } | null>(null);
  const { data: catalog } = useServiceCatalog();
  const category = catalog?.find((c) => c.id === categoryId);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState(category?.modes[0] ?? "PICKUP");
  const [address, setAddress] = useState(""),
    [date, setDate] = useState(""),
    [slot, setSlot] = useState<PickupSlot | null>(null);
  const [unit, setUnit] = useState('');
  const fullAddress = [unit.trim(), address.trim()].filter(Boolean).join(', ');
  const matchedLocality = mode === 'PICKUP' ? findServiceAreaLocality(address) : null;
  const pickupAreaChecked = mode === 'PICKUP' && address.trim().length >= 8;
  const pickupOutOfArea = pickupAreaChecked && !matchedLocality;
  const [notes, setNotes] = useState(""),
    [accepted, setAccepted] = useState(false),
    [recoveryConsent, setRecoveryConsent] = useState(false);
  const [policy, setPolicy] = useState<"privacy" | "terms" | null>(null);
  const [review, setReview] = useState(false);
  const [discountCode, setDiscountCode] = useState(booking.suggestedDiscountCode ?? '');
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  React.useEffect(() => {
    if (review) requestAnimationFrame(() => scroll.current?.scrollTo({ y: 0, animated: false }));
  }, [review]);
  const {
    data: slots = [],
    isError: slotError,
    refetch,
  } = useQuery<PickupSlot[]>({
    queryKey: ["pickup-slots"],
    queryFn: slotsApi.list,
  });
  const needsAddress = mode === "PICKUP" || mode === "ON_SITE";
  const activeSlots = slots.filter((candidate) => candidate.isActive !== false);
  const todayValue = format(new Date(), "yyyy-MM-dd");
  const availableSlots = activeSlots.filter((candidate) => {
    if (date !== todayValue) return true;
    const [hours, minutes] = candidate.startTime.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return true;
    const startsAt = new Date();
    startsAt.setHours(hours, minutes, 0, 0);
    return startsAt.getTime() > Date.now();
  });
  const modes =
    category?.modes.filter(m => drafts.every(d => catalog?.find(c => c.id === d.categoryId)?.modes.includes(m))).filter(
      (m) =>
        !(
          categoryId === "virus" &&
          issues.some((i: any) => /ransomware|compromised/.test(i.category)) &&
          m === "REMOTE"
        ),
    ) ?? [];
  React.useEffect(() => {
    if (modes.length && !modes.includes(mode)) setMode(modes[0]);
  }, [modes.join(",")]);
  const validateDiscount = useMutation({
    mutationFn: () => offersApi.validateCode(discountCode.trim(), drafts.map(d => d.categoryId)),
    onSuccess: (result: AppliedDiscount) => {
      setAppliedDiscount(result);
      Toast.show({ type: 'success', text1: result.title, text2: result.description });
    },
    onError: (error: any) => {
      setAppliedDiscount(null);
      Toast.show({ type: 'error', text1: 'Code not applied', text2: getApiErrorMessage(error) });
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      if (!submitted.current) {
        submitted.current = {
          id: Crypto.randomUUID(), discountCode: appliedDiscount?.code, feePolicyVersion: '2026-10-02', feesAccepted: accepted,
          requests: drafts.map(d => ({
            deviceId: d.deviceId,
            ...(!d.deviceId && catalog?.find(c => c.id === d.categoryId)?.needsDevice ? {
              newDevice: {
                brand: d.categoryId === 'mac' ? 'Apple' : String(d.bookingAnswers.brand || 'Not sure'),
                model: String(d.bookingAnswers.model || d.bookingAnswers.deviceType || 'Not sure'),
                serialNumber: d.bookingAnswers.serial || undefined,
              },
            } : {}),
            serviceCategory: d.categoryId, serviceMode: mode,
            bookingAnswers: { ...d.bookingAnswers, ...(d.categoryId === 'data' ? { dataRecoveryConsent: 'Accepted' } : {}) },
            issues: d.issues, pickupSlotDate: date,
            pickupSlotTime: slot!.startTime + ' - ' + slot!.endTime,
            pickupAddress: needsAddress ? fullAddress : mode === 'CARRY_IN' ? OFFICE_ADDRESS : MODE_LABELS[mode],
            notes, termsAccepted: accepted, policyVersion: legal.version,
          })),
        };
      }
      setLocked(true);
      return srApi.createBooking(submitted.current);
    },
    onSuccess: async (result) => {
      let failed = 0;
      for (let index = 0; index < drafts.length; index++) {
        for (const asset of drafts[index].media) {
          try {
            const fd = new FormData();
            fd.append("file", { uri: asset.uri, name: asset.fileName ?? "device.jpg", type: asset.mimeType ?? "image/jpeg" } as any);
            fd.append("caption", "Customer device / issue photo");
            await api.post("/service-requests/" + result.requests[index].id + "/attachments", fd, {
              headers: { "Content-Type": "multipart/form-data" }, timeout: 60000,
            });
          } catch { failed++; }
        }
      }
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["devices"] });
      booking.clear();
      navigation.replace("BookingSuccess", {
        ticketNumber: result.requests[0].ticketNumber ?? result.requests[0].serviceRequestNumber, id: result.requests[0].id, mode, count: result.requests.length,
      });
      if (failed) Toast.show({ type: "info", text1: "Booking confirmed", text2: "Some attachments did not upload. Retry from the relevant device request." });
    },
    onError: (e: any) => {
      if (e.response?.status >= 400 && e.response?.status < 500) { submitted.current = null; setLocked(false); }
      Toast.show({
        type: "error", text1: "Booking not confirmed",
        text2: getApiErrorMessage(e) + (submitted.current ? " Retry to check the same booking; do not create a duplicate." : ""),
      });
    },
  });
  function next() {
    if (locked) { create.mutate(); return; }
    if (!modes.length) { Toast.show({ type: 'error', text1: 'These services need separate appointments' }); return; }
    if ((needsAddress && !address.trim()) || !date || !slot) {
      Toast.show({
        type: "error",
        text1: "Complete the address, date and time",
      });
      return;
    }
    if (mode === 'PICKUP' && !isInServiceArea(address)) {
      Toast.show({
        type: 'error',
        text1: 'Pickup is unavailable for this area',
        text2: 'Choose workshop drop-off or contact our team.',
      });
      return;
    }
    if (discountCode.trim() && !appliedDiscount) {
      Toast.show({ type: 'error', text1: 'Apply or clear the discount code first' });
      return;
    }
    if (!accepted || (drafts.some(d => d.categoryId === 'data') && !recoveryConsent)) {
      Toast.show({
        type: "error",
        text1: "Please review and accept the service terms",
      });
      return;
    }
    if (review) create.mutate();
    else setReview(true);
  }
  return (
    <View style={s.root}>
      <LargeHeader
        title={review ? "Review request" : "Arrange your service"}
        onBack={() => { if (!locked) review ? setReview(false) : navigation.goBack(); }}
      />
      <StepIndicator current={review ? 3 : 2} total={4} labels={['Service', 'Details', 'Arrange', 'Confirm']} />
      <ScrollView
        ref={scroll}
        style={s.scroller}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.heading}>{drafts.length > 1 ? drafts.length + ' devices / services' : category?.label}</Text>
        {!modes.length && <Text style={s.text}>These services have no shared service option. Remove a saved item below or submit separate bookings.</Text>}
        {!review && booking.drafts.filter(d => d.key !== current.key).map(d => <View key={d.key} style={s.savedRow}>
          <View style={s.savedCopy}>
            <Text style={s.savedTitle}>{catalog?.find(c => c.id === d.categoryId)?.label}</Text>
            <Text style={s.savedMeta} numberOfLines={2}>{d.issues.map(i => i.category).join(', ')}</Text>
          </View>
          {!locked && <TouchableOpacity accessibilityLabel="Remove device from booking" onPress={() => booking.remove(d.key)} style={s.iconButton}><Ionicons name="trash-outline" size={22} color={Colors.error} /></TouchableOpacity>}
        </View>)}
        <View style={s.feeBox}>
          <View style={s.feeHeader}><View style={s.feeIcon}><Ionicons name={mode === 'PICKUP' ? 'car-outline' : 'receipt-outline'} size={20} color={Colors.accentInk} /></View><View style={{ flex: 1 }}><Text style={s.feeTitle}>{mode === 'PICKUP' ? 'Pickup & delivery fee' : 'Service fee summary'}</Text><Text style={s.feeSubtitle}>{mode === 'PICKUP' ? 'Charged once for this booking' : 'No transport fee for this option'}</Text></View></View>
          {mode === 'PICKUP' ? <>
            <View style={s.feeRow}><Text style={s.feeLabel}>Pickup & delivery charges</Text><Text style={s.feeValue}>₹350</Text></View>
            <View style={s.feeRow}><Text style={s.feeLabel}>GST (18%)</Text><Text style={s.feeValue}>₹63</Text></View>
            <View style={s.feeTotalRow}><Text style={s.feeTotalLabel}>Total</Text><Text style={s.feeTotalValue}>₹413</Text></View>
          </> : <View style={s.noFeeRow}><Ionicons name="checkmark-circle" size={19} color={Colors.success} /><Text style={s.noFeeText}>No pickup or delivery fee</Text></View>}
          <View style={s.diagnosisBox}>
            <View style={s.diagnosisHead}><Ionicons name="search-outline" size={18} color="#815A00" /><Text style={s.diagnosisTitle}>Only if a repair quote is declined</Text></View>
            <Text style={s.diagnosisCopy}>Diagnostic fee per device</Text>
            <View style={s.diagnosisMath}><Text style={s.diagnosisPart}>₹500 service</Text><Text style={s.diagnosisPlus}>+</Text><Text style={s.diagnosisPart}>₹90 GST</Text><Text style={s.diagnosisEquals}>=</Text><Text style={s.diagnosisTotal}>₹590</Text></View>
            <Text style={s.diagnosisNote}>Return delivery is separate and applies only when requested.</Text>
          </View>
          <Text style={s.feeNote}>Repair work is quoted separately and starts only after your approval. Nothing is collected online now.</Text>
        </View>
        {review ? (
          <>
            <View style={s.reviewSummary}>
              <View style={s.reviewSummaryHead}><View style={s.reviewSummaryIcon}><Ionicons name="calendar-outline" size={21} color={Colors.accentInk} /></View><View><Text style={s.reviewSummaryTitle}>Appointment</Text><Text style={s.reviewSummarySub}>Please check these details before submitting</Text></View></View>
              <View style={s.reviewFacts}>
                <View style={s.reviewFact}><Text style={s.reviewFactLabel}>SERVICE OPTION</Text><Text style={s.reviewFactValue}>{MODE_LABELS[mode]}</Text></View>
                <View style={s.reviewFactRule} />
                <View style={s.reviewFact}><Text style={s.reviewFactLabel}>DATE</Text><Text style={s.reviewFactValue}>{formatDateOnly(date)}</Text></View>
                <View style={s.reviewFactRule} />
                <View style={s.reviewFact}><Text style={s.reviewFactLabel}>TIME</Text><Text style={s.reviewFactValue}>{formatTimeSlot(slot?.startTime + ' - ' + slot?.endTime)}</Text></View>
              </View>
            </View>
            <View style={s.detailCard}><View style={s.detailIcon}><Ionicons name={needsAddress ? 'location-outline' : mode === 'CARRY_IN' ? 'business-outline' : 'chatbubble-ellipses-outline'} size={20} color={Colors.accentInk} /></View><View style={{ flex: 1 }}><Text style={s.detailLabel}>{needsAddress ? mode === 'ON_SITE' ? 'Visit address' : 'Pickup address' : mode === 'CARRY_IN' ? 'Workshop address' : 'What happens next'}</Text><Text style={s.detailValue}>{needsAddress ? fullAddress : mode === 'CARRY_IN' ? OFFICE_ADDRESS : 'Our team will contact you for your appointment.'}</Text></View></View>
            {user?.phone ? <View style={s.detailCard}><View style={s.detailIcon}><Ionicons name="notifications-outline" size={20} color={Colors.accentInk} /></View><View style={{ flex: 1 }}><Text style={s.detailLabel}>Booking updates</Text><Text style={s.detailValue}>Sent to {user.phone}</Text></View></View> : null}
            {appliedDiscount ? <View style={s.discountApplied}><View style={s.discountCheck}><Ionicons name="checkmark" size={18} color="#fff" /></View><View style={{ flex: 1 }}><Text style={s.discountTitle}>{appliedDiscount.title}</Text><Text style={s.discountBody}>{appliedDiscount.description}</Text><Text style={s.discountCode}>{appliedDiscount.code}</Text></View></View> : null}
            <Text style={s.reviewServicesTitle}>{drafts.length > 1 ? 'Services in this booking' : 'Service details'}</Text>
            {drafts.map((draft, index) => {
              const service = catalog?.find(c => c.id === draft.categoryId);
              return <View key={draft.key} style={s.reviewItem}>
                <View style={s.reviewItemHead}><View style={s.reviewNumber}><Text style={s.reviewNumberText}>{index + 1}</Text></View><Text style={s.savedTitle}>{service?.label}</Text></View>
                {Object.entries(draft.bookingAnswers).filter(([, value]) => String(value)).map(([key, value]) => (
                  <View key={key} style={s.reviewDataRow}><Text style={s.reviewDataLabel}>{key === 'requestedUpgrades' ? 'Requested upgrades' : service?.fields.find(field => field.id === key)?.label ?? key}</Text><Text style={s.reviewDataValue}>{Array.isArray(value) ? value.join(', ') : String(value)}</Text></View>
                ))}
                {draft.categoryId !== 'upgrade' ? (
                  <View style={s.reviewDataRow}><Text style={s.reviewDataLabel}>Help needed</Text><Text style={s.reviewDataValue}>{draft.issues.map(issue => issue.category).join(', ')}</Text></View>
                ) : null}
                {draft.media.map((asset, assetIndex) => <TouchableOpacity key={asset.uri} onPress={() => setPreview({ uri: asset.uri, name: asset.fileName ?? 'Attachment ' + (assetIndex + 1), mime: asset.mimeType ?? 'image/jpeg' })}><Text style={s.link}>Preview attachment {assetIndex + 1}</Text></TouchableOpacity>)}
              </View>;
            })}
            {notes ? <View style={s.detailCard}><View style={s.detailIcon}><Ionicons name="create-outline" size={20} color={Colors.accentInk} /></View><View style={{ flex: 1 }}><Text style={s.detailLabel}>Instructions</Text><Text style={s.detailValue}>{notes}</Text></View></View> : null}
          </>
        ) : (
          <View pointerEvents={locked ? 'none' : 'auto'}>
            <Text style={s.label}>Service option</Text>
            {modes.map((m) => (
              <TouchableOpacity
                key={m}
                style={s.option}
                onPress={() => { setMode(m); setAddress(''); setUnit(''); setDate(''); setSlot(null); }}
                accessibilityRole="radio"
                accessibilityState={{ checked: mode === m }}
              >
                <Ionicons
                  name={mode === m ? "radio-button-on" : "radio-button-off"}
                  size={23}
                  color={Colors.accentInk}
                />
                <Text style={s.text}>{MODE_LABELS[m]}</Text>
              </TouchableOpacity>
            ))}
            {needsAddress ? (
              <View>
              <AddressInput
                label={mode === "ON_SITE" ? "Visit address" : "Pickup address"}
                value={address}
                onChangeText={setAddress}
              />
              <Input label="Flat / house number, floor (optional)" value={unit} onChangeText={setUnit} placeholder="e.g. Flat 402, 4th floor" />
              {mode === 'PICKUP' ? (
                <>
                  <Text style={s.coverageHint}>Pickup is available only in our listed Mumbai service areas, approximately up to 15 km from the workshop.</Text>
                  {matchedLocality ? (
                    <View style={s.areaEligible}><Ionicons name="checkmark-circle" size={20} color={Colors.success} /><Text style={s.areaEligibleText}>Pickup available in {matchedLocality}</Text></View>
                  ) : pickupOutOfArea ? (
                    <View style={s.areaUnavailable}>
                      <View style={s.areaUnavailableHead}><Ionicons name="location-outline" size={22} color="#8A5800" /><View style={{ flex: 1 }}><Text style={s.areaUnavailableTitle}>Pickup is not available at this address</Text><Text style={s.areaUnavailableCopy}>You can drop the device at our Vile Parle West workshop. For exceptional requests, contact our team.</Text></View></View>
                      {modes.includes('CARRY_IN') ? <TouchableOpacity style={s.carryInButton} onPress={() => { setMode('CARRY_IN'); setAddress(''); setUnit(''); }}><Ionicons name="business-outline" size={18} color="#fff" /><Text style={s.carryInButtonText}>Choose workshop drop-off</Text></TouchableOpacity> : null}
                      <View style={s.contactRow}>
                        <TouchableOpacity style={s.contactButton} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE_E164}`)}><Ionicons name="call-outline" size={17} color={Colors.accentInk} /><Text style={s.contactButtonText}>{SUPPORT_PHONE_DISPLAY}</Text></TouchableOpacity>
                        <TouchableOpacity style={s.contactButton} onPress={() => Linking.openURL(supportWhatsAppUrl('I need help with pickup availability for my address.'))}><Ionicons name="logo-whatsapp" size={18} color="#0A8F4C" /><Text style={s.contactButtonText}>WhatsApp</Text></TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}
              </View>
            ) : mode === "CARRY_IN" ? (
              <View style={s.notice}>
                <Text style={s.text}>{OFFICE_ADDRESS}</Text>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL(
                      "https://www.google.com/maps/search/?api=1&query=" +
                        encodeURIComponent(OFFICE_ADDRESS),
                    )
                  }
                >
                  <Text style={s.link}>View workshop on map</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE_E164}`)}><Text style={s.link}>Call us for help (optional)</Text></TouchableOpacity>
              </View>
            ) : (
              <Text style={s.text}>
                {mode === "REMOTE"
                  ? "Our technician will contact you. Remote access begins only with your permission."
                  : "Our team will call to discuss your requirements."}
              </Text>
            )}
            <Text style={s.label}>Preferred date</Text>
            <View style={s.calendar}>
              <Calendar
                minDate={todayValue}
                maxDate={format(addDays(new Date(), 60), 'yyyy-MM-dd')}
                onDayPress={day => { setDate(day.dateString); setSlot(null); }}
                markedDates={{
                  [todayValue]: { marked: true, dotColor: Colors.accent },
                  ...(date ? { [date]: { selected: true, selectedColor: Colors.brandNavy, marked: date === todayValue, dotColor: '#fff' } } : {}),
                }}
                enableSwipeMonths
                hideExtraDays={false}
                showSixWeeks
                firstDay={0}
                renderArrow={direction => <Ionicons name={direction === 'left' ? 'chevron-back' : 'chevron-forward'} size={22} color={Colors.accentInk} />}
                theme={{
                  calendarBackground: '#fff', textSectionTitleColor: Colors.inkSecondary,
                  selectedDayBackgroundColor: Colors.brandNavy, selectedDayTextColor: '#fff',
                  todayTextColor: Colors.accentInk, dayTextColor: Colors.ink,
                  textDisabledColor: Colors.gray300, arrowColor: Colors.accentInk,
                  monthTextColor: Colors.ink, textMonthFontSize: 17, textMonthFontWeight: '900', textDayFontWeight: '600',
                }}
              />
              <View style={s.calendarActions}>
                <TouchableOpacity onPress={() => { setDate(''); setSlot(null); }} style={s.calendarAction}><Text style={s.calendarActionText}>Clear</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setDate(todayValue); setSlot(null); }} style={s.calendarAction}><Text style={s.calendarActionText}>Today</Text></TouchableOpacity>
              </View>
            </View>
            <Text style={s.label}>Preferred time</Text>
            {slotError ? (
              <TouchableOpacity onPress={() => refetch()}>
                <Text style={s.link}>Could not load slots. Retry</Text>
              </TouchableOpacity>
            ) : null}
            {!slotError && !activeSlots.length ? (
              <Text style={s.text}>
                No appointment slots are available. Please contact support.
              </Text>
            ) : null}
            {!slotError && date === todayValue && activeSlots.length > 0 && availableSlots.length === 0 ? (
              <Text style={s.text}>Today is fully booked. Please choose another date.</Text>
            ) : null}
            <View style={s.dates}>
              {availableSlots.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[s.date, slot?.id === v.id && s.selected]}
                    onPress={() => setSlot(v)}
                  >
                    <Text
                      style={{ color: slot?.id === v.id ? "#fff" : Colors.ink }}
                    >
                      {formatTimeSlot(v.startTime + ' - ' + v.endTime)}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
            <Text style={s.label}>Promo or referral code</Text>
            <Text style={s.helper}>Enter an admin promo code or a friend’s VfixurPC username. Referral codes work only on your first booking.</Text>
            <View style={s.codeRow}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Code (optional)"
                  value={discountCode}
                  onChangeText={(value) => { setDiscountCode(value); setAppliedDiscount(null); }}
                  placeholder="e.g. SAVE150 or friend_username"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <TouchableOpacity
                disabled={!discountCode.trim() || validateDiscount.isPending}
                onPress={() => validateDiscount.mutate()}
                style={[s.applyButton, (!discountCode.trim() || validateDiscount.isPending) && s.applyButtonDisabled]}
              >
                <Text style={s.applyButtonText}>{validateDiscount.isPending ? 'Checking' : appliedDiscount ? 'Applied' : 'Apply'}</Text>
              </TouchableOpacity>
            </View>
            {appliedDiscount ? <View style={s.appliedInline}><Ionicons name="checkmark-circle" size={20} color={Colors.success} /><View style={{ flex: 1 }}><Text style={s.discountTitle}>{appliedDiscount.title}</Text><Text style={s.discountBody}>{appliedDiscount.description}</Text></View><TouchableOpacity onPress={() => { setDiscountCode(''); setAppliedDiscount(null); }}><Ionicons name="close" size={20} color={Colors.inkSecondary} /></TouchableOpacity></View> : null}
            <Input
              label="Additional instructions (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <TouchableOpacity
              style={s.option}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              onPress={() => setAccepted(!accepted)}
            >
              <Ionicons
                name={accepted ? "checkbox" : "square-outline"}
                size={24}
                color={Colors.accentInk}
              />
              <Text style={s.text}>
                I accept the Terms of Service, Privacy Policy and fees shown above.
              </Text>
            </TouchableOpacity>
            <View style={s.dates}>
              <TouchableOpacity onPress={() => setPolicy("terms")}>
                <Text style={s.link}>Terms of Service</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPolicy("privacy")}>
                <Text style={s.link}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
            {drafts.some(d => d.categoryId === 'data') ? (
              <TouchableOpacity
                style={s.option}
                onPress={() => setRecoveryConsent(!recoveryConsent)}
              >
                <Ionicons
                  name={recoveryConsent ? "checkbox" : "square-outline"}
                  size={24}
                  color={Colors.accentInk}
                />
                <Text style={s.text}>
                  I am authorised to submit this storage device. I understand
                  recovery is not guaranteed and authorise inspection for the
                  requested recovery service.
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        {!review && !locked && drafts.length < 10 && <TouchableOpacity style={s.option} onPress={() => { booking.add(current); navigation.popToTop(); }}><Ionicons name="add-circle-outline" size={24} color={Colors.accentInk} /><Text style={s.link}>Add another device or service</Text></TouchableOpacity>}
        {locked && !create.isPending && <Text style={s.text}>Retry to confirm this same booking. Its details are locked to prevent duplicate requests.</Text>}
      </ScrollView>
      <BookingBar
        label={locked ? 'Retry booking' : review ? 'Submit booking' : 'Review booking'}
        loading={create.isPending}
        onPress={next}
      />
      <AttachmentPreview source={preview} onClose={() => setPreview(null)} />
      <Modal
        visible={!!policy}
        animationType="slide"
        onRequestClose={() => setPolicy(null)}
        presentationStyle="fullScreen"
        statusBarTranslucent={false}
        navigationBarTranslucent={false}
        hardwareAccelerated
      >
        <View style={s.legalRoot}>
          <LargeHeader
            title={policy === "terms" ? "Terms of Service" : "Privacy Policy"}
            onBack={() => setPolicy(null)}
          />
          <FlatList
            data={policy ? legal[policy] : []}
            keyExtractor={(_, index) => String(index)}
            style={s.legalScroll}
            contentContainerStyle={s.legalContent}
            overScrollMode="always"
            showsVerticalScrollIndicator
            renderItem={({ item }) => <Text style={s.legalParagraph}>{item}</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  scroller: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.ink,
    marginBottom: 20,
  },
  label: { fontSize: 16, fontWeight: "700", marginTop: 20, marginBottom: 12 },
  text: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.inkSecondary,
    flexShrink: 1,
    marginBottom: 10,
  },
  option: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 12,
  },
  dates: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  date: {
    borderWidth: 1,
    borderColor: Colors.lineStrong,
    borderRadius: 8,
    padding: 12,
  },
  selected: {
    backgroundColor: Colors.brandNavy,
    borderColor: Colors.brandNavy,
  },
  selectedText: { color: "#fff" },
  calendar: { borderWidth: 1, borderColor: Colors.lineStrong, borderRadius: 8, overflow: 'hidden', marginBottom: 4, backgroundColor: '#fff' },
  calendarActions: { minHeight: 48, borderTopWidth: 1, borderTopColor: Colors.line, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarAction: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  calendarActionText: { color: Colors.accentInk, fontSize: 15, fontWeight: '800' },
  helper: { color: Colors.inkSecondary, fontSize: 12, lineHeight: 18, marginTop: -6, marginBottom: 8 },
  coverageHint: { color: Colors.inkSecondary, fontSize: 12, lineHeight: 18, marginTop: -6, marginBottom: 10 },
  areaEligible: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#BDE7D0', backgroundColor: '#E8F8F0', borderRadius: 8, padding: 12, marginBottom: 12 },
  areaEligibleText: { flex: 1, color: Colors.success, fontSize: 13, fontWeight: '800' },
  areaUnavailable: { borderWidth: 1, borderColor: '#E7C66A', backgroundColor: Colors.warningLight, borderRadius: 8, padding: 13, marginBottom: 14, gap: 12 },
  areaUnavailableHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  areaUnavailableTitle: { color: '#674900', fontSize: 14, fontWeight: '900' },
  areaUnavailableCopy: { color: '#795F22', fontSize: 12, lineHeight: 18, marginTop: 4 },
  carryInButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, backgroundColor: Colors.brandNavy, paddingHorizontal: 12 },
  carryInButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  contactButton: { minHeight: 42, flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: Colors.lineStrong, borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: 10 },
  contactButtonText: { color: Colors.accentInk, fontSize: 12, fontWeight: '800' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  applyButton: { minWidth: 82, minHeight: 52, marginTop: 6, borderRadius: 8, backgroundColor: Colors.brandNavy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  applyButtonDisabled: { opacity: 0.45 },
  applyButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  appliedInline: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#E8F8F0', borderWidth: 1, borderColor: '#BDE7D0', borderRadius: 8, padding: 12, marginBottom: 14 },
  discountApplied: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#E8F8F0', borderWidth: 1, borderColor: '#BDE7D0', borderRadius: 8, padding: 14, marginBottom: 12 },
  discountCheck: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  discountTitle: { color: Colors.ink, fontSize: 13, fontWeight: '800' },
  discountBody: { color: Colors.inkSecondary, fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  discountCode: { color: Colors.accentInk, fontSize: 11, fontWeight: '900', marginTop: 4 },
  legalRoot: { flex: 1, minHeight: 0, backgroundColor: "#fff" },
  legalScroll: { flex: 1, minHeight: 0 },
  legalContent: { padding: 20, paddingBottom: 120 },
  legalParagraph: { color: Colors.inkSecondary, fontSize: 15, lineHeight: 24, marginBottom: 16 },
  link: { color: Colors.accentInk, fontWeight: "600", paddingVertical: 8 },
  notice: { backgroundColor: Colors.brandSoft, padding: 16, borderRadius: 8 },
  savedRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    paddingVertical: 12,
  },
  savedCopy: { flex: 1 },
  savedTitle: { color: Colors.ink, fontSize: 16, fontWeight: '700' },
  savedMeta: { color: Colors.inkSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  feeBox: {
    borderWidth: 1,
    borderColor: Colors.lineStrong,
    borderRadius: 8,
    marginTop: 18,
    padding: 14,
    backgroundColor: Colors.white,
  },
  feeHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 },
  feeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  feeTitle: { color: Colors.ink, fontSize: 16, fontWeight: '800' },
  feeSubtitle: { color: Colors.inkSecondary, fontSize: 11.5, marginTop: 2 },
  feeRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  feeLabel: { flex: 1, color: Colors.inkSecondary, fontSize: 13.5, fontWeight: '600' },
  feeValue: { color: Colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  feeTotalRow: { minHeight: 48, marginTop: 4, paddingHorizontal: 12, borderRadius: 8, backgroundColor: Colors.brandSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feeTotalLabel: { color: Colors.ink, fontSize: 15, fontWeight: '800' }, feeTotalValue: { color: Colors.brandNavy, fontSize: 20, fontWeight: '900' },
  noFeeRow: { minHeight: 50, borderRadius: 8, backgroundColor: Colors.successLight, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }, noFeeText: { color: Colors.success, fontSize: 13.5, fontWeight: '700' },
  diagnosisBox: { marginTop: 12, backgroundColor: Colors.warningLight, borderRadius: 8, padding: 12 },
  diagnosisHead: { flexDirection: 'row', alignItems: 'center', gap: 7 }, diagnosisTitle: { color: '#674900', fontSize: 12.5, fontWeight: '800' }, diagnosisCopy: { color: '#795F22', fontSize: 11.5, marginTop: 7 },
  diagnosisMath: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 6 }, diagnosisPart: { color: Colors.ink, fontSize: 12, fontWeight: '700' }, diagnosisPlus: { color: Colors.inkSecondary, fontWeight: '700' }, diagnosisEquals: { color: Colors.inkSecondary, fontWeight: '700' }, diagnosisTotal: { color: '#674900', fontSize: 15, fontWeight: '900' }, diagnosisNote: { color: '#795F22', fontSize: 10.5, lineHeight: 15, marginTop: 7 },
  feeNote: { color: Colors.inkSecondary, fontSize: 11.5, lineHeight: 17, marginTop: 11 },
  reviewSummary: { backgroundColor: Colors.brandNavy, borderRadius: 8, padding: 14, marginTop: 16, marginBottom: 10 },
  reviewSummaryHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.2)' }, reviewSummaryIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, reviewSummaryTitle: { color: '#fff', fontSize: 16, fontWeight: '800' }, reviewSummarySub: { color: '#BED1E8', fontSize: 10.5, marginTop: 2 },
  reviewFacts: { flexDirection: 'row', marginTop: 12 }, reviewFact: { flex: 1, minWidth: 0 }, reviewFactRule: { width: 1, backgroundColor: 'rgba(255,255,255,.2)', marginHorizontal: 8 }, reviewFactLabel: { color: '#9EB9D9', fontSize: 8, fontWeight: '800' }, reviewFactValue: { color: '#fff', fontSize: 10.5, lineHeight: 14, fontWeight: '700', marginTop: 4 },
  detailCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, backgroundColor: Colors.white, padding: 12, marginBottom: 9 }, detailIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, detailLabel: { color: Colors.inkSecondary, fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' }, detailValue: { color: Colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '600', marginTop: 3 },
  reviewServicesTitle: { color: Colors.ink, fontSize: 17, fontWeight: '800', marginTop: 12, marginBottom: 4 },
  reviewItem: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 8,
    backgroundColor: Colors.white,
    padding: 13,
    marginTop: 9,
  },
  reviewItemHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }, reviewNumber: { width: 25, height: 25, borderRadius: 13, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, reviewNumberText: { color: Colors.accentInk, fontSize: 11, fontWeight: '900' },
  reviewDataRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7, borderTopWidth: 1, borderTopColor: Colors.line }, reviewDataLabel: { flex: .42, color: Colors.inkSecondary, fontSize: 11.5 }, reviewDataValue: { flex: .58, color: Colors.ink, fontSize: 12, lineHeight: 17, fontWeight: '600', textAlign: 'right' },
});
