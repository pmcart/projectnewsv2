const Job = require('../models/Job');
const BreakingNews = require('../models/BreakingNews');
const BreakingNewsEnrichment = require('../models/BreakingNewsEnrichment');
const prisma = require('../config/prisma');

async function getDashboardStats(req, res, next) {
  try {
    // Get date ranges
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel for performance
    const [
      // Jobs stats
      totalJobs,
      runningJobs,
      queuedJobs,
      failedJobsLast24h,
      recentJobs,
      jobsByType,

      // Breaking news stats
      totalBreakingNews,
      breakingNewsLast24h,
      recentBreakingNews,

      // Enrichment stats
      totalEnrichments,
      enrichmentsByCategory,
      avgRiskScore,
      highRiskItems,

      // Documents stats (Prisma)
      totalDocuments,
      documentsByStatus,

      // Videos stats (Prisma)
      totalVideos,
      videosByStatus,
    ] = await Promise.all([
      // Jobs
      Job.countDocuments(),
      Job.countDocuments({ status: 'running' }),
      Job.countDocuments({ status: 'queued' }),
      Job.countDocuments({ status: 'failed', finishedAt: { $gte: last24h } }),
      Job.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .exec(),
      Job.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),

      // Breaking news
      BreakingNews.countDocuments(),
      BreakingNews.countDocuments({ createdAt: { $gte: last24h } }),
      BreakingNews.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .exec(),

      // Enrichments
      BreakingNewsEnrichment.countDocuments(),
      BreakingNewsEnrichment.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      BreakingNewsEnrichment.aggregate([
        { $match: { risk_score: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgRisk: { $avg: '$risk_score' } } },
      ]),
      BreakingNewsEnrichment.countDocuments({ risk_score: { $gte: 0.7 } }),

      // Documents (Prisma)
      prisma.document.count(),
      prisma.document.groupBy({
        by: ['status'],
        _count: { status: true },
      }),

      // Videos (Prisma)
      prisma.video.count(),
      prisma.video.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    // Transform jobs by type into object
    const jobsByTypeMap = {};
    jobsByType.forEach((j) => {
      jobsByTypeMap[j._id] = j.count;
    });

    // Transform documents by status
    const documentsStatusMap = {};
    documentsByStatus.forEach((d) => {
      documentsStatusMap[d.status] = d._count.status;
    });

    // Transform videos by status
    const videosStatusMap = {};
    videosByStatus.forEach((v) => {
      videosStatusMap[v.status] = v._count.status;
    });

    // Transform enrichment categories
    const categoriesMap = {};
    enrichmentsByCategory.forEach((c) => {
      if (c._id) {
        categoriesMap[c._id] = c.count;
      }
    });

    // Format recent jobs for response
    const formattedRecentJobs = recentJobs.map((j) => ({
      id: String(j._id),
      type: j.type,
      status: j.status,
      createdAt: j.createdAt,
      startedAt: j.startedAt,
      finishedAt: j.finishedAt,
    }));

    // Format recent breaking news
    const formattedRecentNews = recentBreakingNews.map((n) => {
      // Use datetime (tweet time) or createdAt, ensure it's a valid ISO string
      let timestamp = n.datetime || n.createdAt;
      if (timestamp instanceof Date) {
        timestamp = timestamp.toISOString();
      } else if (timestamp && typeof timestamp === 'string') {
        // Try to parse and re-format to ensure valid ISO
        const parsed = new Date(timestamp);
        timestamp = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
      } else {
        timestamp = new Date().toISOString();
      }

      return {
        id: String(n._id),
        tweetId: n.tweetId,
        account: n.account,
        text: n.text?.substring(0, 150) + (n.text?.length > 150 ? '...' : ''),
        timestamp,
      };
    });

    res.json({
      jobs: {
        total: totalJobs,
        running: runningJobs,
        queued: queuedJobs,
        failedLast24h: failedJobsLast24h,
        byType: jobsByTypeMap,
        recent: formattedRecentJobs,
      },
      breakingNews: {
        total: totalBreakingNews,
        last24h: breakingNewsLast24h,
        recent: formattedRecentNews,
      },
      enrichments: {
        total: totalEnrichments,
        avgRiskScore: avgRiskScore[0]?.avgRisk ?? null,
        highRiskCount: highRiskItems,
        byCategory: categoriesMap,
      },
      documents: {
        total: totalDocuments,
        byStatus: documentsStatusMap,
        inReview: documentsStatusMap['IN_REVIEW'] || 0,
      },
      videos: {
        total: totalVideos,
        byStatus: videosStatusMap,
        inReview: videosStatusMap['IN_REVIEW'] || 0,
      },
      timestamp: now.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardStats,
};
