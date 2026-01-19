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
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/breaking-news', breakingNewsRoutes);
app.use('/api/rss', require('./routes/rssFeedRoutes'));
app.use('/api/jobs', require('./routes/jobsRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));

// Error handler (last)
app.use(errorHandler);

module.exports = app;
