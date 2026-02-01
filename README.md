# Credit Card API

A full-stack application for managing and searching credit card information with automatic scraping from WalletHub.

## Architecture

```
Credit Card API/
├── backend/          # Express.js API (Firebase Functions)
├── frontend/         # React + Vite + Tailwind CSS
├── scraper/          # WalletHub scraper (Docker + Puppeteer)
├── firebase.json     # Firebase configuration
└── Data/             # Local data storage (gitignored)
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Backend | 8001 | REST API for credit card data |
| Frontend | 5173 | React web application |
| Scraper | 8002 | WalletHub credit card scraper |

## Prerequisites

- Node.js 20+
- Docker (for scraper)
- Firebase CLI (`npm install -g firebase-tools`)

## Quick Start

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

The API will be available at `http://localhost:8001`

**Endpoints:**
- `GET /api/health` - Health check
- `GET /api/cards` - List all cards
- `GET /api/cards/search?q=...` - Search cards (auto-scrapes if no match)
- `GET /api/cards/:id` - Get card by ID
- `POST /api/cards/:id/refresh` - Refresh card data from WalletHub

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

### 3. Scraper (Docker)

```bash
cd scraper
docker-compose up -d
```

The scraper will be available at `http://localhost:8002`

**Endpoints:**
- `GET /v1/health` - Health check
- `GET /v1/scrape/search?q=...` - Search WalletHub for cards
- `POST /v1/scrape/card` - Scrape single card by URL
- `POST /v1/scrape/bulk` - Bulk scrape from category page

**Authentication:** Include `X-API-Key: dev-scraper-key-change-in-production` header

## Environment Variables

### Backend (`backend/.env`)
```
PORT=8001
NODE_ENV=development
```

### Scraper (`scraper/.env`)
```
PORT=8002
NODE_ENV=development
SCRAPER_API_KEY=dev-scraper-key-change-in-production
FIREBASE_PROJECT_ID=credit-card-api-app
FIREBASE_STORAGE_BUCKET=credit-card-api-images
BACKEND_URL=http://localhost:8001
```

## Firebase Setup

1. Create a Firebase project
2. Enable Firestore and Storage
3. Download service account key to `backend/serviceAccountKey.json` and `scraper/serviceAccountKey.json`
4. Deploy:
   ```bash
   firebase deploy
   ```

## Development

Run all services in separate terminals:

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev

# Terminal 3 - Scraper
cd scraper && docker-compose up
```

## Deployment

The project uses GitHub Actions for CI/CD. Push to `main` to deploy:
- Backend deploys to Firebase Functions
- Frontend deploys to Firebase Hosting
- Scraper deploys to Cloud Run (with Docker)

## Features

- Search credit cards from local database
- Auto-scrape WalletHub when no exact match found
- Manual refresh to update card data
- Image upload to Firebase Storage
- Smart matching algorithm for search results

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Firebase Admin SDK
- **Frontend:** React 19, Vite, Tailwind CSS, TypeScript
- **Scraper:** Node.js, Puppeteer, Cheerio, Docker
- **Database:** Firestore
- **Storage:** Firebase Storage
- **Deployment:** Firebase Functions, Firebase Hosting, Cloud Run
