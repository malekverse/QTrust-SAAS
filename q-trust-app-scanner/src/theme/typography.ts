/**
 * Typography system for Q-Trust App Scanner
 * 
 * Design Direction:
 * - Latin font: System default (clean, modern)
 * - Arabic sections: Clean Naskh-like appearance
 * - Clear hierarchy with good readability
 */

import { Platform, TextStyle } from 'react-native';

// Font families
export const FontFamily = {
  // System fonts for Latin text
  sans: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  // For Arabic text - system will use appropriate Arabic font
  arabic: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
} as const;

// Font weights
export const FontWeight = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
} as const;

// Font sizes following the design spec
export const FontSize = {
  // Display sizes (for main titles, scanner greetings)
  display: 28,
  displaySmall: 24,
  
  // Heading sizes
  h1: 24,
  h2: 20,
  h3: 18,
  
  // Body sizes
  body: 16,
  bodySmall: 14,
  
  // Caption/helper text
  caption: 12,
  micro: 10,
} as const;

// Line heights
export const LineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;

// Pre-defined text styles
export const TextStyles = {
  // Display - for main scanner greeting
  displayArabic: {
    fontFamily: FontFamily.arabic,
    fontSize: FontSize.display,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.display * LineHeight.relaxed,
    textAlign: 'center' as TextStyle['textAlign'],
  } as TextStyle,
  
  displaySmallArabic: {
    fontFamily: FontFamily.arabic,
    fontSize: FontSize.displaySmall,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.displaySmall * LineHeight.relaxed,
    textAlign: 'center' as TextStyle['textAlign'],
  } as TextStyle,
  
  // Headings
  h1: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.h1,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.h1 * LineHeight.tight,
  } as TextStyle,
  
  h2: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.h2,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.h2 * LineHeight.tight,
  } as TextStyle,
  
  h3: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.h3,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.h3 * LineHeight.normal,
  } as TextStyle,
  
  // Body text
  body: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.body * LineHeight.normal,
  } as TextStyle,
  
  bodyMedium: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.body * LineHeight.normal,
  } as TextStyle,
  
  bodySmall: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.bodySmall * LineHeight.normal,
  } as TextStyle,
  
  // Arabic body text
  bodyArabic: {
    fontFamily: FontFamily.arabic,
    fontSize: FontSize.body,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.body * LineHeight.relaxed,
    textAlign: 'center' as TextStyle['textAlign'],
  } as TextStyle,
  
  bodyArabicLarge: {
    fontFamily: FontFamily.arabic,
    fontSize: FontSize.h2,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.h2 * LineHeight.relaxed,
    textAlign: 'center' as TextStyle['textAlign'],
  } as TextStyle,
  
  // Captions
  caption: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.caption * LineHeight.normal,
  } as TextStyle,
  
  captionMedium: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.caption,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.caption * LineHeight.normal,
  } as TextStyle,
  
  // Button text
  button: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.body * LineHeight.tight,
  } as TextStyle,
  
  buttonSmall: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    fontWeight: FontWeight.semibold,
    lineHeight: FontSize.bodySmall * LineHeight.tight,
  } as TextStyle,
} as const;

export default TextStyles;

