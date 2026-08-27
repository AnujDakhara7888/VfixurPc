// ─────────────────────────────────────────────────────────────────────────
// VfixurPC — Unified Service Catalog (single source of truth)
//
// One list of service categories powers the Home grid AND Step 1 of
// booking. Each category declares the issues relevant to it, so Step 2
// only ever shows issues that match what the user chose in Step 1.
//
// Matches the 11-service master list from the App Flow & Functional
// Requirements doc (v1.0, 23 Aug 2026): Laptop, Desktop, Mac, Data
// Recovery, System Upgrade, Virus Removal, CCTV, Networking, Backup,
// Custom PC, Business IT / AMC. All device/model fields stay optional
// with a "Not sure" way out — never a hard requirement to continue.
// ─────────────────────────────────────────────────────────────────────────
import type React from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { Device } from '@/types';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface ServiceIssue {
  id: string;
  label: string;
  icon: IconName;
}

export interface ServiceCategory {
  id: string;
  label: string;        // full label, e.g. "Laptop Repair"
  short: string;        // compact label for chips, e.g. "Laptop"
  icon: IconName;
  tagline: string;      // one-line description
  /** Whether to ask the customer for a brand + model. */
  needsDevice: boolean;
  /** Whether device/model details are optional even when needsDevice is true. */
  deviceOptional?: boolean;
  popular?: boolean;
  issues: ServiceIssue[];
}

