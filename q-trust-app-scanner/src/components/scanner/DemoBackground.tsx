/**
 * Branded backdrop shown behind the scanner in demo/recording mode instead of
 * the live camera — a deep-green gradient with a subtle gold Islamic geometric
 * pattern and a soft vignette. Gives marketing captures a clean, premium look.
 */

import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

export function DemoBackground() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="demoBg" x1="0" y1="0" x2="0.65" y2="1">
            <Stop offset="0" stopColor="#15784F" />
            <Stop offset="0.55" stopColor="#0F5E3E" />
            <Stop offset="1" stopColor="#083A27" />
          </LinearGradient>
          <RadialGradient id="demoVignette" cx="50%" cy="40%" r="80%">
            <Stop offset="0.55" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.45" />
          </RadialGradient>
          <Pattern
            id="demoPattern"
            x="0"
            y="0"
            width="64"
            height="64"
            patternUnits="userSpaceOnUse"
          >
            {/* Eight-pointed star / octagon motif, echoing GeometricPattern */}
            <G stroke="#F4C76C" strokeWidth="0.75" fill="none" opacity="0.12">
              <Path d="M32,10 L42,20 L42,42 L32,52 L22,42 L22,20 Z" />
              <Line x1="32" y1="0" x2="32" y2="10" />
              <Line x1="32" y1="52" x2="32" y2="64" />
              <Line x1="0" y1="32" x2="22" y2="32" />
              <Line x1="42" y1="32" x2="64" y2="32" />
              <Line x1="10" y1="10" x2="22" y2="22" />
              <Line x1="54" y1="10" x2="42" y2="22" />
              <Line x1="10" y1="54" x2="22" y2="42" />
              <Line x1="54" y1="54" x2="42" y2="42" />
            </G>
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#demoBg)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#demoPattern)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#demoVignette)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F5E3E',
  },
});

export default DemoBackground;
