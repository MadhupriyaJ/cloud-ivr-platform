import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({
  namespace: '/ws/realtime',
  cors: {
    origin: ['http://localhost:5173'],
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly realtimeService: RealtimeService) {}

  handleConnection(client: Socket) {
    void this.realtimeService.registerClient(client);
  }

  handleDisconnect(client: Socket) {
    void this.realtimeService.unregisterClient(client.id);
  }

  @SubscribeMessage('session:start')
  async startSession(@MessageBody() payload: { domainCode: string; customerIdentifier?: string }, client: Socket) {
    return this.realtimeService.startSession(client.id, payload);
  }

  @SubscribeMessage('audio:chunk')
  async pushAudio(@MessageBody() payload: { audioBase64: string }, client: Socket) {
    return this.realtimeService.handleAudioChunk(client.id, payload.audioBase64);
  }
}
