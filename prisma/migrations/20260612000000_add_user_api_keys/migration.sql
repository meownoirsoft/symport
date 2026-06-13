CREATE TABLE "UserApiKey" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "provider"     TEXT NOT NULL,
  "encryptedKey" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserApiKey_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UserApiKey"
  ADD CONSTRAINT "UserApiKey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "UserApiKey_userId_provider_key" ON "UserApiKey"("userId", "provider");
