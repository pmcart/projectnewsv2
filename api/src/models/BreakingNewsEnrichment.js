// src/models/BreakingNewsEnrichment.js
const mongoose = require('mongoose');

const { Schema } = mongoose;

const entitiesSchema = new Schema(
  {
    people: {
      type: [String],
      default: [],
    },
    organizations: {
      type: [String],
      default: [],
    },
    equipment: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const futureScenarioSchema = new Schema(
  {
    scenario: {
      type: String,
      required: true,
      trim: true,
    },
    likelihood: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
  },
  { _id: false }
);

const knockOnEffectSchema = new Schema(
  {
    effect: {
      type: String,
      required: true,
      trim: true,
    },
    likelihood: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
  },
  { _id: false }
);

const locationSchema = new Schema(
  {
    place: {
      type: String,
      required: true,
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

const breakingNewsEnrichmentSchema = new Schema(
  {
    // Optional link back to your BreakingNews document
    breakingNews: {
      type: Schema.Types.ObjectId,
      ref: 'BreakingNews',
      index: true,
    },

    // Tweet / source meta
    tweetId: {
      type: String,
      index: true,
      required: true,
      trim: true,
    },
    tweet_url: {
      type: String,
      trim: true,
    },
    tweet_datetime: {
      type: Date,
    },
    account: {
      type: String,
      trim: true,
    },

    // High-level classification
    category: {
      type: String,
      trim: true,
      default: 'unknown',
    },
    event_type: {
      type: String,
      trim: true,
      default: 'unknown',
    },
    time_window: {
      type: String,
      enum: ['past_event', 'ongoing', 'future_risk', 'unknown'],
      default: 'unknown',
    },

    // Model & scoring
    model_used: {
      type: String,
      trim: true,
    },
    needs_higher_model: {
      type: Boolean,
      default: false,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    credibility: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    risk_score: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    sentiment: {
      type: Number,
      min: -1,
      max: 1,
      default: 0,
    },

    // Enriched analysis
    context: {
      type: String,
    },
    entities: {
      type: entitiesSchema,
      default: () => ({}),
    },
    future_scenarios: {
      type: [futureScenarioSchema],
      default: [],
    },
    knock_on_effects: {
      type: [knockOnEffectSchema],
      default: [],
    },
    locations: {
      type: [locationSchema],
      default: [],
    },

    // Verification / tracking
    sources_to_verify: {
      type: [String],
      default: [],
    },
    hash: {
      type: String,
      index: true,
    },

    notes: {
      type: String,
      default: null,
    },
  },
  {
    collection: 'breaking_news_enrichments',
    timestamps: true, // createdAt / updatedAt
  }
);

// Example compound index if you want to ensure uniqueness per tweet
// breakingNewsEnrichmentSchema.index({ tweetId: 1 }, { unique: true });

module.exports = mongoose.model(
  'BreakingNewsEnrichment',
  breakingNewsEnrichmentSchema
);
