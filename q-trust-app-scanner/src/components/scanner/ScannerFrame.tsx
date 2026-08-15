/**
 * Scanner frame overlay with Islamic design elements
 */

import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Rect, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useThemeColors } from '../../theme/ThemeContext';
import { Colors } from '../../theme/colors';

const CORNER_SIZE = 40;
const CORNER_THICKNESS = 4;

interface ScannerFrameProps {
  isScanning?: boolean;
}

export function ScannerFrame({ isScanning = true }: ScannerFrameProps) {
  const colors = useThemeColors();
  const { width, height } = useWindowDimensions();
  // Size against the short edge so the frame fits in portrait and landscape
  const frameSize = Math.min(Math.min(width, height) * 0.75, 300);
  const scanLinePosition = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    if (isScanning) {
      // Always restart the sweep from the top. If scanning stopped while the
      // line was at the bottom (value ≈1), re-issuing withTiming(1) from 1
      // produces no motion and the line looks frozen — visible when the status
      // cycles (e.g. demo mode). Resetting to 0 first guarantees a fresh sweep.
      scanLinePosition.value = 0;
      scanLinePosition.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      // Pulse animation for corners
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    } else {
      // Park the line at the top so the next sweep starts cleanly
      scanLinePosition.value = 0;
    }
  }, [isScanning]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: scanLinePosition.value * (frameSize - 4) },
    ],
    opacity: isScanning ? 0.8 : 0,
  }), [isScanning, frameSize]);

  const cornerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={[styles.container, { width: frameSize, height: frameSize }]}>
      {/* Frame corners */}
      <Animated.View style={[styles.frameContainer, { width: frameSize, height: frameSize }, cornerStyle]}>
        {/* Top Left */}
        <View style={[styles.corner, styles.topLeft]}>
          <Svg width={CORNER_SIZE} height={CORNER_SIZE}>
            <Defs>
              <LinearGradient id="cornerGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.accent} stopOpacity="1" />
                <Stop offset="1" stopColor={colors.primary} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Path
              d={`M0,${CORNER_SIZE} L0,${CORNER_THICKNESS} Q0,0 ${CORNER_THICKNESS},0 L${CORNER_SIZE},0`}
              stroke="url(#cornerGradient)"
              strokeWidth={CORNER_THICKNESS}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </View>

        {/* Top Right */}
        <View style={[styles.corner, styles.topRight]}>
          <Svg width={CORNER_SIZE} height={CORNER_SIZE}>
            <Path
              d={`M0,0 L${CORNER_SIZE - CORNER_THICKNESS},0 Q${CORNER_SIZE},0 ${CORNER_SIZE},${CORNER_THICKNESS} L${CORNER_SIZE},${CORNER_SIZE}`}
              stroke={colors.accent}
              strokeWidth={CORNER_THICKNESS}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </View>

        {/* Bottom Left */}
        <View style={[styles.corner, styles.bottomLeft]}>
          <Svg width={CORNER_SIZE} height={CORNER_SIZE}>
            <Path
              d={`M0,0 L0,${CORNER_SIZE - CORNER_THICKNESS} Q0,${CORNER_SIZE} ${CORNER_THICKNESS},${CORNER_SIZE} L${CORNER_SIZE},${CORNER_SIZE}`}
              stroke={colors.accent}
              strokeWidth={CORNER_THICKNESS}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </View>

        {/* Bottom Right */}
        <View style={[styles.corner, styles.bottomRight]}>
          <Svg width={CORNER_SIZE} height={CORNER_SIZE}>
            <Path
              d={`M0,${CORNER_SIZE} L${CORNER_SIZE - CORNER_THICKNESS},${CORNER_SIZE} Q${CORNER_SIZE},${CORNER_SIZE} ${CORNER_SIZE},${CORNER_SIZE - CORNER_THICKNESS} L${CORNER_SIZE},0`}
              stroke={colors.primary}
              strokeWidth={CORNER_THICKNESS}
              fill="none"
              strokeLinecap="round"
            />
          </Svg>
        </View>
      </Animated.View>

      {/* Scanning line */}
      <Animated.View style={[styles.scanLine, { width: frameSize - 20 }, scanLineStyle]}>
        <Svg width={frameSize - 20} height={4}>
          <Defs>
            <LinearGradient id="scanGradient" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.primary} stopOpacity="0" />
              <Stop offset="0.5" stopColor={colors.accent} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={frameSize - 20}
            height="4"
            fill="url(#scanGradient)"
            rx="2"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameContainer: {
    position: 'absolute',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  topLeft: {
    top: 0,
    left: 0,
  },
  topRight: {
    top: 0,
    right: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
  },
  scanLine: {
    position: 'absolute',
    top: 2,
    left: 10,
    height: 4,
  },
});

export default ScannerFrame;

