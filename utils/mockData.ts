
import type { OcrPayload } from '../types';

export const MOCK_ASSESSMENT_ITEMS: OcrPayload[] = [
  {
    stem: "Which of the following is the capital of Canada?",
    options: [
      { id: 'A', text: 'Toronto' },
      { id: 'B', text: 'Vancouver' },
      { id: 'C', text: 'Ottawa' },
      { id: 'D', text: 'Montreal' },
    ],
    rawText: "Which of the following is the capital of Canada? A) Toronto B) Vancouver C) Ottawa D) Montreal",
    ocrHash: "hash_mcq_1",
  },
  {
    stem: "A user wants to allow HTTP traffic through their server's firewall. Which port should they open?",
    options: [],
    rawText: "A user wants to allow HTTP traffic... which port should they open?",
    ocrHash: "hash_numeric_1",
  },
  {
    stem: "To secure the marketing department's data, drag the 'Marketing_Data' folder into the 'Encrypted_Vault'.",
    options: [
        { id: 'source', text: 'Marketing_Data folder' },
        { id: 'destination', text: 'Encrypted_Vault' }
    ],
    rawText: "To secure the marketing department's data, drag the 'Marketing_Data' folder into the 'Encrypted_Vault'.",
    ocrHash: "hash_dnd_1",
  },
  {
    stem: "Configure the web server to deny all incoming traffic except from the internal IP range 10.0.0.0/8.",
    options: [],
    rawText: "Configure the web server to deny all incoming traffic...",
    ocrHash: "hash_lab_1",
  },
  {
    stem: "What is the result of 15 * 4?",
    options: [],
    rawText: "What is the result of 15 * 4?",
    ocrHash: "hash_numeric_2",
  }
];
