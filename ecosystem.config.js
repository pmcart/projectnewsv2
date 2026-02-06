module.exports = {
  apps: [
    {
      name: 'projectnews',
      cwd: './api',
      script: 'src/server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '../logs/error.log',
      out_file: '../logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
