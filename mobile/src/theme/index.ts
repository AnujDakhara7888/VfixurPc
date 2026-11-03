// VfixurPC — Design System  ·  "Trusted Blue"
// ─────────────────────────────────────────────────────────────────────────
// Direction: matches the VfixurPC brand mark — a bright azure-blue circuit
// glyph on a dark navy monitor outline. Deep navy surfaces paired with a
// single confident azure-blue signature, flat and clean rather than
// glow-heavy. Light by default; the navy is used as a premium "moment"
// (hero, primary actions) rather than everywhere.
//
// All legacy keys are preserved (re-pointed to the refined palette) so every
// existing import keeps compiling, while richer semantic + gradient + motion
// tokens are layered on top.
// ─────────────────────────────────────────────────────────────────────────

export const Colors = {
  // ── Brand ────────────────────────────────────────────────────────────
  brand:      '#1565FF',
  brandBright:'#16A8FF',
  brandDark:  '#0B4FCC',
  brandDeep:  '#082B59',
  brandNavy:  '#082B59',
  brandInk:   '#061F40',

  // ── Ink (text) — refined navy greyscale ──────────────────────────────
  ink:         '#0B172A',
  inkSecondary:'#667085',
  inkTertiary: '#8791A3',
  inkQuat:     '#A9B3C1',  // faint

  // ── Semantic ─────────────────────────────────────────────────────────
  primary:     '#082B59',
  primaryDark: '#061F40',
  primaryLight:'#EAF2FF',
  accent:      '#1565FF',
  accentInk:   '#0B4FCC',

  // ── Status ───────────────────────────────────────────────────────────
  success: '#22A06B', successLight: '#E8F7F0',
  warning: '#FFC107', warningLight: '#FFF8DD',
  error:   '#E5484D', errorLight:   '#FDEBEC',
  info:    '#1565FF', infoLight:    '#EAF2FF',

  // ── Surfaces ─────────────────────────────────────────────────────────
  bgApp:        '#F7F9FC',
  bgGrouped:    '#F7F9FC',
  bgCard:       '#FFFFFF',
  surface:      '#F2F5F9',
  surfaceStrong:'#E4EAF2',
  brandSoft:    '#EAF2FF',
  brandSofter:  '#F3F7FF',

  // ── Lines / hairlines ────────────────────────────────────────────────
  line:       '#E4EAF2',
  lineStrong: '#D5DDE8',

  // ── On-dark ──────────────────────────────────────────────────────────
  onDark:      'rgba(255,255,255,0.94)',
  onDarkDim:   'rgba(255,255,255,0.64)',
  onDarkFaint: 'rgba(255,255,255,0.40)',
  onDarkLine:  'rgba(255,255,255,0.10)',

  // ── Neutrals (legacy compatibility, re-tuned) ────────────────────────
  white: '#FFFFFF',
  black: '#0F1620',
  gray50:  '#FAFBFC',
  gray100: '#F5F7FA',
  gray200: '#E8EDF3',
  gray300: '#D3DAE3',
  gray400: '#A9B3C1',
  gray500: '#7C8798',
  gray600: '#4E5A6D',
  gray700: '#2E3948',
  gray800: '#1B2430',
  gray900: '#0F1620',
};

// ── Gradients (consumed by expo-linear-gradient) ──────────────────────────
export const Gradients = {
  // Premium navy panel for hero / dark moments.
  ink:    ['#0B3B76', '#082B59', '#061F40'] as const,
  inkSoft:['#0B3B76', '#082B59'] as const,
  // Signature azure-blue sweep for primary CTAs.
  brand:  ['#1677FF', '#1565FF', '#0B4FCC'] as const,
  // Subtle light card sheen.
  sheen:  ['#FFFFFF', '#F7FAFC'] as const,
  // Success burst for confirmations.
  success:['#2BD06B', '#15A24B'] as const,
};

