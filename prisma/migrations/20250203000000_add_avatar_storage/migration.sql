ALTER TABLE "User"
  ADD COLUMN "avatarData" BYTEA,
  ADD COLUMN "avatarMimeType" TEXT,
  ADD COLUMN "avatarUpdatedAt" TIMESTAMPTZ;
