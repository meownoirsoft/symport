# Symport

Capture paper. Extract data. Search and export.

Mobile-first web app: capture documents (camera or file), AI extracts structured JSON, search and tag status, export JSON.

## Setup

1. **Dependencies**
   ```bash
   npm install
   ```

2. **Database** (choose one)
   - **Docker (recommended):** `npm run docker:up` (Postgres on port 5433). If 5433 is in use, edit `docker-compose.yml` to use another port and set `DATABASE_URL` in `.env` accordingly.
   - **Existing Postgres:** Create a database and user, set `DATABASE_URL` in `.env`.

3. **Env**
   ```bash
   cp .env.example .env
   ```
   Set `DATABASE_URL`. For AI extraction set `OPENAI_API_KEY` (optional for MVP — documents are stored with a placeholder extraction if unset).

4. **Migrations**
   ```bash
   npm run db:migrate
   ```
   If you use `db:push` instead, run `npm run db:push` to create tables without migration history.

5. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000). Use **Capture** to add a document, **View documents** to search and open details. On a phone, open the same URL for camera-first capture.

## Scripts

- `npm run dev` — Next.js dev server
- `npm run build` / `npm run start` — Production
- `npm run db:generate` — Generate Prisma client
- `npm run db:migrate` — Run migrations (DB must be up)
- `npm run db:push` — Push schema without migrations
- `npm run docker:up` — Start Postgres in Docker

## MVP

- Capture: mobile camera or file upload
- Extract: OpenAI GPT-4o vision → JSON (rx_receipt, eob, utility_bill, general)
- Document list with full-text search
- Status tagging (pending, paid, submitted, etc.)
- JSON export per document

Design: [docs/paperless-brain-design-doc.md](docs/paperless-brain-design-doc.md).
