/*
  Warnings:

  - You are about to drop the column `changeNotes` on the `InvoiceRevision` table. All the data in the column will be lost.
  - You are about to drop the column `changedAt` on the `InvoiceRevision` table. All the data in the column will be lost.
  - You are about to drop the column `changedBy` on the `InvoiceRevision` table. All the data in the column will be lost.
  - You are about to drop the column `data` on the `InvoiceRevision` table. All the data in the column will be lost.
  - You are about to drop the column `version` on the `InvoiceRevision` table. All the data in the column will be lost.
  - Added the required column `actorEmail` to the `InvoiceRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payloadJson` to the `InvoiceRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `revisionNumber` to the `InvoiceRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payloadJson` to the `InvoiceSubmission` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "MasterChangeView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "latestRevisionId" TEXT NOT NULL,
    "masterEmail" TEXT NOT NULL,
    "seenAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MasterChangeView_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MasterChangeView_latestRevisionId_fkey" FOREIGN KEY ("latestRevisionId") REFERENCES "InvoiceRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InvoiceRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "changeSummary" TEXT,
    "payloadJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceRevision_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceRevision" ("id", "invoiceId") SELECT "id", "invoiceId" FROM "InvoiceRevision";
DROP TABLE "InvoiceRevision";
ALTER TABLE "new_InvoiceRevision" RENAME TO "InvoiceRevision";
CREATE INDEX "InvoiceRevision_invoiceId_createdAt_idx" ON "InvoiceRevision"("invoiceId", "createdAt" DESC);
CREATE TABLE "new_InvoiceSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "payloadJson" JSONB NOT NULL,
    CONSTRAINT "InvoiceSubmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceSubmission" ("id", "invoiceId", "notes", "status", "submittedAt", "submittedBy") SELECT "id", "invoiceId", "notes", "status", "submittedAt", "submittedBy" FROM "InvoiceSubmission";
DROP TABLE "InvoiceSubmission";
ALTER TABLE "new_InvoiceSubmission" RENAME TO "InvoiceSubmission";
CREATE UNIQUE INDEX "InvoiceSubmission_invoiceId_key" ON "InvoiceSubmission"("invoiceId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'standard',
    "apiKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("apiKey", "createdAt", "email", "id", "name", "role", "updatedAt") SELECT "apiKey", "createdAt", "email", "id", "name", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MasterChangeView_invoiceId_idx" ON "MasterChangeView"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterChangeView_invoiceId_latestRevisionId_masterEmail_key" ON "MasterChangeView"("invoiceId", "latestRevisionId", "masterEmail");
