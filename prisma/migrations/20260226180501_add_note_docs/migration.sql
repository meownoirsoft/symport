-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "noteText" TEXT,
ALTER COLUMN "imagePath" DROP NOT NULL;
