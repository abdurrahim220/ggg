import {
  RTCPeerConnection,
  mediaDevices,
  RTCView,
} from 'react-native-webrtc'

export const pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
})

export const getCameraStream = async () => {
  return await mediaDevices.getUserMedia({
    video: true,
    audio: true,
  })
}
