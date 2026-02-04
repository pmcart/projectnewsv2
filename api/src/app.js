// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const breakingNewsRoutes = require('./routes/breakingNewsRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security & parsing
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for Angular compatibility
  })
);
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
app.use('/api/videos', require('./routes/videoRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/super-admin', require('./routes/superAdminRoutes'));

// Serve Angular static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist/frontend/browser');
  app.use(express.static(frontendPath));

  // Handle Angular routing - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Error handler (last)
app.use(errorHandler);

module.exports = app;
