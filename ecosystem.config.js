// PM2 Ecosystem Configuration
// Manages all Upright processes in production

module.exports = {
  apps: [
    // Frontend static file server
    {
      name: 'upright-frontend',
      cwd: './frontend/web',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 5373
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    // Main backend server
    {
      name: 'upright-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8003
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },

    // Mock sensor #1 (upper back) - Mixed scenario
    {
      name: 'mock-sensor-1',
      cwd: './backend',
      script: 'mock-sensor.js',
      args: '--sensor 1 --scenario mixed --hz 20',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/sensor1-error.log',
      out_file: './logs/sensor1-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
