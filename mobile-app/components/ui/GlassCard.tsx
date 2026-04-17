import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Springs } from '../../constants/antigravity';

interface GlassCardProps {
  children: React.ReactNode;
  glowColor?: string;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function GlassCard({ 
  children, 
  glowColor = Colors.cyanDim, 
  active = false, 
  style, 
  onPress 
}: GlassCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: active ? glowColor : Colors.glassBorder,
    shadowColor: active ? glowColor : 'transparent',
    shadowOpacity: active ? 0.4 : 0,
    shadowRadius: 12,
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.97, Springs.buttonPress);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, Springs.buttonPress);
    }
  };

  const Wrapper = onPress ? AnimatedTouchableOpacity : Animated.View;

  return (
    <Wrapper
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      style={[
        styles.card,
        animatedStyle,
        style,
        active && styles.activeElevation
      ]}
    >
      {children}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  activeElevation: {
    elevation: 8, // Android shadow
  }
});
