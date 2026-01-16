// Load the Prisma client from the config (Prisma 7 way)
const prisma = require('../src/config/prisma');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('🌱 Seeding database...\n');

  // Create test organizations
  console.log('📁 Creating organizations...');
  const organizations = [
    { name: 'Acme Corporation', slug: 'acme-corp' },
    { name: 'Tech Innovators', slug: 'tech-innovators' },
    { name: 'Global News Network', slug: 'global-news' },
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
      email: 'admin@test.com',
      password: await bcrypt.hash('password123', 10),
      firstName: 'Admin',
      lastName: 'User',
      role: 'EDITOR',
      isActive: true,
      organizationId: createdOrgs['acme-corp'].id,
    },
    {
      email: 'writer@test.com',
      password: await bcrypt.hash('password123', 10),
      firstName: 'Writer',
      lastName: 'User',
      role: 'WRITER',
      isActive: true,
      organizationId: createdOrgs['tech-innovators'].id,
    },
    {
      email: 'reader@test.com',
      password: await bcrypt.hash('password123', 10),
      firstName: 'Reader',
      lastName: 'User',
      role: 'READER',
      isActive: true,
      organizationId: createdOrgs['global-news'].id,
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
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ORGANIZATIONS:');
  console.log('  • Acme Corporation (acme-corp)');
  console.log('  • Tech Innovators (tech-innovators)');
  console.log('  • Global News Network (global-news)');
  console.log('\nUSERS:');
  console.log('  Email: admin@test.com   | Password: password123 | Role: EDITOR | Org: Acme Corporation');
  console.log('  Email: writer@test.com  | Password: password123 | Role: WRITER | Org: Tech Innovators');
  console.log('  Email: reader@test.com  | Password: password123 | Role: READER | Org: Global News Network');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
