import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ame.videochat',
  appName: 'Ame',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: false,
    scheme: 'http',
  },
};

export default config;
