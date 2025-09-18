import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.greenseam.app',
  appName: 'GreenSeam',
  webDir: 'dist', // used if you bundle web assets instead of pointing to server.url
  server: {
    // Production domain for release builds
    url: 'https://gs2-theta.vercel.app',
    cleartext: false,
  },
}

export default config
