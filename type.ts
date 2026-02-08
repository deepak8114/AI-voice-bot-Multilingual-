
export enum BotState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  VOICE_PRINT_ENROLL = 'VOICE_PRINT_ENROLL',
  OTP_VALIDATION = 'OTP_VALIDATION',
  ACTIVE_SESSION = 'ACTIVE_SESSION',
  ERROR = 'ERROR'
}

export interface LatencyReport {
  asrEndTime: number;
  llmStartTime: number;
  ttsStartTime: number;
  audioFirstByteTime: number;
  totalLatency: number;
}

export interface FAQ {
  question: string;
  answer: string;
  language: 'Hindi' | 'English' | 'Mixed';
}

export interface ValidationLog {
  timestamp: string;
  event: string;
  status: 'Success' | 'Failure' | 'Pending';
}
