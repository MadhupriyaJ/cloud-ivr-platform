import { useCallback, useRef, useState } from 'react';
import { fromBase64, floatToPcm16, rmsLevel, toBase64 } from './audio';
import type { ClientMessage, IvrStatus, ServerMessage } from './types';

const SAMPLE_RATE = 24000;
const SILENCE_RMS_THRESHOLD = 0.003;
const SILENCE_KEEPALIVE_INTERVAL = 3;
const ASSISTANT_PLAYBACK_GUARD_SECONDS = 0.06;
const MAX_LOG_LINES = 300;
const AVATAR_ENABLED = true;

function resolveWsUrl(domainId: string): string {
  const fromEnv = import.meta.env.VITE_BACKEND_WS_URL as string | undefined;
  const encodedDomain = encodeURIComponent(domainId.trim().toLowerCase());
  if (fromEnv && fromEnv.trim()) {
    const cleaned = fromEnv.trim();
    const joiner = cleaned.includes('?') ? '&' : '?';
    return `${cleaned}${joiner}domain=${encodedDomain}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://localhost:8010/ws?domain=${encodedDomain}`;
}

function resolveHttpUrl(path: string): string {
  const fromEnv = import.meta.env.VITE_BACKEND_HTTP_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) {
    return `${fromEnv.trim().replace(/\/+$/, '')}${path}`;
  }
  return `http://localhost:8010${path}`;
}

