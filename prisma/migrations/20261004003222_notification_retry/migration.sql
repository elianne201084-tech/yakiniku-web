-- DropIndex
DROP INDEX "Notification_status_createdAt_idx";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Notification_status_nextAttemptAt_idx" ON "Notification"("status", "nextAttemptAt");
