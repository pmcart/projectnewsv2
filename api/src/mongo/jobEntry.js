const Job = require('../models/Job');

class JobEntry {
  constructor() {
    this.maxLogLines = parseInt(process.env.MAX_JOB_LOG_LINES || '300', 10);
  }

  async createJob({ type, payload }) {
    return Job.create({
      type,
      payload,
      status: 'queued',
      createdAt: new Date(),
      logs: [{ stream: 'system', message: 'Job queued', at: new Date() }],
    });
  }

  async getById(id) {
    return Job.findById(id).lean().exec();
  }

  async list({ limit = 50, offset = 0 } = {}) {
    return Job.find()
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async markRunning(id) {
    return Job.updateOne(
      { _id: id },
      { $set: { status: 'running', startedAt: new Date() } }
    ).exec();
  }

  async markFinished({ id, status, exitCode, error }) {
    return Job.updateOne(
      { _id: id },
      {
        $set: {
          status,
          finishedAt: new Date(),
          exitCode: exitCode ?? null,
          error: error ?? null,
        },
      }
    ).exec();
  }

  async appendLog(id, stream, message) {
    const msg = String(message ?? '').slice(0, 10000);
    return Job.updateOne(
      { _id: id },
      {
        $push: {
          logs: {
            $each: [{ at: new Date(), stream, message: msg }],
            $slice: -this.maxLogLines,
          },
        },
      }
    ).exec();
  }
}

module.exports = new JobEntry();
