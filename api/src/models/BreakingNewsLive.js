const mongoose = require("mongoose");

const BreakingNewsLiveSchema = new mongoose.Schema(
  {
    tweetId: { type: String, index: true },
    enrichmentTweetId: { type: String, index: true },
    author: { type: String, default: null },
    authorName: { type: String, default: null },
    jobId: { type:String, index:true },
    capturedAt: { type: Date, index: true },
    createdAt: { type: Date, index: true },
    lastSeenAt: { type: Date, index: true },

    enrichmentRef: { type: mongoose.Schema.Types.ObjectId, default: null },

    images: { type: [String], default: [] },
    videos: { type: [String], default: [] },

    query: { type: String },
    searchUrl: { type: String },
    source: { type: String },
    text: { type: String },

    tweetCreatedAt: { type: Date },
    url: { type: String, default: null },
  },
  { collection: "breaking_news_live" }
);

module.exports = mongoose.model("BreakingNewsLive", BreakingNewsLiveSchema);
