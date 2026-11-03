import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useServiceCatalog, formatDeviceName } from "@/catalog/services";
import ServiceFields, { Answers } from "@/components/ServiceFields";
import LargeHeader from "@/components/LargeHeader";
import BookingBar from "@/components/BookingBar";
import Input from "@/components/Input";
import { Colors } from "@/theme";
import Toast from "react-native-toast-message";
import { useQuery } from "@tanstack/react-query";
import { devicesApi } from "@/api/client";
import AttachmentPreview from '@/components/AttachmentPreview';
import StepIndicator from './StepIndicator';
import DeviceArtwork from '@/components/DeviceArtwork';
import { pickServiceMedia } from '@/utils/mediaPicker';
export default function Step2IssuesScreen({ navigation, route }: any) {
  const { data } = useServiceCatalog();
  const category = data?.find((c) => c.id === route.params.categoryId);
  const brandFor = (brand: string) => {
    const choices = category?.fields.find(f => f.id === 'brand')?.options;
    return !choices || choices.includes(brand) ? brand : 'Other';
  };
  const [answers, setAnswers] = useState<Answers>({});
  const [issues, setIssues] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [preview, setPreview] = useState<{ uri: string; name: string; mime: string } | null>(null);
  const [showDevices, setShowDevices] = useState(false);
  const [savedDevice, setSavedDevice] = useState<string | undefined>(
    route.params.deviceId,
  );
  const { data: devices = [] } = useQuery<any[]>({
    queryKey: ["devices"],
    queryFn: devicesApi.list,
  });
  React.useEffect(() => {
    const d = devices.find((d) => d.id === route.params.deviceId);
    if (d)
      setAnswers((v) => ({
        ...v,
        brand: brandFor(d.brand),
        model: d.model,
        serial: d.serialNumber ?? "",
      }));
  }, [route.params.deviceId, devices, category?.id]);
  async function pick() {
    try {
      const result = await pickServiceMedia(true);
      if (result && !result.canceled) setMedia(result.assets.slice(0, 4));
    } catch {
      Toast.show({ type: "error", text1: "Could not open your photo library", text2: "Please try again." });
    }
  }
  function next() {
    if (!category) return;
    for (const f of category.fields) {
      if (
        f.showWhen &&
        !f.showWhen.values.includes(String(answers[f.showWhen.field]))
      )
        continue;
      if (f.required && (!answers[f.id] || !String(answers[f.id]).trim())) {
        Toast.show({ type: "error", text1: f.label + " is required" });
        return;
      }
    }
    if (!issues.length) {
      Toast.show({ type: "error", text1: "Choose your issue or requirement" });
      return;
    }
    const visible = Object.fromEntries(
      category.fields
        .filter(
          (f) =>
            !f.showWhen ||
            f.showWhen.values.includes(String(answers[f.showWhen.field])),
        )
        .map((f) => [f.id, answers[f.id] ?? ""]),
    );
    navigation.navigate("Step3Pickup", {
      categoryId: category.id,
      draftKey: route.key,
      deviceId: savedDevice,
      bookingAnswers: { ...visible, ...(category.id === 'upgrade' ? { requestedUpgrades: [...issues] } : {}) },
      issues: issues.map((category) => ({
        category,
        description: description.trim() || undefined,
      })),
      media,
    });
  }
  if (!category)
    return (
      <View style={s.root}>
        <LargeHeader
          title="Service unavailable"
          onBack={() => navigation.goBack()}
        />
      </View>
    );
  const pool =
    category.id === "cctv" && answers.setupType === "New setup"
      ? category.issues.filter(
          (i) => i.id === "0" || i.label.includes("Not sure"),
        )
      : category.issues;
  return (
    <View style={s.root}>
      <LargeHeader title={category.label} subtitle="Book a service in a few simple steps" onBack={() => navigation.goBack()} />
      <StepIndicator current={1} total={4} labels={['Service', 'Details', 'Arrange', 'Confirm']} />
      <ScrollView
        style={s.scroller}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        {category.notice ? (
          <Text style={s.notice}>{category.notice}</Text>
        ) : null}
        {category.needsDevice && devices.length > 0 && (
          <View style={s.deviceCard}>
            <View style={s.deviceSummary}>
              <DeviceArtwork category={category.id} size={72} />
              <TouchableOpacity style={s.deviceCopy} onPress={() => setShowDevices(v => !v)} accessibilityRole="button" accessibilityState={{ expanded: showDevices }}>
                <Text style={s.deviceName}>{savedDevice ? formatDeviceName(devices.find(d => d.id === savedDevice)) : 'Choose a saved device'}</Text>
                <Text style={s.changeDevice}>{savedDevice ? 'Change device' : 'Select from My Devices'}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel={showDevices ? 'Close saved devices' : 'Choose a saved device'} style={s.deviceToggle} onPress={() => setShowDevices(v => !v)}><Ionicons name={showDevices ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.ink} /></TouchableOpacity>
            </View>
            {showDevices && <TouchableOpacity style={s.option} onPress={() => { setSavedDevice(undefined); setAnswers({}); setShowDevices(false); }}><Text style={s.optionText}>Add a different device</Text></TouchableOpacity>}
            {showDevices && devices
              .map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={s.option}
                  onPress={() => {
                    setSavedDevice(d.id);
                    setShowDevices(false);
                    setAnswers((v) => ({
                      ...v,
                      brand: brandFor(d.brand),
                      model: d.model,
                      serial: d.serialNumber ?? "",
                    }));
                  }}
                >
                  <Ionicons
                    name={
                      savedDevice === d.id
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={22}
                    color={Colors.accentInk}
                  />
                  <Text style={s.optionText}>
                    {formatDeviceName(d)}{d.serialNumber ? ` (${d.serialNumber})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        )}
        <ServiceFields
          fields={category.fields}
          values={answers}
          onChange={(v) => {
            if (v.setupType !== answers.setupType) setIssues([]);
            if (v.brand !== answers.brand || v.model !== answers.model || v.serial !== answers.serial) setSavedDevice(undefined);
            setAnswers(v);
          }}
        />
        <Text style={s.heading}>
          {[
            "custom",
            "backup",
            "business",
            "upgrade",
            "network",
            "cctv",
          ].includes(category.id)
            ? "What do you need help with?"
            : "What problem are you facing?"}
        </Text>
        <Text style={s.questionHelp}>{['custom','backup','business','upgrade','network','cctv'].includes(category.id) ? 'Choose everything you need.' : `Select the main problem with your ${category.short.toLowerCase()}.`}</Text>
        <View style={s.issueGrid}>{pool.map((i) => (
          <TouchableOpacity
            key={i.id}
            style={[s.issueOption, issues.includes(i.label) && s.issueSelected]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: issues.includes(i.label) }}
            onPress={() =>
              setIssues((prev) =>
                prev.includes(i.label)
                  ? prev.filter((x) => x !== i.label)
                  : [...prev, i.label],
              )
            }
          >
            <View style={[s.issueIcon, issueTone(i.id)]}><Ionicons name={issueIcon(i.label, i.icon)} size={25} color={issueColor(i.id)} /></View>
            <View style={{ flex: 1 }}><Text style={s.issueTitle}>{i.label}</Text><Text style={s.issueHelp} numberOfLines={2}>{issueHint(i.label)}</Text></View>
            {issues.includes(i.label) ? <Ionicons name="checkmark-circle" size={19} color={Colors.accent} /> : null}
          </TouchableOpacity>
        ))}</View>
        <Input
          label="Additional details (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />
        <View style={s.uploadBox}>
          <View style={s.uploadHead}>
            <View style={s.uploadIcon}><Ionicons name="camera-outline" size={25} color={Colors.accentInk} /></View>
            <View style={{ flex: 1 }}><Text style={s.uploadTitle}>Show us the problem</Text><Text style={s.uploadHelp}>Add up to 4 photos or one short video. Optional, but helpful.</Text></View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Upload photos or a short video"
            onPress={() => { void pick(); }}
            style={s.uploadButton}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={Colors.white} />
            <Text style={s.uploadButtonText}>{media.length ? 'Add another file' : 'Upload photos or video'}</Text>
          </TouchableOpacity>
          {media.map((m, i) => (
            <View key={m.uri} style={s.fileRow}>
              <Ionicons name={(m.mimeType ?? '').startsWith('video/') ? 'videocam-outline' : 'image-outline'} size={21} color={Colors.accentInk} />
              <TouchableOpacity style={{ flex: 1 }} accessibilityLabel={'Preview attachment ' + (i + 1)} onPress={() => setPreview({ uri: m.uri, name: m.fileName ?? 'Attachment ' + (i + 1), mime: m.mimeType ?? 'image/jpeg' })}>
                <Text style={s.fileName} numberOfLines={1}>{m.fileName ?? "Attachment " + (i + 1)}</Text>
                <Text style={s.fileAction}>Tap to preview</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel={'Remove attachment ' + (i + 1)} onPress={() => setMedia(prev => prev.filter((_, j) => i !== j))} style={s.removeButton}>
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
      <BookingBar label="Continue" onPress={next} />
      <AttachmentPreview source={preview} onClose={() => setPreview(null)} />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  scroller: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    color: Colors.ink,
  },
  questionHelp: { color: Colors.inkSecondary, fontSize: 13, lineHeight: 18, marginBottom: 14 },
  option: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  optionText: { flex: 1, fontSize: 15, color: Colors.ink, lineHeight: 22 },
  uploadBox: { marginTop: 8, marginBottom: 18, padding: 14, borderWidth: 1, borderColor: Colors.lineStrong, borderRadius: 8, backgroundColor: Colors.white, gap: 12 },
  uploadHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  uploadIcon: { width: 48, height: 48, borderRadius: 8, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  uploadHelp: { color: Colors.inkSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  uploadButton: { minHeight: 48, borderRadius: 8, backgroundColor: Colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  uploadButtonText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  fileRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: 10 },
  fileName: { color: Colors.ink, fontSize: 13, fontWeight: '700' },
  fileAction: { color: Colors.accentInk, fontSize: 11, fontWeight: '600', marginTop: 2 },
  removeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  issueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  issueOption: { width: '48.5%', minHeight: 116, padding: 11, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, gap: 8 },
  issueSelected: { borderColor: Colors.accent, backgroundColor: Colors.brandSofter },
  issueIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  issueTitle: { color: Colors.ink, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  issueHelp: { color: Colors.inkSecondary, fontSize: 10.5, lineHeight: 14, marginTop: 3 },
  deviceCard: { padding: 14, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, marginBottom: 18 },
  deviceSummary: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12 },
  deviceCopy: { flex: 1 }, deviceName: { fontSize: 16, fontWeight: '800', color: Colors.ink }, changeDevice: { color: Colors.accent, fontWeight: '700', fontSize: 12, marginTop: 5 },
  deviceToggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  notice: {
    backgroundColor: Colors.warningLight,
    color: "#795000",
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    lineHeight: 22,
  },
});

function issueHint(label: string) {
  const text = label.toLowerCase();
  if (text.includes('not sure') || text.includes('other')) return 'Tell us more in the notes below';
  if (text.includes('slow') || text.includes('performance')) return 'Runs slowly, freezes or lags';
  if (text.includes('battery')) return 'Charging or battery-life problem';
  if (text.includes('screen') || text.includes('display')) return 'Flickering, lines or physical damage';
  if (text.includes('wifi') || text.includes('network')) return 'Internet or connectivity problem';
  if (text.includes('heat') || text.includes('fan')) return 'Gets hot or the fan is noisy';
  return 'Select this if it matches your issue';
}
function issueIcon(label: string, configured?: React.ComponentProps<typeof Ionicons>['name']) {
  const text = label.toLowerCase();
  if (text.includes('not sure') || text.includes('other')) return 'ellipsis-horizontal';
  if (text.includes('power') || text.includes('turning on') || text.includes('powering on')) return 'power-outline';
  if (text.includes('battery')) return 'battery-half-outline';
  if (text.includes('charging')) return 'flash-outline';
  if (text.includes('screen') || text.includes('display')) return 'desktop-outline';
  if (text.includes('keyboard') || text.includes('trackpad')) return 'keypad-outline';
  if (text.includes('heat') || text.includes('fan')) return 'thermometer-outline';
  if (text.includes('wi-fi') || text.includes('wifi') || text.includes('internet')) return 'wifi-outline';
  if (text.includes('bluetooth')) return 'bluetooth-outline';
  if (text.includes('deleted') || text.includes('missing')) return 'trash-bin-outline';
  if (text.includes('format')) return 'refresh-circle-outline';
  if (text.includes('drive') || text.includes('storage') || text.includes('ssd') || text.includes('hdd')) return 'server-outline';
  if (text.includes('partition')) return 'albums-outline';
  if (text.includes('slow') || text.includes('performance')) return 'speedometer-outline';
  if (text.includes('sound') || text.includes('speaker') || text.includes('microphone')) return 'volume-high-outline';
  if (text.includes('camera') || text.includes('webcam')) return 'videocam-outline';
  if (text.includes('liquid')) return 'water-outline';
  if (text.includes('damage') || text.includes('broken')) return 'warning-outline';
  if (text.includes('virus') || text.includes('malware') || text.includes('antivirus')) return 'shield-outline';
  if (text.includes('pop-up') || text.includes('browser')) return 'browsers-outline';
  if (text.includes('encrypted') || text.includes('ransomware')) return 'lock-closed-outline';
  if (text.includes('backup') || text.includes('cloud')) return 'cloud-upload-outline';
  if (text.includes('network') || text.includes('router') || text.includes('lan') || text.includes('vpn')) return 'git-network-outline';
  if (text.includes('camera') || text.includes('recording') || text.includes('dvr') || text.includes('nvr')) return 'videocam-outline';
  if (text.includes('gaming')) return 'game-controller-outline';
  if (text.includes('office') || text.includes('business')) return 'briefcase-outline';
  if (text.includes('graphics') || text.includes('design') || text.includes('cad')) return 'color-palette-outline';
  if (text.includes('programming') || text.includes('software') || text.includes('windows') || text.includes('macos')) return 'code-slash-outline';
  if (text.includes('ram')) return 'hardware-chip-outline';
  return configured && configured !== 'help-circle-outline' ? configured : 'construct-outline';
}
function issueTone(id: string) {
  const tones = ['#E7F0FF', '#F0EAFE', '#E7F7EE', '#FDE8EF', '#FFF1D8'];
  return { backgroundColor: tones[Number(id.replace(/\D/g, '')) % tones.length || 0] };
}
function issueColor(id: string) {
  const colors = [Colors.accent, '#7047D7', Colors.success, '#E83E72', '#F29D00'];
  return colors[Number(id.replace(/\D/g, '')) % colors.length || 0];
}
