-- Add userId to Document, Conversation, SavedPrompt for per-user data isolation.
-- Existing rows (single user in production) are assigned to the one existing user.

-- Step 1: Add columns as nullable
ALTER TABLE "Document"      ADD COLUMN "userId" TEXT;
ALTER TABLE "Conversation"  ADD COLUMN "userId" TEXT;
ALTER TABLE "SavedPrompt"   ADD COLUMN "userId" TEXT;

-- Step 2: Assign all existing rows to the one existing user
UPDATE "Document"     SET "userId" = (SELECT id FROM "User" LIMIT 1);
UPDATE "Conversation" SET "userId" = (SELECT id FROM "User" LIMIT 1);
UPDATE "SavedPrompt"  SET "userId" = (SELECT id FROM "User" LIMIT 1);

-- Step 3: Make non-nullable
ALTER TABLE "Document"     ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Conversation" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "SavedPrompt"  ALTER COLUMN "userId" SET NOT NULL;

-- Step 4: Foreign key constraints
ALTER TABLE "Document"
  ADD CONSTRAINT "Document_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SavedPrompt"
  ADD CONSTRAINT "SavedPrompt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: Indexes for WHERE "userId" = $1 queries
CREATE INDEX "Document_userId_idx"     ON "Document"("userId");
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");
CREATE INDEX "SavedPrompt_userId_idx"  ON "SavedPrompt"("userId");
