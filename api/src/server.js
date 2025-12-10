// src/server.js
require('dotenv').config();
const app = require('./app');
const { connectMongo } = require('./config/db');

const PORT = process.env.PORT || 4000;

async function start() {
  await connectMongo();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
