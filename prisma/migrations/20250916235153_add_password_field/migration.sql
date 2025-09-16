/*
  Warnings:

  - You are about to drop the column `hasChanges` on the `Invoice` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN "password" TEXT;

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'saved',
    "data" TEXT NOT NULL,
    "metadata" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "vesselName" TEXT,
    "vesselWeight" REAL,
    "vesselBeam" REAL,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "grossProfit" REAL NOT NULL DEFAULT 0,
    "profitPercent" REAL NOT NULL DEFAULT 0,
    "market" TEXT,
    "notes" TEXT,
    "comments" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("createdAt", "customerEmail", "customerName", "customerPhone", "data", "grossProfit", "id", "invoiceNumber", "market", "metadata", "notes", "profitPercent", "savedAt", "status", "submittedAt", "subtotal", "taxAmount", "title", "total", "updatedAt", "userEmail", "userId", "userName", "vesselBeam", "vesselName", "vesselWeight") SELECT "createdAt", "customerEmail", "customerName", "customerPhone", "data", "grossProfit", "id", "invoiceNumber", "market", "metadata", "notes", "profitPercent", "savedAt", "status", "submittedAt", "subtotal", "taxAmount", "title", "total", "updatedAt", "userEmail", "userId", "userName", "vesselBeam", "vesselName", "vesselWeight" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_status_savedAt_idx" ON "Invoice"("status", "savedAt");
CREATE INDEX "Invoice_userEmail_idx" ON "Invoice"("userEmail");
CREATE INDEX "Invoice_customerName_idx" ON "Invoice"("customerName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_key_key" ON "IdempotencyRecord"("key");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");
