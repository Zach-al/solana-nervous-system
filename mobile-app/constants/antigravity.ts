import { Platform } from 'react-native';

export const Colors = {
  // Backgrounds
  bg:           '#000000',   // true black — OLED power saving
  bgRaised:     '#0A0A0F',   // cards, modals
  bgSurface:    '#0F0F1A',   // inner surfaces
  
  // Glassmorphism
  glass:        'rgba(255,255,255,0.04)',
  glassBorder:  'rgba(255,255,255,0.10)',
  glassActive:  'rgba(0,240,255,0.08)',

  // Neons — primary semantic meaning
  cyan:         '#00F0FF',   // ACTIVE / CONNECTED / PRIMARY ACTION
  cyanDim:      'rgba(0,240,255,0.20)',
  cyanGlow:     'rgba(0,240,255,0.08)',
  
  purple:       '#8A2BE2',   // MESH / NETWORK / P2P DATA
  purpleDim:    'rgba(138,43,226,0.20)',
  purpleGlow:   'rgba(138,43,226,0.08)',
  
  green:        '#39FF14',   // EARNINGS / SUCCESS / SOL AMOUNT
  greenDim:     'rgba(57,255,20,0.20)',
  greenGlow:    'rgba(57,255,20,0.08)',
  
  // Status
  warning:      '#FFB800',
  danger:       '#FF3B3B',
  
  // Text scale
  textPrimary:   '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.55)',
  textTertiary:  'rgba(255,255,255,0.25)',
  textMono:      '#A0FFB0',  // monospace terminal readouts
} as const;

export const Typography = {
  // Display — headers, rank badges, hero numbers
  display: {
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif',
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    color: Colors.textPrimary,
  },
  // UI — buttons, labels, nav
  ui: {
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'sans-serif',
    fontWeight: '500' as const,
    letterSpacing: 0.2,
    color: Colors.textPrimary,
  },
  // Terminal — ALL earnings, metrics, addresses, IDs
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '400' as const,
    letterSpacing: 0.5,
    color: Colors.textMono,
  },
  // Terminal header (brighter mono)
  monoHeader: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    color: Colors.cyan,
  },
} as const;

export const Spacing = { xs:4, sm:8, md:16, lg:24, xl:32, xxl:48 };
export const Radius  = { sm:8, md:12, lg:20, xl:32, pill:999 };

export const Springs = {
  // Button press — fast, satisfying
  buttonPress: { damping: 15, stiffness: 400, mass: 0.8 },
  // Toggle state change — medium spring
  toggle:      { damping: 20, stiffness: 300, mass: 1.0 },
  // Number counter — smooth, no bounce
  counter:     { damping: 30, stiffness: 200, mass: 1.0 },
  // Pulse ring — slow, organic
  pulse:       { damping: 8,  stiffness: 80,  mass: 2.0 },
} as const;

export const Timings = {
  fast:    150,
  medium:  300,
  slow:    600,
  verySlow:1200,
} as const;
