#!/usr/bin/env node
// projectJobs.js - Main job orchestrator for ProjectNews
require('dotenv').config();
const path = require('path');
const {
  runScript,
  runParallel,
  launchChrome,
  isChromeRunning,
  sleep,
  formatDuration,
} = require('./lib/jobRunner');

// Configuration
const CONFIG = {
  chromeDebugPort: 9222,
  chromeWaitSeconds: 30,
  scheduleIntervalMinutes: 15,
};

// Script paths
const SCRIPTS = {
  twitterScraper: path.join(__dirname, 'twitterscraper.mjs'),
  enrichBreakingNews: path.join(__dirname, 'enrichbreakingnews.mjs'),
  getBreakingNewsMedia: path.join(__dirname, 'getbreakingnewsmedia.js'),
};

let isRunning = false;
let runCount = 0;

/**
 * Run the main job sequence
 */
async function runJobSequence() {
  if (isRunning) {
    console.log('[ProjectJobs] Previous run still in progress, skipping...');
    return;
  }

  isRunning = true;
  runCount++;
  const startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log(`[ProjectJobs] Starting run #${runCount} at ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));

  try {
    // Step 1: Run Twitter scraper
    console.log('\n[Step 1/2] Running Twitter scraper...');
    await runScript(SCRIPTS.twitterScraper);

    // Step 2: Run enrichment jobs in parallel
    console.log('\n[Step 2/2] Running enrichment jobs in parallel...');
    await runParallel([
      SCRIPTS.enrichBreakingNews,
      SCRIPTS.getBreakingNewsMedia,
    ]);

    const duration = Date.now() - startTime;
    console.log('\n' + '-'.repeat(60));
    console.log(`[ProjectJobs] Run #${runCount} completed in ${formatDuration(duration)}`);
    console.log('-'.repeat(60));

  } catch (err) {
    console.error(`[ProjectJobs] Run #${runCount} failed:`, err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Initialize Chrome if needed
 */
async function initializeChrome() {
  console.log('[ProjectJobs] Checking if Chrome is running...');

  const chromeRunning = await isChromeRunning(CONFIG.chromeDebugPort);

  if (chromeRunning) {
    console.log('[ProjectJobs] Chrome is already running with remote debugging.');
    return;
  }

  console.log('[ProjectJobs] Chrome not detected, launching...');
  await launchChrome({
    debugPort: CONFIG.chromeDebugPort,
    waitSeconds: CONFIG.chromeWaitSeconds,
  });
}

/**
 * Main entry point
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           ProjectNews Job Runner                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Schedule: Every ${CONFIG.scheduleIntervalMinutes} minutes`);
  console.log(`Scripts:`);
  console.log(`  - ${path.basename(SCRIPTS.twitterScraper)}`);
  console.log(`  - ${path.basename(SCRIPTS.enrichBreakingNews)} (parallel)`);
  console.log(`  - ${path.basename(SCRIPTS.getBreakingNewsMedia)} (parallel)`);
  console.log();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const skipChrome = args.includes('--skip-chrome');
  const runOnce = args.includes('--once');

  // Step 1: Initialize Chrome (unless skipped)
  if (!skipChrome) {
    await initializeChrome();
  } else {
    console.log('[ProjectJobs] Skipping Chrome initialization (--skip-chrome)');
  }

  // Step 2: Run immediately
  await runJobSequence();

  // Step 3: Schedule recurring runs (unless --once)
  if (runOnce) {
    console.log('\n[ProjectJobs] Single run complete (--once flag). Exiting.');
    process.exit(0);
  }

  const intervalMs = CONFIG.scheduleIntervalMinutes * 60 * 1000;
  console.log(`\n[ProjectJobs] Scheduling next run in ${CONFIG.scheduleIntervalMinutes} minutes...`);
  console.log('[ProjectJobs] Press Ctrl+C to stop.\n');

  setInterval(() => {
    console.log(`\n[ProjectJobs] Scheduled run triggered at ${new Date().toLocaleString()}`);
    runJobSequence();
  }, intervalMs);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[ProjectJobs] Shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[ProjectJobs] Terminated.');
    process.exit(0);
  });
}

// Run
main().catch((err) => {
  console.error('[ProjectJobs] Fatal error:', err);
  process.exit(1);
});
