# Wiskr setup (Symport + Chat)

Wiskr adds multi-model chat on top of Symport. It uses **pgvector** for semantic search and **OpenRouter** for model routing.

## 1. PostgreSQL with pgvector

The app expects the `vector` extension. Easiest: use the pgvector image in Docker:

- `docker-compose.yml` is set to use `pgvector/pgvector:pg16`. Run:
  - `docker compose down` (if you had Postgres running)
  - `docker compose up -d`
  - Then run migrations (see below).

If you hit a failed migration from before (e.g. "extension vector is not available"):

- Either start fresh: drop the DB and run `npx prisma migrate dev` again.
- Or mark the failed migration as rolled back:  
  `npx prisma migrate resolve --rolled-back 20260227000000_add_pgvector`  
  then install pgvector in your Postgres and run `npx prisma migrate deploy`.

## 2. Run migrations

```bash
npx prisma migrate deploy
# or for dev (creates shadow DB):
npx prisma migrate dev
```

## 3. Seed personas

Personas (Spark, Prism, etc.) are stored in the DB. Seed them once:

```bash
npm run db:seed
```

## 4. Environment

- **OpenRouter (Wiskr chat):** set `OPENROUTER_API_KEY`. Get a key at [openrouter.ai](https://openrouter.ai).
- **Embeddings (semantic search):** existing `OPENAI_API_KEY` is used for document embeddings (text-embedding-3-small).

## 5. Optional: backfill document embeddings

After pgvector is enabled, existing documents can get embeddings for semantic search:

```bash
# POST (e.g. with curl):
curl -X POST http://localhost:3000/api/admin/backfill-embeddings
```

Then use semantic search on the documents API: `GET /api/documents?q=...&semantic=1`.

## Routes

- **Chat UI:** `/chat` — list conversations, create one, send messages with a chosen persona.
- **APIs:**  
  - `GET/POST /api/wiskr/conversations`  
  - `GET/PATCH /api/wiskr/conversations/[id]`  
  - `GET/POST /api/wiskr/conversations/[id]/messages`  
  - `GET /api/wiskr/personas`
