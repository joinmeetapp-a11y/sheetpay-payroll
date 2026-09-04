import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.mysheetpay.mobile',
  appName: 'Sheetpay',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
