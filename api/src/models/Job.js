const mongoose = require('mongoose');

const JobLogSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    stream: { type: String, enum: ['stdout', 'stderr', 'system'], required: true },
    message: { type: String, required: true },
  },
  { _id: false }
);

const JobSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g. "twitterlivescraper"
    payload: { type: Object, default: {} }, // e.g. { tweetId }

    status: {
      type: String,
      enum: ['queued', 'running', 'succeeded', 'failed'],
      default: 'queued',
      index: true,
    },

    createdAt: { type: Date, default: Date.now, index: true },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },

    exitCode: { type: Number, default: null },
    error: {
      message: { type: String, default: null },
      stack: { type: String, default: null },
    },

    // Keep last N log entries
    logs: { type: [JobLogSchema], default: [] },
  },
  { collection: 'jobs' }
);

module.exports = mongoose.model('Job', JobSchema);
