/**
 * Backfill Vessel + Customer records from the combined spreadsheet.
 *
 * For each row:
 *   - "Customer" column = vessel name = customer.display_name (per QuickBooks convention)
 *   - "Bill to 1" = customer.legal_name (the billing entity)
 *   - "Main Email" = customer.email
 *   - "Main Phone" = customer.phone
 *   - "Street1/Street2/City/State/Zip/Country" = address fields
 *   - Vessel.customerId is linked to the upserted customer.
 *
 * Run with: npx ts-node --project tsconfig.server.json scripts/backfill-vessels-customers.ts [--dry]
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface Row {
  Customer?: string | null;
  'Bill to 1'?: string | null;
  'Bill to 2'?: string | null;
  'Bill to 3'?: string | null;
  'Bill to 4'?: string | null;
  'Bill to 5'?: string | null;
  'Bill to'?: string | null;
  'Main Email'?: string | null;
  Company?: string | null;
  'First Name'?: string | null;
  'Last Name'?: string | null;
  'Main Phone'?: string | null;
  Street1?: string | null;
  Street2?: string | null;
  City?: string | null;
  State?: string | null;
  Zip?: string | null;
  Country?: string | null;
}

const dryRun = process.argv.includes('--dry');

const trimOrNull = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
};

async function pickOwnerUserId(): Promise<string> {
  // Prefer an existing master user; fall back to the first user we find.
  const master = await prisma.user.findFirst({
    where: { role: 'master' },
    select: { id: true, email: true },
  });
  if (master) {
    console.log(`Owner user (master): ${master.email} ${master.id}`);
    return master.id;
  }
  const any = await prisma.user.findFirst({ select: { id: true, email: true } });
  if (!any) throw new Error('No users in database — cannot create vessels (User FK is required).');
  console.log(`Owner user (fallback): ${any.email} ${any.id}`);
  return any.id;
}

async function upsertCustomer(row: Row, displayName: string): Promise<string> {
  const data = {
    legal_name: trimOrNull(row['Bill to 1']),
    email: trimOrNull(row['Main Email']),
    phone: trimOrNull(row['Main Phone']),
    address_line1: trimOrNull(row.Street1),
    address_line2: trimOrNull(row.Street2),
    city: trimOrNull(row.City),
    state: trimOrNull(row.State),
    postal_code: trimOrNull(row.Zip),
    country: trimOrNull(row.Country) ?? 'US',
  };

  const existing = await prisma.customer.findUnique({ where: { display_name: displayName } });
  if (existing) {
    if (dryRun) {
      console.log(`  [dry] would update customer ${existing.id} (${displayName})`);
      return existing.id;
    }
    await prisma.customer.update({
      where: { id: existing.id },
      data: { ...data, updated_at: new Date() },
    });
    return existing.id;
  }
  if (dryRun) {
    console.log(`  [dry] would create customer (${displayName})`);
    return 'dry-run-id';
  }
  const created = await prisma.customer.create({
    data: {
      id: randomUUID(),
      display_name: displayName,
      ...data,
      updated_at: new Date(),
    },
  });
  return created.id;
}

async function upsertVessel(name: string, customerId: string, ownerUserId: string): Promise<string> {
  // Vessels are shared but FK to a user. Match by name (the spreadsheet has unique vessel names).
  const existing = await prisma.vessel.findFirst({
    where: { name },
    select: { id: true, customerId: true },
  });
  if (existing) {
    if (existing.customerId === customerId) return existing.id;
    if (dryRun) {
      console.log(`  [dry] would link vessel ${existing.id} → customer ${customerId}`);
      return existing.id;
    }
    await prisma.vessel.update({ where: { id: existing.id }, data: { customerId } });
    return existing.id;
  }
  if (dryRun) {
    console.log(`  [dry] would create vessel "${name}" → customer ${customerId}`);
    return 'dry-run-id';
  }
  const created = await prisma.vessel.create({
    data: {
      id: randomUUID(),
      userId: ownerUserId,
      name,
      customerId,
    },
  });
  return created.id;
}

async function main() {
  const jsonPath = path.resolve(__dirname, 'vessels-contacts.json');
  const rows: Row[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`Loaded ${rows.length} rows from ${jsonPath}${dryRun ? ' (dry run)' : ''}`);

  const ownerUserId = await pickOwnerUserId();

  let processed = 0;
  let skipped = 0;
  for (const row of rows) {
    const vesselName = trimOrNull(row.Customer);
    if (!vesselName) {
      skipped++;
      continue;
    }
    console.log(`Processing: ${vesselName}`);
    const customerId = await upsertCustomer(row, vesselName);
    await upsertVessel(vesselName, customerId, ownerUserId);
    processed++;
  }

  console.log(`Done. Processed: ${processed}, skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
