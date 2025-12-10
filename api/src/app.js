// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const breakingNewsRoutes = require('./routes/breakingNewsRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API routes
app.use('/api/breaking-news', breakingNewsRoutes);

// Error handler (last)
app.use(errorHandler);

module.exports = app;
