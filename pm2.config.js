require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'citypop.in',
      script: 'dist/main.js',
      instances: '2',
      exec_mode: 'cluster',
    },
  ],
};
