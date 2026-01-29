import React, { useEffect, useState } from "react"
import { View, Text, TextInput, Button } from "react-native"
import { socket } from "../socket/socket"
import { generateDeviceId } from "../utils/deviceId"

const HomeScreen = () => {

  const [deviceId, setDeviceId] = useState("")
  const [remoteId, setRemoteId] = useState("")

  useEffect(() => {
    const id = generateDeviceId()
    setDeviceId(id)

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: "REGISTER_DEVICE",
        deviceId: id
      }))
    }

    socket.onmessage = msg => {
      const data = JSON.parse(msg.data)

      if (data.type === "INCOMING_REQUEST") {
        alert("Incoming connection from " + data.from)
      }

      if (data.type === "CONNECT_ACCEPTED") {
        alert("Connection Accepted — Start WebRTC Now")
      }
    }

  }, [])

  const connectToDevice = () => {
    socket.send(JSON.stringify({
      type: "CONNECT_REQUEST",
      deviceId,
      targetId: remoteId
    }))
  }

  return (
    <View style={{ padding: 20 }}>

      <Text>Your Device ID:</Text>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>{deviceId}</Text>

      <TextInput
        placeholder="Enter Remote ID"
        value={remoteId}
        onChangeText={setRemoteId}
        style={{ borderWidth: 1, marginVertical: 20 }}
      />

      <Button title="Connect" onPress={connectToDevice} />

    </View>
  )
}

export default HomeScreen
