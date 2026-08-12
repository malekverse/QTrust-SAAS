/**
 * Spacing system for Q-Trust App Scanner
 * 
 * Uses an 8px base grid for consistency
 */

export const Spacing = {
  // Base unit: 4px
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// Border radius values
export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

// Shadow definitions for elevation
export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
} as const;

// Common layout values
export const Layout = {
  // Screen padding
  screenPaddingHorizontal: Spacing.lg,
  screenPaddingVertical: Spacing.md,
  
  // Card padding
  cardPadding: Spacing.lg,
  cardPaddingSmall: Spacing.md,
  
  // Button heights
  buttonHeight: 48,
  buttonHeightSmall: 40,
  buttonHeightLarge: 56,
  
  // Input heights
  inputHeight: 48,
  
  // Icon sizes
  iconSizeSmall: 16,
  iconSizeMedium: 24,
  iconSizeLarge: 32,
  iconSizeXLarge: 48,
  iconSizeHuge: 80,
  
  // Max content width for tablet centering
  maxContentWidth: 480,
  maxContentWidthWide: 600,
} as const;

export default Spacing;

