#!/usr/bin/env node
/**
 * One-time migration: Fix line items with missing or zero quantity
 *
 * Old invoices created before the quantity feature have no quantity field
 * (undefined) on their line items. This script sets those to quantity=1
 * so the table shows the correct item count.
 *
 * Usage:
 *   npx ts-node scripts/fix-zero-quantities.ts          # Dry run (preview)
 *   npx ts-node scripts/fix-zero-quantities.ts --apply   # Apply changes
 */

import '../server/env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');

  console.log(apply
    ? '⚠️  APPLY MODE — will update the database'
    : '🔍 DRY RUN — no changes will be made (use --apply to commit)');

  const invoices = await prisma.invoice.findMany({
    select: { id: true, invoiceNumber: true, data: true },
  });

  console.log(`\nFound ${invoices.length} total invoices.\n`);

  let updatedCount = 0;
  let lineItemsFixed = 0;

  for (const inv of invoices) {
    let parsed: any;
    try {
      parsed = typeof inv.data === 'string' ? JSON.parse(inv.data) : inv.data;
    } catch {
      console.log(`  ⚠ ${inv.invoiceNumber || inv.id}: could not parse data JSON — skipping`);
      continue;
    }

    const lineItems: any[] = parsed?.scope?.lineItems;
    if (!Array.isArray(lineItems) || lineItems.length === 0) continue;

    let changed = false;
    for (const item of lineItems) {
      if (item._deleted) continue; // skip soft-deleted items
      const qty = Number(item.quantity);
      if (item.quantity === undefined || item.quantity === null || qty === 0 || isNaN(qty)) {
        item.quantity = 1;
        changed = true;
        lineItemsFixed++;
      }
    }

    if (!changed) continue;

    updatedCount++;
    const newTotal = lineItems.filter((i: any) => !i._deleted).reduce((s: number, i: any) => s + Number(i.quantity), 0);
    console.log(`  ✓ ${inv.invoiceNumber || inv.id}: ${lineItems.length} items → total qty ${newTotal}`);

    if (apply) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { data: JSON.stringify(parsed) },
      });
    }
  }

  console.log(`\n${updatedCount} invoice(s) affected, ${lineItemsFixed} line item(s) fixed.`);
  if (!apply && updatedCount > 0) {
    console.log('💡 Run with --apply to save these changes.');
  }
  if (apply && updatedCount > 0) {
    console.log('🎉 Done — changes saved to the database.');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
