import { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { View } from 'react-native';

export function PulseIndicator({ active }: { active: boolean }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    if (active) {
      opacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 1000 }), withTiming(0.3, { duration: 1000 })),
        -1,
        true
      );
    } else {
      opacity.value = 0.3;
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={style}>
      <View className={`w-3 h-3 rounded-full ${active ? 'bg-primary' : 'bg-danger'}`} />
    </Animated.View>
  );
}
