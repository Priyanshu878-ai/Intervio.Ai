# System Architecture & Technical Specification

## Overview

**Intervio.Ai** is designed as a production-grade, modular monorepo for multimodal interview analysis. The system receives candidate interview responses (video, audio, text) and processes them through an end-to-end deep learning pipeline to generate explainable feedback and performance analytics.

> [!NOTE]
> **Specification Notice**: This document outlines the target system architecture and planned multimodal data flow. In accordance with strict development practices, no fake models, dummy predictions, or synthetic datasets are created during initialization.

---

## High-Level Component Boundaries

The system strictly enforces a clear separation of concerns across four core domains:

```
+-----------------------------------------------------------------------+
|                         Next.js Frontend                              |
|   (Candidate Recording UI, Live Video/Audio Capture, Analytics Dash)  |
+-----------------------------------++----------------------------------+
                                    || HTTP REST / WebSockets
                                    \/
+-----------------------------------------------------------------------+
|                          FastAPI Backend                              |
|   (Session State, File Uploads, Task Queue, API Gateway, Orchestration)|
+------------------++-------------------------------+-------------------+
                   ||                               ||
                   || ORM (SQLAlchemy)              || Async Job / IPC
                   \/                               \/
+------------------------------------+  +-------------------------------+
|       PostgreSQL 17 Database       |  |          ML Modules           |
| (Users, Sessions, Scores, Feedback)|  | (Feature Extraction & Fusion) |
+------------------------------------+  +-------------------------------+
```

1. **Frontend (`frontend/`)**: Pure UI/UX presentation layer (Next.js, TypeScript, Tailwind CSS). Responsible for video/audio recording, response submission, and rendering interactive score breakdowns. Contains zero ML model logic.
2. **Backend (`backend/`)**: Web API server (FastAPI, Python 3.11). Manages session orchestration, authentication, media upload storage, database interactions, and dispatches background tasks to ML pipelines.
3. **Database (`database/`)**: Relational database persistence layer (PostgreSQL 17, SQLAlchemy, Alembic). Handles structured metadata, user profiles, interview transcripts, and multi-stream feature evaluations.
4. **Machine Learning (`ml/`)**: Standalone, modular PyTorch and Deep Learning engine. Houses feature extractors, multimodal encoders, neural fusion layers, and explainability generators.

---

## Planned Multimodal Pipeline Architecture

The core ML workflow implements a 6-stage sequential/parallel multimodal pipeline:

```
[ Stage 1: Candidate Input (Video / Audio / Text Response) ]
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ Stage 2a:    │  │ Stage 2b:    │  │ Stage 2c:    │
  │ Text Encoder │  │ Audio Encoder│  │ Visual       │
  │              │  │              │  │ Encoder      │
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Stage 3:        │
                  │ Feature Fusion  │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Stage 4:        │
                  │ Performance     │
                  │ Prediction      │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Stage 5:        │
                  │ Explainable     │
                  │ Feedback        │
                  └─────────────────┘
```

### Stage 1: Input Ingestion & Preprocessing
Video streams are decoupled into separate raw audio (.wav) and frame sequence tracks. Text responses are sanitized and tokenized.

### Stage 2a: Text Encoder Module
- **Transcripts**: Obtained via `faster-whisper` automatic speech recognition (ASR) or direct text input.
- **Semantic Encoders**: Transformer-based models (`Sentence Transformers` / Hugging Face Transformers) extract semantic embedding vectors $\mathbf{e}_{\text{text}} \in \mathbb{R}^{d_t}$ comparing candidate answers against expected question domain concepts.

### Stage 2b: Audio Encoder Module
- **Speech Transcription**: High-performance Whisper model generates timestamped speech tokens.
- **Acoustic Feature Extractor**: `Librosa` computes speech signal dynamics:
  - Fundamental pitch trajectory ($f_0$) & intonation variability.
  - Speech tempo (words per minute), pause frequency, and silence durations.
  - Acoustic energy (RMS energy) for vocal confidence estimation.
- Output vector: $\mathbf{e}_{\text{audio}} \in \mathbb{R}^{d_a}$.

### Stage 2c: Visual Encoder Module (Landmarks vs. Affect Model Separation)
To ensure high precision and proper deep learning separation:
- **MediaPipe (Geometric Feature Extractor)**:
  - Responsible strictly for facial landmark extraction (468 3D face mesh points), pose estimation, eye gaze direction, and head orientation vector tracking.
  - Does **not** perform emotion classification.
- **Dedicated Deep Learning Visual Emotion Model**:
  - Separate PyTorch visual model (e.g., Vision Transformer or Convolutional Neural Network) operating on cropped facial region-of-interest (ROI) frames and landmark configurations.
  - Predicts temporal affect state (confidence, composure, hesitation, engagement).
- Combined visual representation vector: $\mathbf{e}_{\text{visual}} \in \mathbb{R}^{d_v}$.

### Stage 3: Multimodal Feature Fusion
A deep neural fusion layer combines unimodal feature embeddings ($\mathbf{e}_{\text{text}}, \mathbf{e}_{\text{audio}}, \mathbf{e}_{\text{visual}}$):
- Implements cross-attention / Gated Multimodal Units (GMU) to model inter-modality dependencies (e.g., matching confident spoken words with steady vocal tone and positive visual engagement).
- Generates unified multimodal representation: $\mathbf{h}_{\text{fusion}} = \text{FusionNet}(\mathbf{e}_{\text{text}}, \mathbf{e}_{\text{audio}}, \mathbf{e}_{\text{visual}})$.

### Stage 4: Performance Prediction
Predictor heads attached to the fused vector $\mathbf{h}_{\text{fusion}}$ evaluate key dimension metrics:
- Technical Completeness & Accuracy score.
- Communication & Verbal Structure score.
- Delivery Confidence & Non-Verbal Demeanor score.

### Stage 5: Explainable Feedback Generator
Converts numerical embeddings and score attributions into transparent, human-readable feedback:
- Identifies specific timestamps with long pauses, filler words, or low visual contact.
- Formulates actionable improvement recommendations grounded in extracted evidence.
- Suggests adaptive follow-up questions for under-explained answer segments.

---

## Data Schema Strategy (PostgreSQL 17)

The database schema manages relational data across five core entities:

1. **`users`**: Candidate accounts, roles, and profiles.
2. **`interview_sessions`**: Session metadata, target domain, difficulty, status.
3. **`questions`**: Question bank items, expected concept criteria, difficulty tags.
4. **`session_responses`**: Candidate text/audio/video responses mapped per question.
5. **`multimodal_evaluations`**: Granular scores, extracted feature summaries, timestamped transcriptions, and generated explainable feedback logs.

---

## Scalability & Security Principles

1. **No Hardcoded Credentials**: Database connections, JWT keys, and API secrets are loaded purely from environment variables (`.env`).
2. **Resource Management**: Large ML model weights and heavy dataset caches are isolated from Git tracking via specific `.gitignore` rules.
3. **Asynchronous Processing**: Heavy audio/video processing and neural inference tasks run asynchronously in backend background workers, preventing API thread blocking.
