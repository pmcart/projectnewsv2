/**
 * Complete Database Setup Script
 *
 * This script performs all database setup steps in order:
 * 1. Creates the PostgreSQL database (if it doesn't exist)
 * 2. Runs Prisma migrations to create tables
 * 3. Seeds the database with test data
 *
 * Usage: node setup-all.js
 */

const { Client } = require('pg');
const { execSync } = require('child_process');
require('dotenv').config();

async function createDatabase() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('STEP 1: Creating PostgreSQL Database');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error('DATABASE_URL not found in .env file');
  }

  const url = new URL(dbUrl);
  const targetDatabase = url.pathname.slice(1).split('?')[0];

  const config = {
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    user: url.username,
    password: url.password,
    database: 'postgres',
  };

  console.log(`Connecting to PostgreSQL at ${url.hostname}:${config.port}...`);

  const client = new Client(config);

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully!\n');

    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDatabase]
    );

    if (result.rows.length === 0) {
      console.log(`Creating database '${targetDatabase}'...`);
      await client.query(`CREATE DATABASE "${targetDatabase}"`);
      console.log(`Database '${targetDatabase}' created successfully!\n`);
    } else {
      console.log(`Database '${targetDatabase}' already exists\n`);
    }

    await client.end();
    return true;
  } catch (error) {
    await client.end().catch(() => {});
    throw new Error(`Database creation failed: ${error.message}`);
  }
}

function runMigrations() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('STEP 2: Running Prisma Migrations');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Use migrate deploy for non-interactive migration (suitable for scripts)
    console.log('Applying database migrations...\n');
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      cwd: __dirname
    });

    console.log('\nGenerating Prisma client...\n');
    execSync('npx prisma generate', {
      stdio: 'inherit',
      cwd: __dirname
    });

    console.log('\nMigrations applied successfully!\n');
    return true;
  } catch (error) {
    throw new Error(`Migration failed: ${error.message}`);
  }
}

async function seedDatabase() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('STEP 3: Seeding Database');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Clear require cache to ensure fresh Prisma client after generation
    Object.keys(require.cache).forEach(key => {
      if (key.includes('prisma') || key.includes('@prisma')) {
        delete require.cache[key];
      }
    });

    const prisma = require('./src/config/prisma');
    const bcrypt = require('bcryptjs');

    console.log('Creating organizations...');
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
        console.log(`  Organization "${org.name}" already exists`);
        createdOrgs[org.slug] = existingOrg;
      } else {
        const created = await prisma.organization.create({ data: org });
        console.log(`  Created organization: ${org.name}`);
        createdOrgs[org.slug] = created;
      }
    }

    console.log('\nCreating users...');
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
        console.log(`  User ${user.email} already exists, updating organization...`);
        await prisma.user.update({
          where: { email: user.email },
          data: { organizationId: user.organizationId },
        });
      } else {
        await prisma.user.create({ data: user });
        console.log(`  Created user: ${user.email} (${user.role})`);
      }
    }

    await prisma.$disconnect();
    console.log('\nSeeding complete!\n');
    return true;
  } catch (error) {
    throw new Error(`Seeding failed: ${error.message}`);
  }
}

async function main() {
  console.log('\n');
  console.log('###############################################################');
  console.log('#                                                             #');
  console.log('#           PROJECT NEWS - DATABASE SETUP SCRIPT              #');
  console.log('#                                                             #');
  console.log('###############################################################');
  console.log('\n');

  try {
    // Step 1: Create database
    await createDatabase();

    // Step 2: Run migrations
    runMigrations();

    // Step 3: Seed database
    await seedDatabase();

    // Success summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SETUP COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Database is ready with the following test data:\n');
    console.log('ORGANIZATIONS:');
    console.log('  - Demo (demo)');
    console.log('  - DemoAlt (demo-alt)\n');
    console.log('TEST USERS:');
    console.log('  ┌──────────────────────┬──────────────┬─────────┬─────────┬────────────┐');
    console.log('  │ Email                │ Password     │ Role    │ Org     │ SuperAdmin │');
    console.log('  ├──────────────────────┼──────────────┼─────────┼─────────┼────────────┤');
    console.log('  │ superadmin@demo.com  │ password123  │ EDITOR  │ Demo    │ Yes        │');
    console.log('  │ admin@demo.com       │ password123  │ EDITOR  │ Demo    │ No         │');
    console.log('  │ writer@demo.com      │ password123  │ WRITER  │ Demo    │ No         │');
    console.log('  │ reader@demo.com      │ password123  │ READER  │ Demo    │ No         │');
    console.log('  │ admin@demo-alt.com   │ password123  │ EDITOR  │ DemoAlt │ No         │');
    console.log('  └──────────────────────┴──────────────┴─────────┴─────────┴────────────┘\n');
    console.log('You can now start the API with: npm run dev\n');

  } catch (error) {
    console.error('\n');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('SETUP FAILED');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error(`\nError: ${error.message}\n`);
    console.error('Troubleshooting tips:');
    console.error('  1. Ensure PostgreSQL is running');
    console.error('  2. Check DATABASE_URL in your .env file');
    console.error('  3. Verify your PostgreSQL credentials have CREATE DATABASE permission\n');
    process.exit(1);
  }
}

main();
