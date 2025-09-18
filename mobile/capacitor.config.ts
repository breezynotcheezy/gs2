import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.greenseam.app',
  appName: 'GreenSeam',
  webDir: 'dist', // not used when server.url is set
  server: {
    // Replace with your LAN IP so emulator/device can reach your dev server
    url: 'http://192.168.1.100:3000',
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
}

export default config
