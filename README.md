# Peblo AI Notes Workspace

A lightweight full-stack notes workspace for the Peblo take-home challenge. It includes authentication, note management, tags, search, public sharing, AI summaries, action items and productivity insights.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: SQLite with `better-sqlite3`
- Auth: JWT + bcrypt password hashing
- AI: Groq Chat Completions when `GROQ_API_KEY` is set, with a local fallback for demos

## Features

- Signup, login and persistent sessions
- Protected notes workspace
- Create, edit, autosave and archive notes
- Tags, categories, keyword search and tag filtering
- AI summary, action item extraction and suggested title
- Public share links for notes
- Dashboard with total notes, archived notes, top tags, AI usage and weekly activity

## Setup

Use Node.js 22 or run the version in `.nvmrc`.

```bash
nvm use
npm install
cp .env.example .env
npm run dev
```

If you switch Node versions after installing dependencies, rebuild the native SQLite package:

```bash
npm rebuild better-sqlite3
```

Frontend runs on `http://localhost:5173`.
Backend runs on `http://localhost:4000`.

## Environment Variables

```bash
PORT=4000
CLIENT_URL=http://localhost:5173
DATABASE_URL=./data/peblo.sqlite
JWT_SECRET=change-this-in-production
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
```

`GROQ_API_KEY` is optional. Without it, the app uses a deterministic local summarizer so the AI workflow remains demoable from a clean clone.

## Production Build

```bash
npm run build
npm start
```

The Express server serves the built frontend from `dist`.

## Deploy on Render

This repo includes `render.yaml` and a `Dockerfile` for a single Render web service.

1. Push the repo to GitHub.
2. In Render, choose **New** -> **Blueprint**.
3. Select the GitHub repo.
4. Render will create one free web service.
5. Add `GROQ_API_KEY` in the Render environment variables.
6. Deploy.

Render sets `JWT_SECRET` automatically from `render.yaml`. The app serves both frontend and backend from the same URL, so no production `VITE_API_URL` is required.

On Render free plan, SQLite data is stored at `/tmp/peblo.sqlite`, so demo data can reset when the service restarts. For persistent data, upgrade the Render service and add a persistent disk, then set `DATABASE_URL=/app/data/peblo.sqlite`.

For manual deployment instead of Blueprint:

```bash
docker build -t peblo-ai-notes .
docker run -p 4000:4000 --env-file .env -v peblo-notes-data:/app/data peblo-ai-notes
```

## Test

```bash
npm test
npm run smoke
```

Run `npm start` in another terminal before `npm run smoke`.

## API Overview

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/notes`
- `POST /api/notes`
- `PATCH /api/notes/:id`
- `POST /api/notes/:id/generate-summary`
- `POST /api/notes/:id/share`
- `GET /api/shared/:shareId`
- `GET /api/insights`

## Architecture Notes

The backend keeps business logic split into focused modules:

- `server/auth.js` handles users, password hashing and JWT validation.
- `server/db.js` owns the SQLite schema and connection.
- `server/notes.js` handles note parsing, tag normalization and activity logging.
- `server/ai.js` wraps AI generation and fallback behavior.
- `server/index.js` exposes the API routes and serves the frontend build.

SQLite stores users, notes and activity events. Note tags and action items are stored as JSON text so the schema stays simple while still being easy to evolve into relational tables later.

## Requirement Checklist

- Authentication: signup, login, JWT-protected APIs, persistent local session, bcrypt password hashing
- Notes workspace: create, edit, autosave, tags, categories and archive
- AI integration: Groq-powered summary, action items and suggested title
- Search and filtering: keyword search, tag filter and recent-first sorting
- Public sharing: public link generation, public read page and private/public visibility handling
- Productivity insights: total notes, recently edited notes, most-used tags, AI usage and weekly activity

## Demo Video Checklist

Record a 5-10 minute walkthrough covering:


## Sample Outputs

Supporting examples are in [`samples/sample-outputs.md`](samples/sample-outputs.md).
