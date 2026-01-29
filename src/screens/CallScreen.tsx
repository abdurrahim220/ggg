import React, { useEffect, useState } from 'react'
import { View, Button } from 'react-native'
import { RTCView } from 'react-native-webrtc'
import { pc, getCameraStream } from '../webrtc/peer'

const CallScreen = () => {
  const [stream, setStream] = useState<any>(null)

  const startCall = async () => {
    const localStream = await getCameraStream()
    localStream.getTracks().forEach(track =>
      pc.addTrack(track, localStream)
    )
    setStream(localStream)
  }

  return (
    <View style={{ flex: 1 }}>
      {stream && (
        <RTCView
          streamURL={stream.toURL()}
          style={{ flex: 1 }}
        />
      )}
      <Button title="Start Camera" onPress={startCall} />
    </View>
  )
}

export default CallScreen
