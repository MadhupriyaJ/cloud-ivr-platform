import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'ConversationMessages' })
export class ConversationMessageEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'MessageId' })
  messageId!: string;

  @Column({ name: 'ConversationId' })
  conversationId!: string;

  @Column({ name: 'SpeakerType', length: 40 })
  speakerType!: string;

  @Column({ name: 'MessageType', length: 40 })
  messageType!: string;

  @Column({ name: 'MessageText', type: 'nvarchar' })
  messageText!: string;

  @Column({ name: 'SequenceNo', type: 'bigint' })
  sequenceNo!: number;

  @CreateDateColumn({ name: 'CreatedAt', type: 'datetime2' })
  createdAt!: Date;
}
