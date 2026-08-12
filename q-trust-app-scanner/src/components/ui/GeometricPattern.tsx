/**
 * Subtle Islamic geometric pattern background
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Pattern, Rect, Circle, Line, Defs, G, Path } from 'react-native-svg';
import { useThemeColors } from '../../theme/ThemeContext';

interface GeometricPatternProps {
  opacity?: number;
  style?: any;
}

export function GeometricPattern({ opacity = 0.05, style }: GeometricPatternProps) {
  const colors = useThemeColors();
  const { width, height } = Dimensions.get('window');
  
  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <Pattern
            id="islamicPattern"
            x="0"
            y="0"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            {/* Eight-pointed star pattern */}
            <G stroke={colors.primary} strokeWidth="0.5" fill="none" opacity={opacity * 10}>
              {/* Octagon center */}
              <Path
                d="M30,10 L40,20 L40,40 L30,50 L20,40 L20,20 Z"
              />
              {/* Cross lines */}
              <Line x1="30" y1="0" x2="30" y2="10" />
              <Line x1="30" y1="50" x2="30" y2="60" />
              <Line x1="0" y1="30" x2="20" y2="30" />
              <Line x1="40" y1="30" x2="60" y2="30" />
              {/* Diagonal connections */}
              <Line x1="10" y1="10" x2="20" y2="20" />
              <Line x1="50" y1="10" x2="40" y2="20" />
              <Line x1="10" y1="50" x2="20" y2="40" />
              <Line x1="50" y1="50" x2="40" y2="40" />
            </G>
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#islamicPattern)" />
      </Svg>
    </View>
  );
}

// Simpler decorative line with ayah-style separator
export function AyahSeparator({ width = 200 }: { width?: number }) {
  const colors = useThemeColors();
  
  return (
    <View style={[styles.separatorContainer, { width }]}>
      <View style={[styles.separatorLine, { backgroundColor: colors.accent }]} />
      <View style={[styles.separatorCircle, { backgroundColor: colors.accent }]} />
      <View style={[styles.separatorLine, { backgroundColor: colors.accent }]} />
    </View>
  );
}

// Decorative corner ornament
export function CornerOrnament({ 
  position, 
  size = 60 
}: { 
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  size?: number;
}) {
  const colors = useThemeColors();
  
  const getRotation = () => {
    switch (position) {
      case 'topRight': return '90deg';
      case 'bottomRight': return '180deg';
      case 'bottomLeft': return '270deg';
      default: return '0deg';
    }
  };
  
  const getPosition = () => {
    switch (position) {
      case 'topRight': return { top: 0, right: 0 };
      case 'bottomRight': return { bottom: 0, right: 0 };
      case 'bottomLeft': return { bottom: 0, left: 0 };
      default: return { top: 0, left: 0 };
    }
  };
  
  return (
    <View style={[styles.cornerContainer, getPosition(), { transform: [{ rotate: getRotation() }] }]}>
      <Svg width={size} height={size}>
        <G stroke={colors.accent} strokeWidth="1" fill="none" opacity={0.3}>
          {/* Corner arabesque pattern */}
          <Path d={`M0,0 Q${size/2},0 ${size/2},${size/2}`} />
          <Path d={`M0,0 Q0,${size/2} ${size/2},${size/2}`} />
          <Circle cx={size/4} cy={size/4} r={size/8} />
          <Path d={`M${size/8},${size/8} L${size*3/8},${size*3/8}`} />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  separatorLine: {
    height: 1,
    flex: 1,
  },
  separatorCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  cornerContainer: {
    position: 'absolute',
  },
});

export default GeometricPattern;

