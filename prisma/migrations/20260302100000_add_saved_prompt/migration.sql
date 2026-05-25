-- CreateTable
CREATE TABLE IF NOT EXISTS "SavedPrompt" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceConversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPrompt_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SavedPrompt" ADD CONSTRAINT "SavedPrompt_sourceConversationId_fkey" FOREIGN KEY ("sourceConversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
