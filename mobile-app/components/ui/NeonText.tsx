import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { Colors, Typography } from '../../constants/antigravity';

interface NeonTextProps {
  children: string | React.ReactNode;
  color?: string;
  size?: number;
  mono?: boolean;
  style?: StyleProp<TextStyle>;
  letterSpacing?: number;
}

export default function NeonText({ 
  children, 
  color = Colors.cyan, 
  size, 
  mono = false, 
  style,
  letterSpacing
}: NeonTextProps) {
  const baseStyle = mono ? Typography.mono : Typography.display;
  
  return (
    <Text 
      style={[
        baseStyle,
        { 
          color: color, 
          fontSize: size || (baseStyle as any).fontSize,
          textShadowColor: color,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
          letterSpacing: letterSpacing ?? (baseStyle as any).letterSpacing
        },
        style
      ]}
    >
      {children}
    </Text>
  );
}
