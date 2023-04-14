require('dotenv').config();

module.exports = {
  apps: [
    {
      script: 'dist/main.js',
      instances: '2',
      exec_mode: 'cluster',
    },
  ],
};
