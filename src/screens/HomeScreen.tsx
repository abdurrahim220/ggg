import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { socket } from '../socket/socket';
import { generateDeviceId } from '../utils/deviceId';
import { RTCPeerConnection, RTCView, mediaDevices } from 'react-native-webrtc';

const HomeScreen = () => {
  const [deviceId, setDeviceId] = useState('');
  const [remoteId, setRemoteId] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>(
    'idle',
  );
  const [localStream, setLocalStream] = useState<any>(null);
  const remoteIdRef = useRef('');

  useEffect(() => {
    const requestPermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);
        } catch (err) {
          console.warn(err);
        }
      }
    };
    requestPermissions();
  }, []);

  // Update ref when state changes
  useEffect(() => {
    remoteIdRef.current = remoteId;
  }, [remoteId]);

  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [_peerConnection, _setPeerConnection] =
    useState<RTCPeerConnection | null>(null);

  // Data Channel for Remote Control
  const dataChannelRef = useRef<any>(null);

  // Track video view dimensions for touch coordinate normalization
  const videoViewDimensionsRef = useRef<{ width: number; height: number }>({
    width: 1,
    height: 1,
  });

  useEffect(() => {
    const id = generateDeviceId();
    setDeviceId(id);

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    (pc as any).oniceconnectionstatechange = () => {
      console.log('ICE Connection State:', pc.iceConnectionState);
    };

    (pc as any).onconnectionstatechange = () => {
      console.log('Connection State:', (pc as any).connectionState);
    };

    // Use 'any' casting to bypass incomplete TS definitions in react-native-webrtc
    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        socket.send(
          JSON.stringify({
            type: 'ICE_CANDIDATE',
            targetId: remoteIdRef.current,
            candidate: event.candidate,
          }),
        );
      }
    };

    (pc as any).ontrack = (event: any) => {
      console.log('Received track:', event.streams[0]);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Fallback for older environments
    (pc as any).onaddstream = (event: any) => {
      console.log('Received stream:', event.stream);
      if (event.stream) {
        setRemoteStream(event.stream);
      }
    };

    // HANDLE INCOMING DATA CHANNEL (For the Viewer side)
    // If we are the Viewer, the Host created the channel, so we receive it here.
    // Actually, since Host (Offerer) creates it, Viewer (Answerer) receives it.
    // BUT wait, DataChannels are bidirectional.
    // Scenario: Host (Sharer/Offerer) creates channel.
    // Viewer receives ondatachannel.
    // Viewer sends Clicks -> Host.
    (pc as any).ondatachannel = (event: any) => {
      console.log('Received Data Channel:', event.channel.label);
      const receivedChannel = event.channel;
      dataChannelRef.current = receivedChannel;
      setupDataChannel(receivedChannel);
    };

    _setPeerConnection(pc);

    const setupDataChannel = (channel: any) => {
      channel.onopen = () => {
        console.log('Data Channel OPEN');
      };
      channel.onmessage = (event: any) => {
        console.log('Received Message on Data Channel:', event.data);
        // HOST SIDE LOGIC: Receive Click
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'TOUCH') {
            console.log(`EXECUTE TOUCH at ${msg.x * 100}%, ${msg.y * 100}%`);
            // FUTURE: Inject native touch here
          }
        } catch (e) {
          console.log('Error parsing data channel message', e);
        }
      };
    };

    const onOpen = () => {
      console.log('Socket connected');
      socket.send(
        JSON.stringify({
          type: 'REGISTER_DEVICE',
          deviceId: id,
        }),
      );
    };

    const onMessage = async (msg: any) => {
      const data = JSON.parse(msg.data);
      console.log('Socket message:', data);

      if (data.type === 'INCOMING_REQUEST') {
        Alert.alert(
          'Incoming Connection',
          `Device ${data.from} wants to connect. Do you accept?`,
          [
            {
              text: 'Decline',
              style: 'cancel',
              onPress: () => {
                socket.send(
                  JSON.stringify({
                    type: 'CONNECT_REJECT',
                    targetId: data.from,
                  }),
                );
              },
            },
            {
              text: 'Accept',
              onPress: async () => {
                try {
                  // Set remote ID first
                  setRemoteId(data.from);
                  remoteIdRef.current = data.from;

                  // Send acceptance notification to viewer
                  socket.send(
                    JSON.stringify({
                      type: 'CONNECT_ACCEPT',
                      targetId: data.from,
                    }),
                  );

                  // 1. Get Screen Stream (Host shares screen)
                  console.log('Requesting screen capture...');
                  try {
                    const stream = await mediaDevices.getDisplayMedia();
                    console.log('Screen capture stream obtained:', stream);
                    console.log('Stream tracks:', stream.getTracks());
                    console.log('Stream active:', stream.active);
                    setLocalStream(stream);

                    // 2. Add Track to PeerConnection
                    stream.getTracks().forEach((track: any) => {
                      console.log(
                        'Adding track:',
                        track.kind,
                        'enabled:',
                        track.enabled,
                        'readyState:',
                        track.readyState,
                      );
                      pc.addTrack(track, stream);
                    });

                    // 3. Create Data Channel (Host side creates it)
                    const dc = pc.createDataChannel('control');
                    dataChannelRef.current = dc;
                    setupDataChannel(dc);

                    // 4. Create Offer (Host is the Offerer now)
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    console.log('Sending OFFER to viewer');
                    socket.send(
                      JSON.stringify({
                        type: 'OFFER',
                        targetId: data.from,
                        offer,
                      }),
                    );
                  } catch (streamError: any) {
                    console.error('Failed to get display media:', streamError);
                    Alert.alert(
                      'Screen Capture Failed',
                      `Error: ${streamError.message || streamError}`,
                    );
                    return;
                  }
                } catch (err) {
                  console.error('Error starting screen share:', err);
                  Alert.alert('Error', 'Could not start screen sharing.');
                }
              },
            },
          ],
        );
      }

      if (data.type === 'CONNECT_ACCEPTED') {
        // Viewer receives acceptance from host
        console.log('Connection accepted by host, waiting for OFFER...');
        setStatus('connecting');
      }

      if (data.type === 'CONNECT_REJECTED') {
        // Viewer's request was rejected
        console.log('Connection rejected by host');
        Alert.alert(
          'Connection Rejected',
          'The host declined your connection request.',
        );
        setStatus('idle');
      }

      if (data.type === 'ANSWER') {
        // Host receives Answer
        console.log('Received ANSWER, setting remote description');
        await pc.setRemoteDescription(data.answer);
        setStatus('connected');
      }

      if (data.type === 'OFFER') {
        // Viewer receives Offer
        console.log('Received OFFER from host, creating ANSWER');
        setRemoteId(data.from);
        remoteIdRef.current = data.from;

        await pc.setRemoteDescription(data.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        console.log('Sending ANSWER to host');
        socket.send(
          JSON.stringify({
            type: 'ANSWER',
            targetId: data.from,
            answer,
          }),
        );
        setStatus('connected');
      }

      if (data.type === 'ICE_CANDIDATE') {
        console.log('Received ICE_CANDIDATE');
        await pc.addIceCandidate(data.candidate);
      }
    };

    const onError = (e: any) => {
      console.error('Socket error:', e.message);
    };

    if (socket.readyState === WebSocket.OPEN) {
      onOpen();
    } else {
      socket.onopen = onOpen;
    }

    socket.onmessage = onMessage;
    socket.onerror = onError;

    return () => {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      pc.close();
    };
  }, []); // Remove remoteId dependency

  const connectToDevice = () => {
    setStatus('connecting');
    socket.send(
      JSON.stringify({
        type: 'CONNECT_REQUEST',
        deviceId: deviceId, // Explicitly add our ID for server logs
        targetId: remoteId,
      }),
    );
  };

  const disconnect = () => {
    if (_peerConnection) {
      _peerConnection.close();
      setRemoteStream(null);
      setStatus('idle');
    }
  };

  // Handle Touch on Viewer Side
  const handleTouch = (evt: any) => {
    if (
      !dataChannelRef.current ||
      dataChannelRef.current.readyState !== 'open'
    ) {
      console.log('Data Channel not open');
      return;
    }

    const { locationX, locationY } = evt.nativeEvent;
    const { width, height } = videoViewDimensionsRef.current;

    // Normalize coordinates to 0-1 range
    const normalizedX = locationX / width;
    const normalizedY = locationY / height;

    // Send normalized coordinates
    const msg = JSON.stringify({
      type: 'TOUCH',
      x: normalizedX,
      y: normalizedY,
    });
    console.log(
      `Sending Touch: (${normalizedX.toFixed(3)}, ${normalizedY.toFixed(3)})`,
    );
    dataChannelRef.current.send(msg);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text>Your Device ID:</Text>
        <Text style={styles.text}>{deviceId}</Text>
        <Text style={styles.statusText}>Status: {status.toUpperCase()}</Text>

        <TextInput
          placeholder="Enter Remote ID"
          value={remoteId}
          onChangeText={setRemoteId}
          style={styles.input}
        />

        <View style={styles.buttonRow}>
          <Button
            title="Connect"
            onPress={connectToDevice}
            disabled={status !== 'idle'}
          />
          {status !== 'idle' && (
            <Button title="Disconnect" onPress={disconnect} color="red" />
          )}
        </View>
      </View>

      {remoteStream && (
        <View style={styles.fullscreenVideoContainer}>
          <View
            style={styles.remoteWrapper}
            onLayout={e => {
              const { width, height } = e.nativeEvent.layout;
              videoViewDimensionsRef.current = { width, height };
              console.log(`Video view dimensions: ${width}x${height}`);
            }}
          >
            <RTCView
              key={remoteStream.toURL()}
              streamURL={remoteStream.toURL()}
              style={styles.remoteVideo}
              objectFit="contain"
              mirror={false}
              zOrder={1}
            />
            <TouchableOpacity
              activeOpacity={1}
              style={styles.touchOverlay}
              onPress={e => handleTouch(e)}
            />
          </View>
          <View style={styles.fullscreenControls}>
            <Button
              title="Exit Fullscreen"
              onPress={disconnect}
              color="#ff4444"
            />
          </View>
        </View>
      )}

      {status === 'connected' && !remoteStream && (
        <View style={styles.infoBox}>
          <Text>Sharing your screen... (Host Mode)</Text>
          {localStream && (
            <View style={styles.localPreviewContainer}>
              <Text style={styles.localPreviewLabel}>
                Local Preview (What you are sending):
              </Text>
              <RTCView
                streamURL={localStream.toURL()}
                style={styles.localPreview}
                objectFit="contain"
                mirror={false}
                zOrder={1}
              />
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  input: {
    borderWidth: 1,
    marginVertical: 20,
    width: '100%',
    padding: 10,
    borderRadius: 5,
    borderColor: '#ccc',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  videoContainer: {
    width: '90%',
    height: 600,
    marginTop: 20,
    backgroundColor: '#000',
    borderRadius: 10,
    padding: 5,
  },
  fullscreenVideoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  fullscreenControls: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1001,
  },
  videoTitle: {
    color: '#fff',
    marginBottom: 5,
  },
  infoBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 5,
  },
  remoteWrapper: {
    flex: 1,
    position: 'relative',
    marginTop: 5,
  },
  remoteVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    // backgroundColor: 'rgba(255, 0, 0, 0.2)', // Debug color
    backgroundColor: 'transparent',
  },
  localPreviewContainer: {
    width: 200,
    height: 150,
    marginTop: 10,
    backgroundColor: '#000',
    padding: 2,
  },
  localPreview: {
    flex: 1,
  },
  localPreviewLabel: {
    fontSize: 10,
    color: '#333',
  },
});