// ── Reusable issue definitions ────────────────────────────────────────────
const I = {
  screen:      { id: 'screen',      label: 'Screen / Display',       icon: 'tv-outline' as IconName },
  battery:     { id: 'battery',     label: 'Battery & Charging',     icon: 'battery-charging-outline' as IconName },
  keyboard:    { id: 'keyboard',    label: 'Keyboard & Trackpad',    icon: 'keypad-outline' as IconName },
  hinge:       { id: 'hinge',       label: 'Hinge & Body',           icon: 'build-outline' as IconName },
  heating:     { id: 'heating',     label: 'Overheating & Fan',      icon: 'thermometer-outline' as IconName },
  performance: { id: 'performance', label: 'Slow Performance',       icon: 'flash-outline' as IconName },
  board:       { id: 'board',       label: 'Motherboard / Logic',    icon: 'hardware-chip-outline' as IconName },
  storage:     { id: 'storage',     label: 'Storage / Hard Drive',   icon: 'save-outline' as IconName },
  software:    { id: 'software',    label: 'Software & OS',          icon: 'disc-outline' as IconName },
  ports:       { id: 'ports',       label: 'Ports & Peripherals',    icon: 'git-network-outline' as IconName },
  audio:       { id: 'audio',       label: 'Audio & Camera',         icon: 'volume-high-outline' as IconName },
  wifi:        { id: 'wifi',        label: 'Wi-Fi / Connectivity',   icon: 'wifi-outline' as IconName },
  wontStart:   { id: 'wont_start',  label: "Won't Power On",         icon: 'power-outline' as IconName },
  psu:         { id: 'psu',         label: 'Power Supply',           icon: 'flash-outline' as IconName },
  gpu:         { id: 'gpu',         label: 'Graphics Card',          icon: 'game-controller-outline' as IconName },
  notSure:     { id: 'not_sure',    label: "Not Sure / Don't Know",  icon: 'help-circle-outline' as IconName },
  // Virus / security
  virus:       { id: 'virus',       label: 'Virus / Malware',        icon: 'bug-outline' as IconName },
  popups:      { id: 'popups',      label: 'Pop-ups & Adware',       icon: 'alert-circle-outline' as IconName },
  ransomware:  { id: 'ransomware',  label: 'Ransomware',             icon: 'lock-closed-outline' as IconName },
  security:    { id: 'security',    label: 'Security Hardening',     icon: 'shield-checkmark-outline' as IconName },
  // Data recovery
  deleted:     { id: 'deleted',     label: 'Deleted Files',          icon: 'trash-outline' as IconName },
  deadDrive:   { id: 'dead_drive',  label: 'Dead / Failed Drive',    icon: 'sad-outline' as IconName },
  corrupt:     { id: 'corrupt',     label: 'Corrupted Drive',        icon: 'warning-outline' as IconName },
  formatted:   { id: 'formatted',   label: 'Formatted by Mistake',   icon: 'refresh-outline' as IconName },
  water:       { id: 'water',       label: 'Water / Physical Damage',icon: 'water-outline' as IconName },
  // Upgrades
  ssd:         { id: 'ssd',         label: 'SSD Upgrade',            icon: 'hardware-chip-outline' as IconName },
  ram:         { id: 'ram',         label: 'RAM Upgrade',            icon: 'layers-outline' as IconName },
  osInstall:   { id: 'os_install',  label: 'OS Installation',        icon: 'logo-windows' as IconName },
  appInstall:  { id: 'app_install', label: 'Software Setup',         icon: 'cloud-download-outline' as IconName },
  newSetup:    { id: 'new_setup',   label: 'New PC Setup',           icon: 'sparkles-outline' as IconName },
  recommendUpgrade: { id: 'recommend_upgrade', label: 'Not Sure — Recommend an Upgrade', icon: 'bulb-outline' as IconName },
  // Network
  wifiSetup:   { id: 'wifi_setup',  label: 'Wi-Fi Setup',            icon: 'wifi-outline' as IconName },
  router:      { id: 'router',      label: 'Router Configuration',   icon: 'options-outline' as IconName },
  officeLan:   { id: 'office_lan',  label: 'Office LAN / Cabling',   icon: 'git-network-outline' as IconName },
  noInternet:  { id: 'no_internet', label: 'No Internet',            icon: 'cloud-offline-outline' as IconName },
  leasedLine:  { id: 'leased_line', label: 'Internet Leased Line',   icon: 'swap-horizontal-outline' as IconName },
  // CCTV
  cctvNew:     { id: 'cctv_new',       label: 'New CCTV Setup',        icon: 'videocam-outline' as IconName },
  cctvNotWorking: { id: 'cctv_not_working', label: 'Camera Not Working', icon: 'alert-circle-outline' as IconName },
  cctvNoRecording: { id: 'cctv_no_recording', label: 'No Recording / DVR Issue', icon: 'disc-outline' as IconName },
  cctvMobile:  { id: 'cctv_mobile',    label: "Can't View on Mobile",  icon: 'phone-portrait-outline' as IconName },
  cctvAdd:     { id: 'cctv_add',       label: 'Add / Relocate Cameras',icon: 'add-circle-outline' as IconName },
  // Backup
  backupCloud: { id: 'backup_cloud',   label: 'Cloud Backup',          icon: 'cloud-outline' as IconName },
  backupOnprem:{ id: 'backup_onprem',  label: 'On-Premise / NAS',      icon: 'server-outline' as IconName },
  backupHybrid:{ id: 'backup_hybrid',  label: 'Hybrid Backup',         icon: 'git-compare-outline' as IconName },
  backupRecommend: { id: 'backup_recommend', label: 'Not Sure — Recommend a Solution', icon: 'help-circle-outline' as IconName },
  // Custom build
  gamingPc:    { id: 'gaming_pc',   label: 'Gaming PC',              icon: 'game-controller-outline' as IconName },
  workstation: { id: 'workstation', label: 'Workstation',           icon: 'briefcase-outline' as IconName },
  budgetPc:    { id: 'budget_pc',   label: 'Budget / Home PC',       icon: 'home-outline' as IconName },
  creator:     { id: 'creator',     label: 'Content Creation',       icon: 'color-palette-outline' as IconName },
  // Business IT / AMC
  amc:         { id: 'amc',         label: 'Annual Maintenance (AMC)', icon: 'calendar-outline' as IconName },
  oneTimeProject: { id: 'one_time_project', label: 'One-Time Project', icon: 'flag-outline' as IconName },
  onCallSupport: { id: 'on_call_support', label: 'On-Call IT Support', icon: 'call-outline' as IconName },
  completeIt:  { id: 'complete_it', label: 'Complete IT Management', icon: 'business-outline' as IconName },
} satisfies Record<string, ServiceIssue>;

