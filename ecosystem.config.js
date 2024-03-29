// 获取本地环境的Node Env, 仅仅是用来测试
const getPM2NodeEnv = () => {
  process.env.NODE_ENV = 'development'; //测试环境先设置一次Nod_ENV 这样可以读本地配置文件
  let ENV = require('./dist/config');
  let temp = {
    OPENAI_API_KEY: ENV.OPENAI_API_KEY,
    CHATGPT_MODEL_GPT: ENV.CHATGPT_MODEL_GPT,
    CHATGPT_MODEL: ENV.CHATGPT_MODEL,
    MYSQL_USERNAME: ENV.MYSQL_USERNAME,
    MYSQL_PASSWORD: ENV.MYSQL_PASSWORD,
    MYSQL_ADDRESS: ENV.MYSQL_ADDRESS,
    SUBSCRIBE_TEMPLATE_ID: ENV.SUBSCRIBE_TEMPLATE_ID,
  };
  return temp;
};

/**
 * @description pm2 configuration file.
 * @example
 *  production mode :: pm2 start ecosystem.config.js --only prod
 *  development mode :: pm2 start ecosystem.config.js --only dev
 */
module.exports = {
  apps: [
    {
      name: 'prod', // pm2 start App name
      script: 'dist/server.js',
      exec_mode: 'cluster', // 'cluster' or 'fork'
      instance_var: 'INSTANCE_ID', // instance variable
      instances: 2, // pm2 instance count
      autorestart: true, // auto restart if process crash
      watch: false, // files change automatic restart
      ignore_watch: ['node_modules', 'logs'], // ignore files change
      max_memory_restart: '1G', // restart if process use more than 1G memory
      merge_logs: true, // if true, stdout and stderr will be merged and sent to pm2 log
      output: './logs/access.log', // pm2 log file
      error: './logs/error.log', // pm2 error log file
      env: {
        // environment variable
        PORT: 80,
      },
    },
    {
      name: 'dev', // pm2 start App name
      script: 'ts-node', // ts-node
      args: '-r tsconfig-paths/register --transpile-only src/server.ts', // ts-node args
      exec_mode: 'cluster', // 'cluster' or 'fork'
      instance_var: 'INSTANCE_ID', // instance variable
      instances: 2, // pm2 instance count
      autorestart: false, // auto restart if process crash
      watch: true, // files change automatic restart
      ignore_watch: ['node_modules', 'logs'], // ignore files change
      max_memory_restart: '1G', // restart if process use more than 1G memory
      merge_logs: true, // if true, stdout and stderr will be merged and sent to pm2 log
      output: './logs/access.log', // pm2 log file
      error: './logs/error.log', // pm2 error log file
      env: {
        // environment variable
        PORT: 80,
        ...getPM2NodeEnv(),
      },
    },
  ],
  deploy: {
    production: {
      user: 'user',
      host: '0.0.0.0',
      ref: 'origin/master',
      repo: 'git@github.com:goblin-yao/wx-mp-node-express.git',
      path: 'dist/server.js',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --only prod',
    },
  },
};
