-- Receipts (S3 URL) + ID сообщения в канале админов
ALTER TABLE "Order" ADD COLUMN "receiptUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "channelMessageId" INTEGER;
