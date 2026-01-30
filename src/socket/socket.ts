// import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 to access host machine, others use localhost
// const SOCKET_URL =
//   Platform.OS === 'android' ? 'ws://10.0.2.2:3000' : 'ws://localhost:3000';

// export const socket = new WebSocket(SOCKET_URL);

export const socket = new WebSocket('wss://render-websocket-ir1e.onrender.com');
