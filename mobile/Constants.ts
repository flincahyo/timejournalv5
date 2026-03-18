import { Platform } from 'react-native';

/**
 * SOURCE OF TRUTH FOR BACKEND CONNECTIVITY
 * 
 * If running on Android Emulator: use 10.0.2.2
 * If running on physical device: use your machine's LOCAL IP (e.g. 192.168.x.x)
 */
const DEV_IP = '192.168.232.72'; // YOUR COMPUTER'S IP (Run 'ipconfig' and find IPv4 Address)

export const BACKEND_URL = `https://api.timejournal.site`;
// NOTE: For Android Emulator, you can use 'http://10.0.2.2:8000'.
// For physical devices, ALWAYS use your COMPUTER'S IP.

export const API_URL = `${BACKEND_URL}/api`;
export const WS_URL = BACKEND_URL.replace('http', 'ws');
