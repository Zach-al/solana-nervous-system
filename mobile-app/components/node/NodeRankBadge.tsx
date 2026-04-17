import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Springs, Typography } from '../../constants/antigravity';

interface NodeRankBadgeProps {
  requestsServed: number;
}

export const getRankInfo = (requests: number) => {
  if (requests === 0)       return { rank: 'Dormant Node', color: Colors.textTertiary };
  if (requests < 100)      return { rank: 'Genesis Operator', color: Colors.purple };
  if (requests < 500)      return { rank: 'Relay Runner', color: Colors.cyan };
  if (requests < 2000)     return { rank: 'Mesh Weaver', color: Colors.green };
  if (requests < 10000)    return { rank: 'Network Spine', color: Colors.warning };
  return { rank: 'Core Validator', color: Colors.cyan };
};

export default function NodeRankBadge({ requestsServed }: NodeRankBadgeProps) {
  const info = useMemo(() => getRankInfo(requestsServed), [requestsServed]);
  const scale = useSharedValue(1);

  // Pulse when rank changes
  useEffect(() => {
    scale.value = withSpring(1.15, Springs.buttonPress, () => {
      scale.value = withSpring(1);
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [info.rank]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: `${info.color}66`, // 40% opacity
    backgroundColor: `${info.color}1F`, // 12% opacity
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={[styles.text, { color: info.color }]}>
        {`⬡ ${info.rank}`}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  text: {
    ...Typography.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  }
});
