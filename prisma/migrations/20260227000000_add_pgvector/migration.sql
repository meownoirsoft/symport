-- Enable pgvector for semantic search (Wiskr / Symport)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column for document semantic search (1536 = OpenAI text-embedding-3-small)
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
