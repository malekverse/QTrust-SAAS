/**
 * Islamic-themed color palette for Q-Trust App Scanner
 * 
 * Design Direction:
 * - Elegant, calm, spiritual
 * - Minimal, not cluttered
 * - Premium quality feel
 */

export const Colors = {
  // Core brand colors
  primary: '#136F4E',        // Rich deep Islamic green
  primaryLight: '#1A8F64',   // Lighter green for hover/active states
  primaryDark: '#0D5239',    // Darker green for contrast
  
  accent: '#F4C76C',         // Warm, subtle gold (Islamic accent)
  accentLight: '#F7D68A',    // Lighter gold
  accentDark: '#E5B54D',     // Darker gold
  
  secondary: '#234E70',      // Deep blue for contrast
  secondaryLight: '#2D6690',
  
  // Semantic colors
  success: '#136F4E',        // Same as primary green
  successLight: '#E8F5F0',   // Soft green background
  error: '#DC2626',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  
  // Neutrals
  black: '#111827',
  ink: '#1D2939',            // Dark neutral ink (secondary text)
  gray: '#6B7280',
  grayLight: '#9CA3AF',
  grayLighter: '#D1D5DB',
  white: '#FFFFFF',
  
  // Light mode specific
  light: {
    background: '#F8F5F0',       // Soft warm off-white (classical paper)
    surface: '#FFFFFF',
    surfaceElevated: '#FDFCFA',
    text: '#111827',
    textSecondary: '#1D2939',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    overlay: 'rgba(0, 0, 0, 0.4)',
  },
  
  // Dark mode specific
  dark: {
    background: '#020817',       // Deep dark background
    surface: '#030712',          // Slightly lighter surface
    surfaceElevated: '#0F172A',  // Elevated elements
    text: '#F9FAFB',
    textSecondary: '#E5E7EB',
    textMuted: '#9CA3AF',
    border: '#1F2937',
    borderLight: '#374151',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
} as const;

// Theme-aware color getter
export type ColorScheme = 'light' | 'dark';

export function getThemeColors(scheme: ColorScheme) {
  const modeColors = scheme === 'dark' ? Colors.dark : Colors.light;
  
  return {
    ...Colors,
    ...modeColors,
    // Adjust primary for dark mode contrast
    primary: scheme === 'dark' ? '#1A9E6A' : Colors.primary,
    primaryLight: scheme === 'dark' ? '#22B87A' : Colors.primaryLight,
    accent: scheme === 'dark' ? '#F4C76C' : Colors.accent,
  };
}

export default Colors;

