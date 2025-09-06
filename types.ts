
export type OcrPayload = {
  stem: string;
  options: { id: string; text: string }[];
  rawText: string;
  ocrHash: string;
};

export type Fingerprint = {
  id: string;     // sha1 of normalized stem + sorted options
  ocrHash: string;
};

export type LlmAnswer = {
  answerId: string;     // option ID, numeric string, or short text
  confidence: number;   // 0..1
  instruction: string;  // ≤15 words, short hint (empty if simple MCQ/numeric)
  justification: string;// brief reason, used only for logs/audit
};

export type Vote = LlmAnswer & { ts: number };

export enum ItemStatus {
    IDLE = 'IDLE',
    READING = 'READING',
    FINALIZED = 'FINALIZED',
}

export type ItemState = {
  fingerprint: Fingerprint;
  votes: Vote[];
  status: ItemStatus;
  best?: { answerId: string; confidence: number; instruction: string };
  abortController?: AbortController;
  isAsking: boolean;
};

export type StatusEvent = { type: 'status'; status: 'idle'|'reading'|'proposing' };
export type FinalizedEvent = { type: 'finalized'; answerId: string; confidence: number; instruction: string; fingerprintId: string };

export type AppEvent = StatusEvent | FinalizedEvent;
