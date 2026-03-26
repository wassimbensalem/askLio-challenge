# Procurement Intake System

A full-stack web application that automates enterprise procurement requests. Employees upload a vendor PDF quote, AI extracts all fields automatically, and the procurement team tracks requests through an audit-ready workflow.

## Features

- **PDF extraction** — upload a vendor quote and GPT-4o fills in all form fields automatically
- **AI commodity classification** — automatically classifies the commodity group from 50 categories
- **AI procurement agent** — reviews requests end-to-end: validates fields, checks policy thresholds, researches vendor legitimacy, and produces a recommendation for the procurement manager
- **Audit trail** — every status change is recorded with a timestamp
- **Status workflow** — Open → In Progress → Closed with full history

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy |
| Database | SQLite (swappable to PostgreSQL via `DATABASE_URL`) |
| AI | OpenAI GPT-4o |
| Frontend | React, Vite, Tailwind CSS |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key

### Backend

```bash
pip install -r requirements.txt
cp .env.example .env          # add your OPENAI_API_KEY
uvicorn backend.main:app --reload --port 8002
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173**

### Docker

```bash
cp .env.example .env          # add your OPENAI_API_KEY
docker-compose up --build
```

## API

| Method | Route | Description |
|---|---|---|
| `POST` | `/extract` | Upload PDF → returns extracted fields (does not save) |
| `POST` | `/requests` | Submit completed form → saves to DB |
| `GET` | `/requests` | Fetch all requests |
| `PATCH` | `/requests/{id}/status` | Update request status |
| `POST` | `/requests/{id}/agent` | Run AI procurement agent (SSE stream) |

## Running Tests

```bash
python -m pytest
```
