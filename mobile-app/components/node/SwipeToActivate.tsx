import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  runOnJS,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Springs, Typography } from '../../constants/antigravity';

interface SwipeToActivateProps {
  onActivate: () => void;
  label?: string;
}

const BUTTON_HEIGHT = 64;
const THUMB_SIZE = 56;
const PADDING = 4;

export default function SwipeToActivate({ 
  onActivate, 
  label = "SWIPE TO IGNITE →" 
}: SwipeToActivateProps) {
  const thumbX = useSharedValue(0);
  const trackWidth = useSharedValue(0);
  const startX = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onStart(() => {
      startX.value = thumbX.value;
    })
    .onUpdate((event) => {
      const maxX = trackWidth.value - THUMB_SIZE - PADDING * 2;
      thumbX.value = Math.min(Math.max(0, startX.value + event.translationX), maxX);
      
      // Haptic on movement
      if (Math.floor(event.translationX / 20) !== Math.floor((event.translationX - (event.velocityX ?? 0)/60) / 20)) {
         runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }
    })
    .onEnd(() => {
      const maxX = trackWidth.value - THUMB_SIZE - PADDING * 2;
      if (thumbX.value > maxX * 0.85) {
        thumbX.value = withSpring(maxX, Springs.buttonPress);
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
        runOnJS(onActivate)();
        // Reset after delay
        setTimeout(() => {
          thumbX.value = withSpring(0, Springs.toggle);
        }, 1000);
      } else {
        thumbX.value = withSpring(0, Springs.toggle);
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: thumbX.value + THUMB_SIZE / 2 + PADDING,
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      thumbX.value,
      [0, (trackWidth.value - THUMB_SIZE) * 0.5],
      [1, 0],
      Extrapolate.CLAMP
    ),
  }));

  return (
    <View 
      style={styles.container}
      onLayout={(e) => { trackWidth.value = e.nativeEvent.layout.width }}
    >
      <Animated.View style={[styles.fill, fillStyle]} />
      
      <Animated.View style={[styles.labelContainer, labelStyle]}>
        <Text style={styles.label}>{label}</Text>
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <Zap size={24} color={Colors.cyan} fill={Colors.cyan} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: BUTTON_HEIGHT,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.lg,
    padding: PADDING,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.cyanGlow,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.monoHeader,
    color: Colors.textSecondary,
    fontSize: 12,
  }
});