// ── Service categories ────────────────────────────────────────────────────
// Order matches the requirements doc's Service Master List (§3).
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'laptop', label: 'Laptop Repair', short: 'Laptop',
    icon: 'laptop-outline', tagline: 'Screen, battery, keyboard & more',
    needsDevice: true, deviceOptional: true, popular: true,
    issues: [I.screen, I.battery, I.keyboard, I.hinge, I.heating, I.performance, I.board, I.storage, I.software, I.ports, I.audio, I.wifi, I.notSure],
  },
  {
    id: 'desktop', label: 'Desktop Repair', short: 'Desktop',
    icon: 'desktop-outline', tagline: 'Boot issues, power, graphics & more',
    needsDevice: true, deviceOptional: true, popular: true,
    issues: [I.wontStart, I.performance, I.heating, I.psu, I.gpu, I.board, I.storage, I.software, I.wifi, I.ports, I.notSure],
  },
  {
    id: 'mac', label: 'Mac Repair', short: 'Mac',
    icon: 'logo-apple', tagline: 'MacBook, iMac & Mac mini',
    needsDevice: true, deviceOptional: true, popular: true,
    issues: [I.screen, I.battery, I.keyboard, I.performance, I.storage, I.board, I.software, I.water, I.notSure],
  },
  {
    id: 'data', label: 'Data Recovery', short: 'Data',
    icon: 'save-outline', tagline: 'Recover lost or deleted files',
    needsDevice: false,
    issues: [I.deleted, I.deadDrive, I.corrupt, I.formatted, I.water],
  },
  {
    id: 'upgrade', label: 'System Upgrade', short: 'Upgrade',
    icon: 'arrow-up-circle-outline', tagline: 'SSD, RAM, OS & performance',
    needsDevice: true, deviceOptional: true,
    issues: [I.ssd, I.ram, I.osInstall, I.appInstall, I.newSetup, I.recommendUpgrade],
  },
  {
    id: 'virus', label: 'Virus / Malware Removal', short: 'Virus',
    icon: 'shield-checkmark-outline', tagline: 'Malware, pop-ups & security',
    needsDevice: false, popular: true,
    issues: [I.virus, I.popups, I.ransomware, I.performance, I.security],
  },
  {
    id: 'cctv', label: 'CCTV Setup & Support', short: 'CCTV',
    icon: 'videocam-outline', tagline: 'Home, office & shop installations',
    needsDevice: false,
    issues: [I.cctvNew, I.cctvNotWorking, I.cctvNoRecording, I.cctvMobile, I.cctvAdd],
  },
  {
    id: 'network', label: 'Networking', short: 'Network',
    icon: 'wifi-outline', tagline: 'Home & office connectivity',
    needsDevice: false,
    issues: [I.wifiSetup, I.router, I.officeLan, I.leasedLine, I.noInternet, I.notSure],
  },
  {
    id: 'backup', label: 'Backup Solutions', short: 'Backup',
    icon: 'cloud-upload-outline', tagline: 'Cloud, NAS & office backup',
    needsDevice: false,
    issues: [I.backupCloud, I.backupOnprem, I.backupHybrid, I.backupRecommend],
  },
  {
    id: 'custom', label: 'Build a Custom PC', short: 'Custom PC',
    icon: 'construct-outline', tagline: 'Built to your needs & budget',
    needsDevice: false,
    issues: [I.gamingPc, I.workstation, I.budgetPc, I.creator],
  },
  {
    id: 'business', label: 'Business IT Support / AMC', short: 'Business IT',
    icon: 'briefcase-outline', tagline: 'AMC, on-call & office IT support',
    needsDevice: false,
    issues: [I.amc, I.oneTimeProject, I.onCallSupport, I.completeIt],
  },
];

export const BRANDS = ['HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'Apple', 'Samsung', 'MSI', 'Gigabyte', 'Other'];

export const BOOKING_STEPS = ['Service', 'Issues', 'Schedule'] as const;

// ── Helpers ────────────────────────────────────────────────────────────────
export function getCategory(id?: string | null): ServiceCategory | undefined {
  return SERVICE_CATEGORIES.find((c) => c.id === id);
}

export function getIssueLabels(categoryId: string | undefined, issueIds: string[]): string[] {
  const cat = getCategory(categoryId);
  const pool = cat ? cat.issues : SERVICE_CATEGORIES.flatMap((c) => c.issues);
  return issueIds
    .map((id) => pool.find((i) => i.id === id)?.label)
    .filter((l): l is string => !!l);
}

/**
 * Clean, human display name for a device/service — never "backup backup".
 * Hardware bookings store real brand + model; non-hardware services store the
 * same value in both fields, which we collapse to one.
 */
export function formatDeviceName(device?: Pick<Device, 'brand' | 'model'> | null): string {
  if (!device) return 'Service request';
  const brand = (device.brand ?? '').trim();
  const model = (device.model ?? '').trim();
  if (!model || model === brand) return brand || 'Service request';
  if (!brand) return model;
  return `${brand} ${model}`;
}
