import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stmts = [
    `ALTER TABLE "Vessel" ADD COLUMN IF NOT EXISTS "customerId" TEXT`,
    `CREATE INDEX IF NOT EXISTS "Vessel_customerId_idx" ON "Vessel"("customerId")`,
    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_constraint WHERE conname = 'Vessel_customerId_fkey'
       ) THEN
         ALTER TABLE "Vessel"
         ADD CONSTRAINT "Vessel_customerId_fkey"
         FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
         ON DELETE SET NULL ON UPDATE CASCADE;
       END IF;
     END $$`,
  ];

  for (const sql of stmts) {
    process.stdout.write(`Applying: ${sql.split('\n')[0].trim()} ... `);
    await prisma.$executeRawUnsafe(sql);
    console.log('ok');
  }

  const sample = await prisma.$queryRawUnsafe<any[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Vessel' AND column_name = 'customerId'`
  );
  console.log('Verify column exists:', sample);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