export function useRealtimeIvr() {
  const [status, setStatus] = useState<IvrStatus>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [avatarReady, setAvatarReady] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const playCursorRef = useRef<number>(0);
  const silentFrameCountRef = useRef<number>(0);
  const aiLiveTextRef = useRef<string>('');
  const speechRecognizerRef = useRef<any>(null);
  const avatarVideoElRef = useRef<HTMLVideoElement | null>(null);
  const avatarPcRef = useRef<RTCPeerConnection | null>(null);
  const avatarSynthRef = useRef<any>(null);
  const avatarStreamRef = useRef<MediaStream | null>(null);
  const avatarSpeakQueueRef = useRef<Promise<void>>(Promise.resolve());
  const avatarReadyRef = useRef(false);
  const avatarHasAudioTrackRef = useRef(false);

  const appendLog = useCallback((line: string) => {
    setLogs((prev) => [...prev, line].slice(-MAX_LOG_LINES));
  }, []);

  const setAvatarReadyState = useCallback((value: boolean) => {
    avatarReadyRef.current = value;
    setAvatarReady(value);
  }, []);

  const upsertLiveLog = useCallback((speaker: 'You' | 'AI', text: string) => {
    const prefix = `${speaker} (live): `;
    setLogs((prev) => {
      const next = [...prev];
      const existing = next.findIndex((line) => line.startsWith(prefix));
      if (existing >= 0) {
        next[existing] = `${prefix}${text}`;
      } else {
        next.push(`${prefix}${text}`);
      }
      return next.slice(-MAX_LOG_LINES);
    });
  }, []);

  const finalizeLiveLog = useCallback((speaker: 'You' | 'AI', text: string) => {
    const livePrefix = `${speaker} (live): `;
    const finalLine = `${speaker}: ${text}`;
    setLogs((prev) => {
      const next = [...prev];
      const existing = next.findIndex((line) => line.startsWith(livePrefix));
      if (existing >= 0) {
        next[existing] = finalLine;
      } else {
        next.push(finalLine);
      }
      return next.slice(-MAX_LOG_LINES);
    });
  }, []);

  const startHumanTranscription = useCallback(async () => {
    const response = await fetch(resolveHttpUrl('/api/speech/token'));
    if (!response.ok) {
      throw new Error(`Speech token error (${response.status})`);
    }

    const payload = (await response.json()) as { token: string; region: string };
    const sdkModule = await import('microsoft-cognitiveservices-speech-sdk');
    const speechsdk = sdkModule.default ?? sdkModule;

    const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(
      payload.token,
      payload.region
    );
    speechConfig.speechRecognitionLanguage = 'en-US';
    const audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
    speechRecognizerRef.current = recognizer;

    recognizer.recognizing = (_sender: unknown, event: any) => {
      const text = (event?.result?.text || '').trim();
      if (!text) return;
      upsertLiveLog('You', text);
    };

    recognizer.recognized = (_sender: unknown, event: any) => {
      const text = (event?.result?.text || '').trim();
      if (!text) return;
      finalizeLiveLog('You', text);
    };

    recognizer.canceled = (_sender: unknown, event: any) => {
      appendLog(`Speech canceled: ${event?.errorDetails || 'unknown reason'}`);
    };

    recognizer.sessionStopped = () => {
      appendLog('Speech transcription stopped.');
    };

    await new Promise<void>((resolve, reject) => {
      recognizer.startContinuousRecognitionAsync(
        () => resolve(),
        (error: unknown) => reject(error)
      );
    });
  }, [appendLog, finalizeLiveLog, upsertLiveLog]);

  const stopHumanTranscription = useCallback(() => {
    const recognizer = speechRecognizerRef.current;
    if (!recognizer) return;
    speechRecognizerRef.current = null;
    recognizer.stopContinuousRecognitionAsync(
      () => recognizer.close(),
      () => recognizer.close()
    );
  }, []);

  const setAvatarVideoElement = useCallback((element: HTMLVideoElement | null) => {
    avatarVideoElRef.current = element;
    if (element && avatarStreamRef.current) {
      element.srcObject = avatarStreamRef.current;
      void element.play().catch(() => {});
    }
  }, []);

  const startAvatar = useCallback(async () => {
    const [speechRes, relayRes] = await Promise.all([
      fetch(resolveHttpUrl('/api/speech/token')),
      fetch(resolveHttpUrl('/api/speech/avatar-relay-token'))
    ]);
    if (!speechRes.ok) throw new Error(`Speech token error (${speechRes.status})`);
    if (!relayRes.ok) throw new Error(`Avatar relay token error (${relayRes.status})`);

    const speechPayload = (await speechRes.json()) as { token: string; region: string };
    const relay = (await relayRes.json()) as {
      Urls?: string[]; urls?: string[]; Username?: string; username?: string; Password?: string; password?: string;
    };

    const sdkModule = await import('microsoft-cognitiveservices-speech-sdk');
    const speechsdk = sdkModule.default ?? sdkModule;

    const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(
      speechPayload.token,
      speechPayload.region
    );
    const avatarVideoFormat = new speechsdk.AvatarVideoFormat();
    const avatarConfig = new speechsdk.AvatarConfig('meg', 'business', avatarVideoFormat);
    const avatarSynth = new speechsdk.AvatarSynthesizer(speechConfig, avatarConfig);

    const urls = relay.Urls ?? relay.urls ?? [];
    const username = relay.Username ?? relay.username;
    const credential = relay.Password ?? relay.password;
    if (!urls.length) {
      throw new Error('Avatar relay token missing ICE urls.');
    }
    const peer = new RTCPeerConnection({
      iceServers: [{ urls, username, credential }]
    });
    peer.addTransceiver('video', { direction: 'recvonly' });
    peer.addTransceiver('audio', { direction: 'recvonly' });

    peer.ontrack = (event) => {
      if (event.track?.kind === 'audio') {
        avatarHasAudioTrackRef.current = true;
      }
      const stream = event.streams?.[0];
      if (!stream) return;
      avatarStreamRef.current = stream;
      const video = avatarVideoElRef.current;
      if (!video) return;
      video.srcObject = stream;
      void video.play().catch(() => {});
    };

    await avatarSynth.startAvatarAsync(peer);
    avatarPcRef.current = peer;
    avatarSynthRef.current = avatarSynth;
    setAvatarReadyState(true);
    appendLog('Avatar connected.');
  }, [appendLog, setAvatarReadyState]);

  const stopAvatar = useCallback(() => {
    setAvatarReadyState(false);
    avatarSpeakQueueRef.current = Promise.resolve();
    avatarHasAudioTrackRef.current = false;

    const synth = avatarSynthRef.current;
    avatarSynthRef.current = null;
    if (synth) {
      if (typeof synth.stopAvatarAsync === 'function') {
        void synth.stopAvatarAsync().catch(() => {});
      }
      if (typeof synth.close === 'function') {
        void synth.close().catch(() => {});
      }
    }

    const peer = avatarPcRef.current;
    avatarPcRef.current = null;
    if (peer) {
      peer.getSenders().forEach((sender) => sender.track?.stop());
      peer.getReceivers().forEach((receiver) => receiver.track?.stop());
      peer.close();
    }
    avatarStreamRef.current = null;
    if (avatarVideoElRef.current) {
      avatarVideoElRef.current.srcObject = null;
    }
  }, [setAvatarReadyState]);

  const enqueueAvatarSpeech = useCallback((text: string) => {
    const synth = avatarSynthRef.current;
    if (!synth || !text.trim()) return;
    avatarSpeakQueueRef.current = avatarSpeakQueueRef.current
      .then(
        () => synth.speakTextAsync(text).then(() => undefined)
      )
      .catch((error) => {
        appendLog(`Avatar speak failed: ${String(error)}`);
      });
  }, [appendLog]);

  const playPcm16 = useCallback((base64Audio: string) => {
    const context = audioCtxRef.current;
    if (!context) return;

    const bytes = fromBase64(base64Audio);
    const sampleCount = bytes.byteLength / 2;
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    for (let index = 0; index < sampleCount; index += 1) {
      channel[index] = view.getInt16(index * 2, true) / 0x8000;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    if (playCursorRef.current < context.currentTime) {
      playCursorRef.current = context.currentTime;
    }
    source.start(playCursorRef.current);
    playCursorRef.current += buffer.duration;
  }, []);

  const start = useCallback(
    async (domainId: string) => {
      if (status !== 'idle') {
        appendLog('Session is already running.');
        return;
      }
      if (!domainId.trim()) {
        appendLog('Select a domain before starting IVR.');
        return;
      }

      setStatus('connecting');
      const socket = new WebSocket(resolveWsUrl(domainId));
      wsRef.current = socket;

      socket.onopen = async () => {
        try {
          const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
          audioCtxRef.current = audioContext;
          playCursorRef.current = audioContext.currentTime;

          const mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          });
          mediaStreamRef.current = mediaStream;

          const sourceNode = audioContext.createMediaStreamSource(mediaStream);
          sourceNodeRef.current = sourceNode;

          const processorNode = audioContext.createScriptProcessor(1024, 1, 1);
          processorNodeRef.current = processorNode;

          processorNode.onaudioprocess = (event) => {
            const websocket = wsRef.current;
            if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
            const context = audioCtxRef.current;
            if (!context) return;

            // Prevent echo/feedback frames from cancelling assistant speech mid-sentence.
            if (playCursorRef.current > context.currentTime + ASSISTANT_PLAYBACK_GUARD_SECONDS) {
              silentFrameCountRef.current = 0;
              return;
            }

            const input = event.inputBuffer.getChannelData(0);
            const isSilent = rmsLevel(input) < SILENCE_RMS_THRESHOLD;
            if (isSilent) {
              silentFrameCountRef.current += 1;
              // Send periodic low-energy frames so server VAD can detect end-of-turn quickly.
              if (silentFrameCountRef.current % SILENCE_KEEPALIVE_INTERVAL !== 0) return;
            } else {
              silentFrameCountRef.current = 0;
            }

            const payload: ClientMessage = {
              type: 'input_audio',
              audio: toBase64(floatToPcm16(input))
            };
            websocket.send(JSON.stringify(payload));
          };

          sourceNode.connect(processorNode);
          processorNode.connect(audioContext.destination);
          await startHumanTranscription();
          if (AVATAR_ENABLED) {
            try {
              await startAvatar();
            } catch (error) {
              appendLog(`Avatar init failed: ${String(error)}`);
              setAvatarReady(false);
            }
          } else {
            setAvatarReady(false);
          }

          setStatus('connected');
          appendLog(`Connected to domain '${domainId}'. Mic + transcription started.`);
        } catch (error) {
          appendLog(`Audio init failed: ${String(error)}`);
          stopHumanTranscription();
          setStatus('idle');
        }
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as ServerMessage;
        if (message.type === 'output_audio') {
          // Fallback: if avatar has no audio track, play realtime audio directly.
          if (!avatarReadyRef.current || !avatarHasAudioTrackRef.current) {
            playPcm16(message.audio);
          }
        } else if (message.type === 'output_text') {
          aiLiveTextRef.current += message.text;
          upsertLiveLog('AI', aiLiveTextRef.current);
        } else if (message.type === 'output_text_done') {
          const finalText = aiLiveTextRef.current.trim();
          if (finalText) {
            finalizeLiveLog('AI', finalText);
            if (avatarReadyRef.current) {
              enqueueAvatarSpeech(finalText);
            }
          }
          aiLiveTextRef.current = '';
        }
      };

      socket.onerror = () => {
        appendLog('WebSocket error.');
      };

      socket.onclose = () => {
        stopHumanTranscription();
        if (AVATAR_ENABLED) {
          stopAvatar();
        }
        appendLog('Connection closed.');
        setStatus('idle');
        wsRef.current = null;
      };
    },
    [
      appendLog,
      enqueueAvatarSpeech,
      finalizeLiveLog,
      playPcm16,
      startAvatar,
      startHumanTranscription,
      status,
      stopAvatar,
      stopHumanTranscription,
      upsertLiveLog
    ]
  );

  const stop = useCallback(() => {
    processorNodeRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioCtxRef.current?.close();
    wsRef.current?.close();
    stopHumanTranscription();
    if (AVATAR_ENABLED) {
      stopAvatar();
    }

    processorNodeRef.current = null;
    sourceNodeRef.current = null;
    mediaStreamRef.current = null;
    audioCtxRef.current = null;
    wsRef.current = null;
    playCursorRef.current = 0;
    silentFrameCountRef.current = 0;
    aiLiveTextRef.current = '';
    setStatus('idle');
    appendLog('Stopped.');
  }, [appendLog, stopAvatar, stopHumanTranscription]);

  const clearLogs = useCallback(() => setLogs([]), []);

  return {
    status,
    logs,
    avatarReady,
    setAvatarVideoElement,
    start,
    stop,
    clearLogs
  };
}
