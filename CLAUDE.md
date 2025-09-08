# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Development:**
- `npm run dev` - Start development server with Vite
- `npm run build` - Build for production
- `npm run preview` - Preview production build

**Prerequisites:** Node.js and `GEMINI_API_KEY` environment variable set in `.env.local`

## Architecture

This is an AI Assessment Practice Tool built with React + TypeScript + Vite that uses Google's Gemini AI to analyze educational assessment items through screen capture simulation.

### Core Components

**Assessment Flow:**
- `useAssessmentOrchestrator` (hooks/) - Main orchestration logic that manages capture, OCR processing, and answer stabilization
- `geminiService.ts` (services/) - Handles AI model requests to Gemini 2.5 Flash with structured JSON responses
- `types.ts` - Central type definitions for assessment items, votes, and application events

**State Management:**
- Uses a stability-based voting system where multiple LLM calls for the same question are aggregated
- Questions are identified by fingerprints (SHA-1 hash of normalized stem + sorted options)
- Requires 4+ consistent votes within a 5-vote window with 0.7+ confidence to finalize answers

**Mock Data Flow:**
- Currently uses `mockData.ts` instead of real screen capture OCR
- Cycles through different question types (MCQ, numeric, drag-and-drop, lab tasks) every ~5 seconds
- Real implementation would replace mock data with actual OCR processing

### Key Patterns

**Answer Stabilization:**
The system prevents flickering answers by requiring consensus across multiple AI calls before finalizing. Constants in `useAssessmentOrchestrator.ts`:
- `STABILITY_WINDOW_SIZE = 5`
- `STABILITY_VOTE_THRESHOLD = 4` 
- `STABILITY_CONFIDENCE_THRESHOLD = 0.7`
- `STABILITY_TIME_MS = 600`

**Abort Handling:**
Uses AbortController to cancel in-flight requests when questions change or capture stops.

**Event-Driven UI:**
App state flows through typed events (`StatusEvent | FinalizedEvent`) to update the UI.

### Important Notes

- Gemini API key is injected via Vite environment variables (`process.env.API_KEY`)
- Uses `@` path alias pointing to project root
- Camera permissions required for actual screen capture (currently mocked)
- Designed for educational practice, not real exam use