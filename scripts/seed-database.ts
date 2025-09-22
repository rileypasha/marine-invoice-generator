import bcrypt from 'bcrypt';
import { query } from '../server/config/database';

interface User {
  email: string;
  name: string;
  password: string;
  role: string;
}

const DEFAULT_USERS: User[] = [
  {
    email: 'admin@mginvoices.com',
    name: 'Admin User',
    password: 'AdminPassword123!',
    role: 'admin'
  },
  {
    email: 'user@mginvoices.com',
    name: 'Standard User',
    password: 'UserPassword123!',
    role: 'standard'
  }
];

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // First, check if users already exist
    const existingUsers = await query('SELECT email FROM "User"');
    const existingEmails = existingUsers.rows.map(row => row.email);

    console.log(`📊 Found ${existingUsers.rows.length} existing users in database`);

    for (const user of DEFAULT_USERS) {
      if (existingEmails.includes(user.email)) {
        console.log(`⏭️  User ${user.email} already exists, skipping...`);
        continue;
      }

      console.log(`👤 Creating user: ${user.email}`);

      // Hash the password
      const passwordHash = await bcrypt.hash(user.password, 10);

      // Insert the user
      const result = await query(
        `INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
         RETURNING id, email, name, role`,
        [user.email, user.name, passwordHash, user.role]
      );

      console.log(`✅ Created user: ${result.rows[0].email} (${result.rows[0].role})`);
    }

    // Show final user count
    const finalUsers = await query('SELECT email, name, role, "createdAt" FROM "User" ORDER BY "createdAt"');
    console.log('\n📋 Current users in database:');
    finalUsers.rows.forEach(user => {
      console.log(`   • ${user.email} (${user.role}) - ${user.name}`);
    });

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📝 Login credentials:');
    DEFAULT_USERS.forEach(user => {
      console.log(`   • ${user.email} / ${user.password}`);
    });

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { seedDatabase };