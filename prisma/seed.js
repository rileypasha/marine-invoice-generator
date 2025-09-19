const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create sample customers
  const customers = [
    {
      display_name: 'Marine Group',
      legal_name: 'Marine Group Boat Works LLC',
      email: 'contact@marinegroupbw.com',
      phone: '(555) 123-4567',
      tax_id: 'EIN-123456789',
      address_line1: '123 Harbor Way',
      city: 'Boattown',
      state: 'FL',
      postal_code: '33101',
      country: 'US'
    },
    {
      display_name: 'Ocean Ventures',
      email: 'info@oceanventures.com',
      phone: '(555) 987-6543',
      address_line1: '456 Marina Blvd',
      city: 'Seaside',
      state: 'CA',
      postal_code: '90210'
    },
    {
      display_name: 'Bay Area Yachts',
      legal_name: 'Bay Area Yacht Services Inc.',
      email: 'service@bayareayachts.com',
      phone: '(555) 555-0123',
      tax_id: 'EIN-987654321',
      address_line1: '789 Yacht Club Dr',
      address_line2: 'Suite 200',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94102',
      notes: 'Premium yacht services client'
    },
    {
      display_name: 'Coastal Marine',
      email: 'orders@coastalmarine.net',
      phone: '(555) 246-8135',
      address_line1: '321 Waterfront Ave',
      city: 'Miami',
      state: 'FL',
      postal_code: '33132'
    },
    {
      display_name: 'Deep Blue Charters',
      email: 'booking@deepbluecharters.com',
      phone: '(555) 369-2580',
      address_line1: '654 Charter Way',
      city: 'Key West',
      state: 'FL',
      postal_code: '33040',
      notes: 'Charter boat operator - regular maintenance contracts'
    }
  ];

  for (const customer of customers) {
    const created = await prisma.customer.create({
      data: customer
    });
    console.log(`✅ Created customer: ${created.display_name}`);
  }

  // Create default master user if it doesn't exist
  const masterEmail = 'rpasha@marinegroupbw.com';
  const existingMaster = await prisma.user.findUnique({
    where: { email: masterEmail }
  });

  if (!existingMaster) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('TempPassword123!', 12);

    const master = await prisma.user.create({
      data: {
        email: masterEmail,
        name: 'Master User',
        password: hashedPassword,
        role: 'master'
      }
    });
    console.log(`✅ Created master user: ${master.email}`);
  } else {
    console.log(`✅ Master user already exists: ${masterEmail}`);
  }

  console.log('🎯 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });