-- Wiskr: Personas, Conversations, Messages, BranchCards, etc.
-- Requires pgvector extension (migration 20260227000000_add_pgvector).

-- CreateTable Persona
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "modelString" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "description" TEXT,
    "costTier" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable Conversation
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "parentConversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable ConversationContext
CREATE TABLE "ConversationContext" (
    "conversationId" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,

    CONSTRAINT "ConversationContext_pkey" PRIMARY KEY ("conversationId","contextId")
);

-- CreateTable Message
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "personaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(1536),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable CapturedResponse
CREATE TABLE "CapturedResponse" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "addedToContextId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapturedResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable BranchCard
CREATE TABLE "BranchCard" (
    "id" TEXT NOT NULL,
    "sourceConversationId" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "triggerText" TEXT,
    "conversationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable NextQuestion
CREATE TABLE "NextQuestion" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NextQuestion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey Conversation.parentConversationId
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_parentConversationId_fkey" FOREIGN KEY ("parentConversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey ConversationContext
ALTER TABLE "ConversationContext" ADD CONSTRAINT "ConversationContext_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey Message
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey CapturedResponse
ALTER TABLE "CapturedResponse" ADD CONSTRAINT "CapturedResponse_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey BranchCard
ALTER TABLE "BranchCard" ADD CONSTRAINT "BranchCard_sourceConversationId_fkey" FOREIGN KEY ("sourceConversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchCard" ADD CONSTRAINT "BranchCard_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BranchCard" ADD CONSTRAINT "BranchCard_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey NextQuestion
ALTER TABLE "NextQuestion" ADD CONSTRAINT "NextQuestion_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
