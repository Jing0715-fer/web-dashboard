module.exports = {
  apps: [
    {
      name: 'web-dashboard',
      script: '.next/standalone/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        DATABASE_URL: 'file:/Users/lijing/Projects/web-dashboard/db/custom.db',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      cwd: '/Users/lijing/Projects/web-dashboard',
    },
  ],
};
