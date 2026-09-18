import { Platform } from 'react-native';

export const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  primaryExtraLight: '#EFF6FF',
  accent: '#10B981',
  accentDark: '#059669',
  accentLight: '#D1FAE5',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  disabled: '#CBD5E1',
  disabledText: '#94A3B8',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningText: '#92400E',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  errorText: '#991B1B',
  success: '#16A34A',
  successLight: '#D1FAE5',
};

export const Colors = {
  light: {
    text: COLORS.textPrimary,
    background: COLORS.background,
    backgroundElement: COLORS.borderLight,
    backgroundSelected: COLORS.primaryLight,
    textSecondary: COLORS.textSecondary,
    tint: COLORS.primary,
    icon: COLORS.textSecondary,
    tabIconDefault: COLORS.textTertiary,
    tabIconSelected: COLORS.primary,
  },
  dark: {
    text: '#FFFFFF',
    background: '#0F172A',
    backgroundElement: '#1E293B',
    backgroundSelected: '#334155',
    textSecondary: '#94A3B8',
    tint: COLORS.primaryLight,
    icon: '#94A3B8',
    tabIconDefault: '#475569',
    tabIconSelected: '#FFFFFF',
  },
};

export type ThemeColor = keyof typeof Colors.light;

export const SPACING = {
  s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40,
};

export const Spacing = {
  ...SPACING,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  half: 2,
};

export const Fonts = Platform.select({
  ios: { sans: 'Vazirmatn', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'Vazirmatn', serif: 'serif', rounded: 'normal', mono: 'monospace' },
});

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 };
export const MaxContentWidth = 800;
export const BottomTabInset = Platform.select({ ios: 50, android: 60 }) ?? 0;
