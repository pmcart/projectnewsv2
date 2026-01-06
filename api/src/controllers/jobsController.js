const jobsRepo = require('./../mongo/jobEntry');
const { runTwitterLiveScraperJob } = require('../services/jobRunner');

async function createTwitterLiveJob(req, res, next) {
  try {
    const tweetId = String(req.body?.tweetId || '').trim();
    if (!tweetId) return res.status(400).json({ error: 'tweetId is required' });

    const job = await jobsRepo.createJob({
      type: 'twitterlivescraper',
      payload: { tweetId },
    });

    // Fire-and-forget (runs in same API process)
    // IMPORTANT: ensure we pass a STRING jobId down to the runner so it can forward it to the script argv/env
    runTwitterLiveScraperJob({ jobId: String(job._id), tweetId }).catch(async (err) => {
      await jobsRepo.appendLog(job._id, 'system', `Runner error: ${err.message}`);
      await jobsRepo.markFinished({
        id: job._id,
        status: 'failed',
        exitCode: null,
        error: { message: err.message, stack: err.stack },
      });
    });

    return res.status(202).json({ jobId: String(job._id) });
  } catch (err) {
    next(err);
  }
}

async function getJobById(req, res, next) {
  try {
    const { id } = req.params;
    const job = await jobsRepo.getById(id);

    if (!job) return res.status(404).json({ error: 'Job not found' });

    // normalize id field for frontend
    return res.json({ ...job, id: String(job._id) });
  } catch (err) {
    next(err);
  }
}

async function listJobs(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const items = await jobsRepo.list({ limit, offset });
    res.json(items.map((j) => ({ ...j, id: String(j._id) })));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTwitterLiveJob,
  getJobById,
  listJobs,
};
