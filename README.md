# Intervio.Ai 🎯

**Intervio.Ai** is an advanced, production-grade Multimodal AI Interview Analyzer built using state-of-the-art Deep Learning, Natural Language Processing, Computer Vision, and Speech Processing technologies.

The platform provides comprehensive, explainable feedback for technical and behavioral interviews by evaluating candidate responses across multiple modalities—text content, speech signals, and non-verbal visual cues.

---

## 🌟 Vision & Project Goals

Intervio.Ai transforms traditional interview preparation and automated candidate evaluation by combining multi-stream AI signals into actionable, transparent performance insights:

- **Multimodal Evaluation**: Jointly analyzing textual response depth, acoustic confidence markers, and non-verbal behavioral cues.
- **Adaptive Follow-up Questions**: Dynamically generating context-aware follow-up questions tailored to candidate weak spots or ambiguous answers.
- **Explainable Feedback**: Providing transparent, non-black-box score breakdowns and actionable recommendations grounded in evidence.
- **Production-Grade Architecture**: Designed as a scalable monorepo separating frontend UI, FastAPI application services, PyTorch/Transformer ML pipelines, and PostgreSQL data persistence.

---

## ✨ Planned Features

1. **Textual & Knowledge Analysis (NLP)**
   - Transformer-based semantic answer completeness and accuracy scoring against reference criteria.
   - Sentence-embedding similarity and technical keyword coverage using `Sentence Transformers`.
   - Structured logic and communication clarity evaluation.

2. **Speech & Acoustic Signal Analysis**
   - High-accuracy speech-to-text transcription via `faster-whisper`.
   - Pitch variation, speech tempo, pause duration, filler word detection, and audio energy analysis using `Librosa`.

3. **Visual & Behavioral Signal Analysis**
   - Facial landmark, face mesh tracking, eye gaze, and head posture extraction powered by `MediaPipe`.
   - Dedicated Deep Learning visual model for facial emotion and affect recognition operating on facial region-of-interest (ROI) frames.
   - Body pose stability and eye contact engagement tracking.

4. **Multimodal Feature Fusion**
   - Cross-attention multimodal fusion combining text embeddings, acoustic features, and visual pose/emotion vectors into a unified candidate state.

5. **Performance & Skill Gap Analytics**
   - Granular breakdown of domain knowledge, communication confidence, behavioral demeanor, and response structure.
   - Actionable feedback generation linking specific timestamps/quotes to improvement suggestions.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | [Next.js](https://nextjs.org/) (React Framework), TypeScript, Tailwind CSS |
| **Backend** | [Python 3.11](https://www.python.org/), [FastAPI](https://fastapi.tiangolo.com/) |
| **Database** | [PostgreSQL 17](https://www.postgresql.org/), [SQLAlchemy ORM](https://www.sqlalchemy.org/), [Alembic Migrations](https://alembic.sqlalchemy.org/) |
| **Machine Learning** | PyTorch, Hugging Face Transformers, Sentence Transformers, OpenCV, MediaPipe, Librosa, faster-whisper, scikit-learn, NumPy, Pandas |

---

## 📁 Repository Structure

```
Intervio.Ai/
├── frontend/             # Next.js TypeScript web application UI
│   └── src/              # Pages, components, hooks, and client services
├── backend/              # FastAPI application server
│   └── app/              # API routes, core application configs, and business services
├── ml/                   # Machine Learning pipelines and deep learning modules
│   ├── models/           # Custom PyTorch neural network architectures & fusion layers
│   ├── pipelines/        # Inference and training execution pipelines
│   ├── features/         # Audio, visual, and textual feature extraction routines
│   └── utils/            # Preprocessing helpers and ML utilities
├── database/             # Data persistence and migration management
│   ├── schemas/          # SQLAlchemy ORM model definitions
│   └── migrations/       # Alembic database migration scripts
├── docs/                 # Project documentation & architectural diagrams
│   └── ARCHITECTURE.md   # Comprehensive system architecture & data flow spec
├── .env.example          # Environment variable template
├── .gitignore            # Git exclusion definitions
└── README.md             # Project overview & roadmap
```

---

## 📐 Architecture Principles

- **Strict Separation of Concerns**: Frontend UI components never invoke ML models directly; all interactions flow through documented FastAPI REST/WebSocket API contracts.
- **Independent ML Module Testability**: ML feature extractors and model pipelines are organized as modular Python modules testable independently from web servers.
- **Isolated Database Migrations**: Database schemas and migration versions reside strictly in `database/`.
- **Environment & Secrets Hygiene**: All sensitive configurations rely on `.env` files; secrets are strictly excluded from version control.

---

## 🔄 Git & GitHub Development Workflow

To ensure high codebase quality and clear commit history, all team contributions follow this structured workflow:

### Development Cycle
1. **Branch / Feature Isolation**: Create a dedicated branch or feature focus before working on a task.
2. **Local Feature Development**: Implement feature modules in their designated workspace directory (`frontend/`, `backend/`, `ml/`, or `database/`).
3. **Verification & Testing**: Run unit tests, linting, and manual validation before staging changes.
4. **Meaningful Staging & Commits**: Group related changes into logical commits using standardized commit prefixes.
5. **Push & Code Review**: Push cleanly verified commits to the repository.

### Commit Message Conventions
Use standardized commit prefixes to convey the type of change:

| Prefix | Purpose | Example |
| :--- | :--- | :--- |
| `feat:` | New feature or functional enhancement | `feat: add candidate audio upload endpoint to backend API` |
| `fix:` | Bug fix or issue resolution | `fix: handle edge case in filler word audio segmenter` |
| `ml:` | ML model architecture, feature extractor, or pipeline change | `ml: implement audio acoustic feature extractor using librosa` |
| `docs:` | Documentation update or architecture guide addition | `docs: add multimodal fusion sequence diagram to ARCHITECTURE.md` |
| `refactor:` | Code restructuring without functional behavior changes | `refactor: clean up FastAPI dependency injection for DB session` |

---

## 🚀 Development Roadmap

- [x] **Phase 0: Foundation & Architecture Setup**
  - Monorepo structure, documentation, `.gitignore`, and `.env.example`.
- [ ] **Phase 1: Database Schemas & Data Layer**
  - Define PostgreSQL models (Users, Interviews, Questions, Sessions, Multimodal Transcripts, Scores).
  - Setup Alembic migration baseline.
- [ ] **Phase 2: Modular ML Feature Extraction Pipelines**
  - Textual embeddings (`Sentence Transformers`).
  - Audio transcription (`faster-whisper`) & acoustic signal features (`Librosa`).
  - Visual landmarks (`MediaPipe`) & visual affect/emotion model.
- [ ] **Phase 3: Multimodal Fusion & Scoring Network**
  - PyTorch multimodal fusion model & explainable feedback generator.
- [ ] **Phase 4: Backend FastAPI Services**
  - REST endpoints, audio/video ingestion services, background task workers.
- [ ] **Phase 5: Next.js Frontend Dashboard**
  - Candidate recording interface, real-time feedback visualization, performance analytics dashboard.
