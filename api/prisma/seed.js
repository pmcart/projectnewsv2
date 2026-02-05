// Load the Prisma client from the config (Prisma 7 way)
const prisma = require('../src/config/prisma');
const bcrypt = require('bcryptjs');

async function main() {
  // Refuse to seed in production to prevent test accounts with weak passwords
  if (process.env.NODE_ENV === 'production') {
    console.error('Seeding is disabled in production. Aborting.');
    process.exit(1);
  }

  console.log('🌱 Seeding database...\n');

  // Create test organizations
  console.log('📁 Creating organizations...');
  const organizations = [
    { name: 'Demo', slug: 'demo' },
    { name: 'DemoAlt', slug: 'demo-alt' },
  ];

  const createdOrgs = {};
  for (const org of organizations) {
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: org.slug },
    });

    if (existingOrg) {
      console.log(`⏭️  Organization "${org.name}" already exists`);
      createdOrgs[org.slug] = existingOrg;
    } else {
      const created = await prisma.organization.create({ data: org });
      console.log(`✅ Created organization: ${org.name}`);
      createdOrgs[org.slug] = created;
    }
  }

  // Create test users with different roles and organizations
  console.log('\n👥 Creating users...');
  const users = [
    {
      email: 'superadmin@demo.com',
      password: await bcrypt.hash('password123', 10),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'EDITOR',
      isActive: true,
      isSuperAdmin: true,
      organizationId: createdOrgs['demo'].id,
    },
    {
      email: 'admin@demo.com',
      password: await bcrypt.hash('password123', 10),
      firstName: 'Admin',
      lastName: 'User',
      role: 'EDITOR',
      isActive: true,
      organizationId: createdOrgs['demo'].id,
    },
    {
      email: 'writer@demo.com',
      password: await bcrypt.hash('password123', 10),
      firstName: 'Writer',
      lastName: 'User',
      role: 'WRITER',
      isActive: true,
      organizationId: createdOrgs['demo'].id,
    },
    {
      email: 'reader@demo.com',
      password: await bcrypt.hash('password123', 10),
      firstName: 'Reader',
      lastName: 'User',
      role: 'READER',
      isActive: true,
      organizationId: createdOrgs['demo'].id,
    },
    {
      email: 'admin@demo-alt.com',
      password: await bcrypt.hash('password123', 10),
      firstName: 'Alt',
      lastName: 'Admin',
      role: 'EDITOR',
      isActive: true,
      organizationId: createdOrgs['demo-alt'].id,
    },
  ];

  for (const user of users) {
    const existingUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (existingUser) {
      console.log(`⏭️  User ${user.email} already exists, updating organization...`);
      await prisma.user.update({
        where: { email: user.email },
        data: { organizationId: user.organizationId },
      });
    } else {
      await prisma.user.create({ data: user });
      console.log(`✅ Created user: ${user.email} (${user.role})`);
    }
  }

  console.log('\n📋 Test Data Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ORGANIZATIONS:');
  console.log('  • Demo (demo)');
  console.log('  • DemoAlt (demo-alt)');
  console.log('\nUSERS:');
  console.log('  Email: superadmin@demo.com | Password: password123 | Role: EDITOR | Org: Demo | SuperAdmin: Yes');
  console.log('  Email: admin@demo.com      | Password: password123 | Role: EDITOR | Org: Demo');
  console.log('  Email: writer@demo.com     | Password: password123 | Role: WRITER | Org: Demo');
  console.log('  Email: reader@demo.com     | Password: password123 | Role: READER | Org: Demo');
  console.log('  Email: admin@demo-alt.com  | Password: password123 | Role: EDITOR | Org: DemoAlt');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✨ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
