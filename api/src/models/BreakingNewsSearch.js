const mongoose = require("mongoose");

const BreakingNewsSearchSchema = new mongoose.Schema(
  {
    tweetId: { type: String, index: true },
    searchTerm: { type: String, index: true },
    jobId: { type: String, index: true },
    author: { type: String, default: null },
    authorName: { type: String, default: null },
    capturedAt: { type: Date, index: true },
    createdAt: { type: Date, index: true },
    lastSeenAt: { type: Date, index: true },

    images: { type: [String], default: [] },
    videos: { type: Array, default: [] },

    source: { type: String },
    text: { type: String },
    tweetCreatedAt: { type: Date },
    url: { type: String, default: null },
  },
  { collection: "breaking_news_search" }
);

module.exports = mongoose.model("BreakingNewsSearch", BreakingNewsSearchSchema);