export const Typography = {
  // Confident display titles + a tight, premium scale.
  display:    { fontSize: 40, fontWeight: '800' as const, color: Colors.ink, letterSpacing: -1.1 },
  largeTitle: { fontSize: 34, fontWeight: '800' as const, color: Colors.ink, letterSpacing: -0.9 },
  h1: { fontSize: 28, fontWeight: '800' as const, color: Colors.ink, letterSpacing: -0.7 },
  h2: { fontSize: 22, fontWeight: '800' as const, color: Colors.ink, letterSpacing: -0.5 },
  h3: { fontSize: 18, fontWeight: '700' as const, color: Colors.ink, letterSpacing: -0.3 },
  h4: { fontSize: 16, fontWeight: '700' as const, color: Colors.ink, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const, color: Colors.gray700, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, color: Colors.gray500, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '700' as const, color: Colors.gray600, letterSpacing: 0.3 },
  caption: { fontSize: 11, fontWeight: '500' as const, color: Colors.gray400 },
  eyebrow: { fontSize: 12, fontWeight: '800' as const, color: Colors.accentInk, letterSpacing: 1.2, textTransform: 'uppercase' as const },
};

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const Radius = {
  sm: 12, md: 16, lg: 20, xl: 26, xxl: 32, full: 999,
};

export const Shadow = {
  // Layered, diffuse elevations — barely-there, expensive-feeling.
  xs: {
    shadowColor: '#0A1626',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sm: {
    shadowColor: '#0A1626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  md: {
    shadowColor: '#0A1626',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  lg: {
    shadowColor: '#0A1626',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.14,
    shadowRadius: 44,
    elevation: 12,
  },
  // Coloured glow under the azure-blue CTA.
  brand: {
    shadowColor: '#1E88E5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 8,
  },
  // Soft glow under the dark hero.
  ink: {
    shadowColor: '#0A1626',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 38,
    elevation: 12,
  },
};

// ── Motion timing (used with the Animated API) ────────────────────────────
export const Motion = {
  fast: 160,
  base: 240,
  slow: 420,
  pressScale: 0.97,
  spring: { tension: 60, friction: 8 },
};

// Status pills — softer, premium-tinted backgrounds.
export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  REQUEST_RECEIVED: {label:'Request received', bg:'#F1F5F9', text:'#334155',dot:'#64748B'},
  DIAGNOSING: {label:'Diagnosis in progress', bg:'#F1F5F9', text:'#334155',dot:'#64748B'},
  QUOTE_APPROVED: {label:'Quote approved', bg:'#DCFCE7', text:'#166534',dot:'#16A34A'},
  QUOTE_REJECTED: {label:'Return requested', bg:'#F1F5F9', text:'#334155',dot:'#64748B'},
  AWAITING_PARTS: {label:'Awaiting parts', bg:'#F1F5F9', text:'#334155',dot:'#64748B'},
  TESTING: {label:'Testing', bg:'#F1F5F9', text:'#334155',dot:'#64748B'},
  READY_FOR_HANDOVER: {label:'Ready for handover', bg:'#F1F5F9', text:'#334155',dot:'#64748B'},
  CANCELLED: {label:'Cancelled', bg:'#F1F5F9', text:'#334155',dot:'#64748B'},
  PICKUP_SCHEDULED:     { label: 'Pickup Scheduled',  bg: '#E8F1FF', text: '#0A5BD3', dot: '#0A84FF' },
  PICKED_UP:            { label: 'Picked Up',          bg: '#EAF2FF', text: '#0B4FCC', dot: '#1565FF' },
  RECEIVED_AT_WORKSHOP: { label: 'At Workshop',        bg: '#EAF2FF', text: '#0B4FCC', dot: '#1565FF' },
  DIAGNOSED:            { label: 'Diagnosed',          bg: '#FFF8DD', text: '#765900', dot: '#FFC107' },
  QUOTATION_SHARED:     { label: 'Review quote',       bg: '#FFF8DD', text: '#765900', dot: '#FFC107' },
  PAYMENT_RECEIVED:     { label: 'Payment Received',   bg: '#E6F8EE', text: '#157A37', dot: '#1FB85B' },
  UNDER_REPAIR:         { label: 'Under Repair',       bg: '#EAF2FF', text: '#0B4FCC', dot: '#1565FF' },
  REPAIR_COMPLETE:      { label: 'Repair Complete',    bg: '#E6F8EE', text: '#157A37', dot: '#1FB85B' },
  OUT_FOR_DELIVERY:     { label: 'Out for Delivery',   bg: '#E8F1FF', text: '#0A5BD3', dot: '#0A84FF' },
  DELIVERED:            { label: 'Delivered',          bg: '#E6F8EE', text: '#157A37', dot: '#1FB85B' },
};
