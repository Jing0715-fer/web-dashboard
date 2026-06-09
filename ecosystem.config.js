module.exports = {
  apps: [
    {
      name: 'web-dashboard',
      script: 'bun',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      cwd: '/Users/lijing/Projects/web-dashboard',
    },
  ],
};
