// src/models/BreakingNewsMedia.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

const imageSchema = new Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    link: {
      type: String,
      trim: true,
      required: true,
    },
    thumbnail: {
      type: String,
      trim: true,
      default: null,
    },
    mime: {
      type: String,
      trim: true,
      default: null,
    },
    contextLink: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false }
);

const mediaLinkSchema = new Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    link: {
      type: String,
      trim: true,
      required: true,
    },
    displayLink: {
      type: String,
      trim: true,
    },
    snippet: {
      type: String,
      trim: true,
    },
    mime: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false }
);

const locationSchema = new Schema(
  {
    place: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    lat: {
      type: Number,
      default: null,
    },
    lon: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const breakingNewsMediaSchema = new Schema(
  {
    // You’re currently using a string tweet id in your example:
    // "source_tweet_id": "1896954372950810961"
    // If you later want this to be an ObjectId reference to another model,
    // you can change this to: type: Schema.Types.ObjectId, ref: 'BreakingNews'
    source_tweet_id: {
      type: String,
      index: true,
      required: true,
      trim: true,
    },

    // Optional additional structured data
    entities: {
      type: Schema.Types.Mixed, // matches {} in your example, flexible
      default: {},
    },

    event_type: {
      type: String,
      trim: true,
      default: null,
    },

    hash: {
      type: String,
      trim: true,
      default: null,
    },

    images: {
      type: [imageSchema],
      default: [],
    },

    locations: {
      type: [locationSchema],
      default: [],
    },

    video_links: {
      type: [mediaLinkSchema],
      default: [],
    },

    media_query: {
      type: String,
      trim: true,
    },

    searchedAt: {
      type: Date,
    },

    // free-text field (your example "text" field)
    text: {
      type: String,
      trim: true,
    },
  },
  {
    collection: 'breaking_news_media',
    timestamps: true, // adds createdAt / updatedAt
  }
);

module.exports = mongoose.model('BreakingNewsMedia', breakingNewsMediaSchema);
