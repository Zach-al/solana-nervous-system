import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedProps, 
  withTiming, 
  useDerivedValue, 
  Easing,
  interpolateColor,
  useAnimatedStyle
} from 'react-native-reanimated';
import { Colors, Typography } from '../../constants/antigravity';

interface MonoCounterProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  color?: string;
  size?: number;
}

const AnimatedText = Animated.createAnimatedComponent(Animated.Text);

export default function MonoCounter({
  value,
  decimals = 5,
  prefix = '',
  suffix = '',
  color = Colors.green,
  size = 32
}: MonoCounterProps) {
  const animatedValue = useSharedValue(value);
  const colorProgress = useSharedValue(0); // 0 = baseline, 1 = flash
  const flashColor = useRef<string>(Colors.green);

  useEffect(() => {
    if (value > animatedValue.value) {
      flashColor.current = Colors.green;
      colorProgress.value = 1;
      colorProgress.value = withTiming(0, { duration: 500 });
    } else if (value < animatedValue.value) {
      flashColor.current = Colors.danger;
      colorProgress.value = 1;
      colorProgress.value = withTiming(0, { duration: 500 });
    }
    
    animatedValue.value = withTiming(value, {
      duration: 800,
      easing: Easing.out(Easing.cubic)
    });
  }, [value]);

  const animatedProps = useAnimatedProps(() => {
    const formatted = animatedValue.value.toFixed(decimals);
    return {
      text: `${prefix}${formatted}${suffix}`
    } as any;
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      color: interpolateColor(
        colorProgress.value,
        [0, 1],
        [color, flashColor.current]
      ),
      fontSize: size
    };
  });

  return (
    <AnimatedText
      style={[styles.text, animatedStyle]}
      animatedProps={animatedProps}
    >
      {/* Fallback for web/mount */}
      {`${prefix}${value.toFixed(decimals)}${suffix}`}
    </AnimatedText>
  );
}

const styles = StyleSheet.create({
  text: {
    ...Typography.mono,
  }
});
