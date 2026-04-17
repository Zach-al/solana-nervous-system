import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text, ActivityIndicator } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withRepeat, 
  withSequence, 
  withTiming 
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Springs, Typography } from '../../constants/antigravity';

interface PressButtonProps {
  onPress: () => void | Promise<void>;
  label: string;
  variant?: 'primary' | 'danger' | 'ghost';
  haptic?: 'light' | 'medium' | 'heavy' | 'none';
  loading?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function PressButton({
  onPress,
  label,
  variant = 'primary',
  haptic = 'light',
  loading = false,
  icon,
  disabled = false
}: PressButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    if (loading) {
      opacity.value = withRepeat(
        withSequence(withTiming(0.4, { duration: 500 }), withTiming(1, { duration: 500 })),
        -1,
        true
      );
    } else {
      opacity.value = withTiming(1);
    }
  }, [loading]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value
  }));

  const handlePressIn = () => {
    if (disabled || loading) return;
    scale.value = withSpring(0.95, Springs.buttonPress);
    
    if (haptic !== 'none') {
      const hapticMethod = haptic === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy :
                          haptic === 'medium' ? Haptics.ImpactFeedbackStyle.Medium :
                          Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(hapticMethod);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, Springs.buttonPress);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          container: { borderColor: Colors.danger, backgroundColor: 'rgba(255, 59, 59, 0.08)' },
          text: { color: Colors.textPrimary }
        };
      case 'ghost':
        return {
          container: { borderColor: Colors.glassBorder, backgroundColor: Colors.glass },
          text: { color: Colors.textSecondary }
        };
      default:
        return {
          container: { borderColor: Colors.cyan, backgroundColor: Colors.cyanGlow },
          text: { color: Colors.textPrimary }
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <AnimatedTouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={1}
      style={[
        styles.button,
        vStyles.container,
        animatedStyle,
        disabled && styles.disabled
      ]}
    >
      <View className="flex-row items-center justify-center">
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text style={[styles.label, vStyles.text]}>
          {loading ? '...' : label}
        </Text>
      </View>
    </AnimatedTouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  label: {
    ...Typography.ui,
    fontSize: 16,
    textTransform: 'uppercase',
  },
  iconContainer: {
    marginRight: Spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  }
});
