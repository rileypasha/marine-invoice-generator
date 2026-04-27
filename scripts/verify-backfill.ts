import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const totalV = await p.vessel.count();
  const linked = await p.vessel.count({ where: { customerId: { not: null } } });
  const totalC = await p.customer.count();
  const samples = await p.vessel.findMany({
    where: { customerId: { not: null } },
    include: { customer: true },
    take: 5,
    orderBy: { name: 'asc' },
  });
  console.log('Vessels total:', totalV, '| linked:', linked);
  console.log('Customers total:', totalC);
  for (const s of samples) {
    console.log(' -', s.name, '→', s.customer?.display_name, '|', s.customer?.email, '|', s.customer?.city);
  }
  await p.$disconnect();
})();
