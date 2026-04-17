export const THEME = {
  colors: {
    background: '#0A0A0F',
    surface: '#13131A',
    surfaceHover: '#1C1C26',
    border: '#2A2A3A',
    primary: '#00FF88',
    primaryDim: '#00CC6A',
    accent: '#9945FF',
    accentDim: '#7B33CC',
    text: '#FFFFFF',
    textSecondary: '#9999AA',
    textTertiary: '#55556A',
    danger: '#FF4444',
    warning: '#FFAA00'
  },
  typography: {
    fontFamily: 'Inter',
  }
};

export const CONFIG = {
  SOLNET_API_URL: process.env.EXPO_PUBLIC_SOLNET_API_URL || 'https://solnet-production.up.railway.app',
  APP_VERSION: '1.0.0'
};
