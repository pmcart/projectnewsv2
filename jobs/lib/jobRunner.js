// jobRunner.js - Node.js job runner with scheduling
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Run a Node.js script and return a promise
 * @param {string} scriptPath - Path to the script
 * @param {object} options - Options for spawning
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
function runScript(scriptPath, options = {}) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(scriptPath);
    const args = [scriptPath];

    // Use appropriate Node.js flags for ES modules
    if (ext === '.mjs') {
      args.unshift('--experimental-modules');
    }

    console.log(`[JobRunner] Starting: ${path.basename(scriptPath)}`);
    const startTime = Date.now();

    const child = spawn('node', args, {
      cwd: options.cwd || path.dirname(scriptPath),
      env: { ...process.env, ...options.env },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const str = data.toString();
      stdout += str;
      if (options.silent !== true) {
        process.stdout.write(`  ${str}`);
      }
    });

    child.stderr.on('data', (data) => {
      const str = data.toString();
      stderr += str;
      if (options.silent !== true) {
        process.stderr.write(`  ${str}`);
      }
    });

    child.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      if (code === 0) {
        console.log(`[JobRunner] Completed: ${path.basename(scriptPath)} (${duration}s)`);
        resolve({ code, stdout, stderr });
      } else {
        console.error(`[JobRunner] Failed: ${path.basename(scriptPath)} (exit code ${code})`);
        reject(new Error(`Script ${scriptPath} exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Run multiple scripts in parallel
 * @param {string[]} scriptPaths - Array of script paths
 * @param {object} options - Options for spawning
 * @returns {Promise<Array>}
 */
function runParallel(scriptPaths, options = {}) {
  console.log(`[JobRunner] Running ${scriptPaths.length} scripts in parallel...`);
  return Promise.all(scriptPaths.map(script => runScript(script, options)));
}

/**
 * Run multiple scripts in sequence
 * @param {string[]} scriptPaths - Array of script paths
 * @param {object} options - Options for spawning
 * @returns {Promise<Array>}
 */
async function runSequence(scriptPaths, options = {}) {
  const results = [];
  for (const script of scriptPaths) {
    const result = await runScript(script, options);
    results.push(result);
  }
  return results;
}

/**
 * Launch Chrome with remote debugging
 * @param {object} options - Chrome options
 * @returns {Promise<ChildProcess>}
 */
function launchChrome(options = {}) {
  return new Promise((resolve, reject) => {
    const url = options.url || 'https://x.com/home';
    const debugPort = options.debugPort || 9222;
    const userDataDir = options.userDataDir || 'C:\\ChromeDebug';

    // Find Chrome executable
    const chromePaths = [
      process.env.CHROME_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ].filter(Boolean);

    const chromePath = chromePaths.find(p => fs.existsSync(p));

    if (!chromePath) {
      return reject(new Error('Chrome executable not found. Set CHROME_PATH environment variable.'));
    }

    console.log(`[JobRunner] Launching Chrome with remote debugging on port ${debugPort}...`);

    const args = [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      url,
    ];

    const child = spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    // Give Chrome time to start
    const waitTime = options.waitSeconds || 10;
    console.log(`[JobRunner] Waiting ${waitTime}s for Chrome to initialize...`);

    setTimeout(() => {
      console.log('[JobRunner] Chrome should be ready.');
      resolve(child);
    }, waitTime * 1000);
  });
}

/**
 * Check if Chrome is already running with remote debugging
 * @param {number} port - Debug port to check
 * @returns {Promise<boolean>}
 */
async function isChromeRunning(port = 9222) {
  try {
    const http = require('http');
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format a duration in milliseconds to human readable string
 * @param {number} ms - Milliseconds
 * @returns {string}
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

module.exports = {
  runScript,
  runParallel,
  runSequence,
  launchChrome,
  isChromeRunning,
  sleep,
  formatDuration,
};
