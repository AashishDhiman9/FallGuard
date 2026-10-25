import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fallguard.app',
  appName: 'FallGuard',
  webDir: 'dist',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
  },
};

export default config;
