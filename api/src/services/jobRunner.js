const { spawn } = require('node:child_process');
const path = require('node:path');
const jobEntry = require('../mongo/jobEntry');
const jobsRepo = jobEntry;

const SCRIPT_PATH =
  process.env.TWITTER_LIVE_SCRIPT_PATH ||
  path.join(process.cwd(), 'twitterlivescraper.mjs'); // adjust if needed

async function runTwitterLiveScraperJob({ jobId, tweetId }) {
  // mark running ASAP
  await jobsRepo.markRunning(jobId);
  await jobsRepo.appendLog(jobId, 'system', `Spawning script for tweetId=${tweetId}`);

  const child = spawn(process.execPath, [SCRIPT_PATH, tweetId], {
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await jobsRepo.appendLog(jobId, 'system', `Spawned PID=${child.pid}`);

  child.stdout.on('data', (buf) => {
    jobsRepo.appendLog(jobId, 'stdout', buf.toString('utf8')).catch(() => {});
  });

  child.stderr.on('data', (buf) => {
    jobsRepo.appendLog(jobId, 'stderr', buf.toString('utf8')).catch(() => {});
  });

  child.on('error', async (err) => {
    await jobsRepo.appendLog(jobId, 'system', `Process error: ${err.message}`);
    await jobsRepo.markFinished({
      id: jobId,
      status: 'failed',
      exitCode: null,
      error: { message: err.message, stack: err.stack },
    });
  });

  child.on('close', async (code) => {
    const succeeded = code === 0;
    await jobsRepo.appendLog(jobId, 'system', `Process exited code=${code}`);

    await jobsRepo.markFinished({
      id: jobId,
      status: succeeded ? 'succeeded' : 'failed',
      exitCode: code,
      error: succeeded ? null : { message: `Exited with code ${code}` },
    });
  });
}

module.exports = { runTwitterLiveScraperJob };
