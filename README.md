# 🏛️ CivicLens

> **Civic Issue Intelligence & Response System for NGOs**

CivicLens is a full-stack platform that empowers NGOs to detect, prioritize, and act on real-world civic problems efficiently. Issues submitted via text, images, or PDFs are processed through OCR and NLP pipelines to extract structured data — then scored, geocoded, and visualized on an interactive heatmap for rapid response.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [User Flow](#-user-flow)
- [Project Structure](#-project-structure)
- [API Overview](#-api-overview)
- [Setup Instructions](#-setup-instructions)
- [Future Improvements](#-future-improvements)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

| Module | Description |
|---|---|
| **Authentication** | JWT-based login/signup with role separation (NGO / Volunteer) |
| **OCR Pipeline** | Extracts text from uploaded images and PDFs via Tesseract |
| **NLP Extraction** | Detects issue type, severity, location, and people affected |
| **Priority Scoring** | Ranks issues by urgency using a weighted scoring algorithm |
| **Geocoding** | Converts extracted location strings to lat/lng coordinates |
| **Heatmap Visualization** | Renders issue density on an interactive map (Leaflet) |
| **Batch System** | Each upload creates an isolated dataset for clean analysis |
| **Volunteer Matching** | Matches volunteers to issues based on skill and proximity |
| **Task Assignment** | NGOs assign tasks; volunteers accept or reject via dashboard |
| **History System** | Structured view of all past issues per batch |

---

## 🛠️ Tech Stack

### Frontend
- **React** (Vite) — fast, modular UI
- **Leaflet** — interactive map and heatmap rendering
- **Modular Dashboard** — KPIs, issue tables, task management

### Backend
- **FastAPI** — async REST API framework
- **PostgreSQL** — relational data store with batch isolation
- **SQLAlchemy** — ORM for database interaction

### Services
- **OCR** — Tesseract + Pillow + pdf2image
- **NLP** — Rule-based extraction pipeline (extendable to AI models)
- **Geocoding** — Google Maps API / OpenStreetMap Nominatim
- **Auth** — JWT tokens + bcrypt password hashing

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Frontend (React)                 │
│         Dashboard │ Heatmap │ Tasks │ History        │
└───────────────────────┬─────────────────────────────┘
                        │  REST API (HTTP/JSON)
┌───────────────────────▼─────────────────────────────┐
│                  Backend (FastAPI)                   │
│                                                      │
│  ┌──────┐   ┌──────┐   ┌───────┐   ┌────────────┐  │
│  │ OCR  │ → │ NLP  │ → │ Dedup │ → │  Priority  │  │
│  └──────┘   └──────┘   └───────┘   └─────┬──────┘  │
│                                           │         │
│                                    ┌──────▼──────┐  │
│                                    │  Geocoding  │  │
│                                    └──────┬──────┘  │
└───────────────────────────────────────────┼─────────┘
                                            │
┌───────────────────────────────────────────▼─────────┐
│               PostgreSQL Database                    │
│         (Batch-isolated issue + user data)           │
└─────────────────────────────────────────────────────┘
```

**Data Flow:**
1. User uploads file or text via the frontend
2. Backend routes input through: `OCR → NLP → Dedup → Priority Scoring → Geocoding`
3. Processed, structured data is stored in PostgreSQL under the relevant batch
4. Frontend consumes the API to render KPIs, heatmaps, and task views

---

## 👤 User Flow

### NGO
```
Signup / Login
     ↓
Upload Issue (text / image / PDF)
     ↓
System Processes: OCR → NLP → Score → Geocode
     ↓
Dashboard:  KPIs | Heatmap | Issue List
     ↓
Assign Volunteer to Issue
```

### Volunteer
```
Signup / Login
     ↓
Onboarding: Skills | Location | Availability
     ↓
View Assigned Tasks
     ↓
Accept or Reject Task
```

---

## 📁 Project Structure

```
civiclens/
│
├── app/                        # Backend (FastAPI)
│   ├── api/                    # Route handlers (auth, issues, volunteers, analytics)
│   ├── core/                   # Config, JWT utilities, security helpers
│   ├── models/                 # SQLAlchemy ORM models
│   └── services/               # Business logic
│       ├── ocr_service.py      # Tesseract + pdf2image pipeline
│       ├── nlp_service.py      # Issue extraction (type, severity, location)
│       ├── priority_service.py # Scoring algorithm
│       ├── geocoding_service.py# Location → lat/lng
│       └── matching_service.py # Volunteer matching logic
│
├── frontend/
│   └── src/
│       ├── components/         # Reusable UI components (cards, tables, map)
│       ├── pages/              # Route-level pages (Dashboard, Tasks, History)
│       └── services/           # Axios API clients
│
├── alembic/                    # Database migrations
├── requirements.txt
├── .env.example
└── README.md
```

---

## 🔌 API Overview

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/signup` | Register a new user (NGO or Volunteer) |
| `POST` | `/auth/login` | Authenticate and receive JWT token |

### Issues
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload issue file or text; triggers processing pipeline |
| `GET` | `/issues` | Retrieve all issues for the authenticated NGO |
| `GET` | `/issues/history` | Fetch historical issues grouped by batch |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/analytics/heatmap` | Return geocoded issue data for heatmap rendering |

### Task Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/assign-volunteer` | Assign a volunteer to a specific issue |
| `GET` | `/volunteer/tasks` | Fetch tasks assigned to the authenticated volunteer |
| `PATCH` | `/volunteer/tasks/{id}` | Accept or reject an assigned task |

> All protected endpoints require `Authorization: Bearer <token>` header.

---

## 🚀 Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Tesseract OCR installed on the system

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/civiclens.git
cd civiclens
```

---

### 2. Backend Setup

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your database URL, JWT secret, and geocoding API key
```

**.env.example**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/civiclens
SECRET_KEY=your_jwt_secret_key
GEOCODING_API_KEY=your_api_key
```

```bash
# Run database migrations
alembic upgrade head

# Start the backend server
uvicorn app.main:app --reload
```

API will be available at `http://localhost:8000`
Interactive docs at `http://localhost:8000/docs`

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

Frontend will be available at `http://localhost:5173`

---

## 🔮 Future Improvements

- [ ] **AI-powered NLP** — Replace rule-based extraction with transformer models (e.g., spaCy, BERT)
- [ ] **Real-time updates** — WebSocket integration for live dashboard refresh
- [ ] **Geospatial clustering** — Advanced clustering algorithms for heatmap accuracy
- [ ] **Notification system** — Email/SMS alerts for task assignments and status changes
- [ ] **Containerization** — Docker + Docker Compose for one-command deployment
- [ ] **Cloud deployment** — CI/CD pipeline with deployment to AWS / GCP / Azure

---

## 🤝 Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to your branch: `git push origin feature/your-feature-name`
5. Open a Pull Request against `main`

Please ensure your code follows existing conventions and includes relevant tests where applicable.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  Built to make civic response faster, smarter, and more accountable.
</div>