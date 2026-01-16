require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Create a singleton instance of Prisma Client
// This ensures we reuse the same database connection across the app
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({ adapter });
} else {
  // In development, use a global variable to preserve the instance across hot-reloads
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      adapter,
      log: ['error', 'warn'],
    });
  }
  prisma = global.prisma;
}

module.exports = prisma;
