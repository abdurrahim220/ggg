const WebSocket = require('websocket').server;
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(404);
  res.end();
});

server.listen(3000, () => {
  console.log('Signaling Server is running on port 3000');
});

const wsServer = new WebSocket({
  httpServer: server,
  autoAcceptConnections: false,
});

// Map to store connections: deviceId -> connection
const devices = new Map();

function originIsAllowed(origin) {
  return true;
}

wsServer.on('request', request => {
  if (!originIsAllowed(request.origin)) {
    request.reject();
    console.log(
      new Date() + ' Connection from origin ' + request.origin + ' rejected.',
    );
    return;
  }

  const connection = request.accept(null, request.origin);
  console.log(new Date() + ' Connection accepted.');

  connection.on('message', message => {
    if (message.type === 'utf8') {
      try {
        const data = JSON.parse(message.utf8Data);
        // console.log('Parsed data:', data.type);

        switch (data.type) {
          case 'REGISTER_DEVICE':
            devices.set(data.deviceId, connection);
            connection.deviceId = data.deviceId;
            console.log('Registered device:', data.deviceId);
            break;

          case 'CONNECT_REQUEST':
            const target = devices.get(data.targetId);
            if (target) {
              console.log(
                `Forwarding CONNECT_REQUEST from ${data.deviceId} to ${data.targetId}`,
              );
              target.send(
                JSON.stringify({
                  type: 'INCOMING_REQUEST',
                  from: data.deviceId,
                }),
              );
            } else {
              console.log(
                `Target ${data.targetId} not found for CONNECT_REQUEST`,
              );
              connection.send(
                JSON.stringify({
                  type: 'ERROR',
                  message: `Device ${data.targetId} not found`,
                }),
              );
            }
            break;

          case 'OFFER':
            const targetOffer = devices.get(data.targetId);
            if (targetOffer) {
              console.log(
                `Forwarding OFFER from ${connection.deviceId} to ${data.targetId}`,
              );
              targetOffer.send(
                JSON.stringify({
                  type: 'OFFER',
                  offer: data.offer,
                  from: connection.deviceId,
                }),
              );
            } else {
              console.log(`Target ${data.targetId} not found for OFFER`);
              connection.send(
                JSON.stringify({
                  type: 'ERROR',
                  message: `Device ${data.targetId} not found for OFFER`,
                }),
              );
            }
            break;

          case 'ANSWER':
            const targetAnswer = devices.get(data.targetId);
            if (targetAnswer) {
              console.log(
                `Forwarding ANSWER from ${connection.deviceId} to ${data.targetId}`,
              );
              targetAnswer.send(
                JSON.stringify({
                  type: 'ANSWER',
                  answer: data.answer,
                  from: connection.deviceId,
                }),
              );
            } else {
              console.log(`Target ${data.targetId} not found for ANSWER`);
              connection.send(
                JSON.stringify({
                  type: 'ERROR',
                  message: `Device ${data.targetId} not found for ANSWER`,
                }),
              );
            }
            break;

          case 'ICE_CANDIDATE':
            const targetIce = devices.get(data.targetId);
            if (targetIce) {
              console.log(
                `Forwarding ICE from ${connection.deviceId} to ${data.targetId}`,
              );
              targetIce.send(
                JSON.stringify({
                  type: 'ICE_CANDIDATE',
                  candidate: data.candidate,
                  from: connection.deviceId,
                }),
              );
            } else {
              // Usually too many candidates, so we don't log "not found" unless debugging
            }
            break;

          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (e) {
        console.log('Error parsing message:', e);
      }
    }
  });

  connection.on('close', (reasonCode, description) => {
    if (connection.deviceId) {
      devices.delete(connection.deviceId);
      console.log(
        `Device disconnected: ${connection.deviceId} (Reason: ${reasonCode})`,
      );
    }
  });
});
