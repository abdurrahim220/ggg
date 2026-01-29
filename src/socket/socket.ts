import WebSocket from "websocket"

export const socket = new WebSocket("ws://YOUR_IP:3000")

socket.onopen = () => {
  socket.send(JSON.stringify({
    type: "JOIN",
    username: "user1"
  }))
}
