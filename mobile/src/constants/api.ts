import Constants from 'expo-constants';

// Use a manual address if set; otherwise use the computer address Expo sees.
const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];

// Expo Go's manifest host is the development computer's LAN address, which
// lets a phone reach a backend bound to 0.0.0.0 without hardcoding an IP.
export const API_URL = (configuredUrl || (expoHost ? `http://${expoHost}:5000` : 'http://127.0.0.1:5000')).replace(/\/$/, '');
