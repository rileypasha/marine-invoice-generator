-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'saved',
    "data" TEXT NOT NULL,
    "metadata" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "vesselName" TEXT,
    "vesselWeight" DOUBLE PRECISION,
    "vesselBeam" DOUBLE PRECISION,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "customerLine1" TEXT,
    "customerLine2" TEXT,
    "customerCity" TEXT,
    "customerState" TEXT,
    "customerPostal" TEXT,
    "customerCountry" TEXT,
    "customerLat" DOUBLE PRECISION,
    "customerLon" DOUBLE PRECISION,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "market" TEXT,
    "notes" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvoiceSubmission" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "payloadJson" JSONB NOT NULL,

    CONSTRAINT "InvoiceSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvoiceRevision" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "changeSummary" TEXT,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MasterChangeView" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "latestRevisionId" TEXT NOT NULL,
    "masterEmail" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterChangeView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'standard',
    "apiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_status_savedAt_idx" ON "public"."Invoice"("status", "savedAt");

-- CreateIndex
CREATE INDEX "Invoice_userEmail_idx" ON "public"."Invoice"("userEmail");

-- CreateIndex
CREATE INDEX "Invoice_customerName_idx" ON "public"."Invoice"("customerName");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSubmission_invoiceId_key" ON "public"."InvoiceSubmission"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceRevision_invoiceId_createdAt_idx" ON "public"."InvoiceRevision"("invoiceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MasterChangeView_invoiceId_idx" ON "public"."MasterChangeView"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterChangeView_invoiceId_latestRevisionId_masterEmail_key" ON "public"."MasterChangeView"("invoiceId", "latestRevisionId", "masterEmail");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_apiKey_key" ON "public"."User"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_key_key" ON "public"."IdempotencyRecord"("key");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "public"."IdempotencyRecord"("expiresAt");

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceSubmission" ADD CONSTRAINT "InvoiceSubmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceRevision" ADD CONSTRAINT "InvoiceRevision_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MasterChangeView" ADD CONSTRAINT "MasterChangeView_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MasterChangeView" ADD CONSTRAINT "MasterChangeView_latestRevisionId_fkey" FOREIGN KEY ("latestRevisionId") REFERENCES "public"."InvoiceRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
