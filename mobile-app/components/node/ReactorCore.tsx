import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withRepeat, 
  withTiming, 
  Easing,
  cancelAnimation,
  interpolate
} from 'react-native-reanimated';
import { Zap, Pause, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Springs, Typography } from '../../constants/antigravity';
import NeonText from '../ui/NeonText';

interface ReactorCoreProps {
  status: 'active' | 'idle' | 'offline';
  onPress: () => void;
}

export default function ReactorCore({ status, onPress }: ReactorCoreProps) {
  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);
  const scale = useSharedValue(1);

  const activeColor = status === 'active' ? Colors.cyan : 
                     status === 'idle' ? Colors.purple : 
                     Colors.danger;

  useEffect(() => {
    if (status !== 'offline') {
      pulse1.value = withRepeat(
        withTiming(1.4, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
      // Staggered mid pulse
      setTimeout(() => {
        pulse2.value = withRepeat(
          withTiming(1.2, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          -1,
          true
        );
      }, 800);
    } else {
      cancelAnimation(pulse1);
      cancelAnimation(pulse2);
      pulse1.value = withTiming(1);
      pulse2.value = withTiming(1);
    }
  }, [status]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse1.value }],
    opacity: status === 'offline' ? 0 : interpolate(pulse1.value, [1, 1.4], [0.6, 0])
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse2.value }],
    opacity: status === 'offline' ? 0 : interpolate(pulse2.value, [1, 1.2], [0.35, 0])
  }));

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: activeColor,
    backgroundColor: `${activeColor}26`, // 15% opacity hex
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, Springs.buttonPress);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, Springs.buttonPress);
  };

  return (
    <View style={styles.container}>
      {/* Layer 1 - Outer */}
      <Animated.View style={[styles.ring, styles.outerRing, { borderColor: activeColor }, ring1Style]} />
      
      {/* Layer 2 - Mid */}
      <Animated.View style={[styles.ring, styles.midRing, { borderColor: activeColor }, ring2Style]} />
      
      {/* Layer 3 - Inner Solid */}
      <View style={[styles.ring, styles.innerRing, { borderColor: activeColor, shadowColor: activeColor }]} />
      
      {/* Layer 4 - Center Core */}
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Animated.View style={[styles.core, coreStyle]}>
          {status === 'active' && <Zap size={28} color={activeColor} />}
          {status === 'idle' && <Pause size={28} color={Colors.textSecondary} />}
          {status === 'offline' && <X size={28} color={Colors.danger} />}
        </Animated.View>
      </TouchableOpacity>

      <View style={styles.labelContainer}>
        <NeonText color={activeColor} size={11} letterSpacing={3} style={styles.label}>
          {`REACTOR ${status.toUpperCase()}`}
        </NeonText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  outerRing: {
    width: 200,
    height: 200,
  },
  midRing: {
    width: 160,
    height: 160,
  },
  innerRing: {
    width: 120,
    height: 120,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 4,
  },
  core: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    position: 'absolute',
    bottom: -32,
  },
  label: {
    ...Typography.monoHeader,
  }
});
