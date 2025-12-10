// src/models/BreakingNews.js
const mongoose = require('mongoose');

const breakingNewsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      default: 'unknown',
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    tags: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: 'breaking_news', // explicit collection name
    timestamps: true,            // createdAt / updatedAt
  }
);

module.exports = mongoose.model('BreakingNews', breakingNewsSchema);
