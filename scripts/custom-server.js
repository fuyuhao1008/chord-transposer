#!/usr/bin/env node

/**
 * 自定义Next.js服务器
 * 强制监听0.0.0.0，确保FaaS平台可以检测到端口
 */

const { createServer } = require('http');
const { parse } = require('url');
const { join } = require('path');
const next = require('next');

// 获取配置
const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT, 10) || 5000;
const hostname = '0.0.0.0'; // 强制监听所有网络接口

// standalone模式下需要设置dir参数
const dir = join(__dirname);

console.log('========================================');
console.log('Starting Custom Next.js Server');
console.log('========================================');
console.log(`Environment: ${dev ? 'development' : 'production'}`);
console.log(`Port: ${port}`);
console.log(`Hostname: ${hostname}`);
console.log(`Working directory: ${dir}`);
console.log('');

// 创建Next.js应用实例（standalone模式需要dir参数）
const app = next({ dev, hostname, port, dir });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log('========================================');
      console.log('Server ready!');
      console.log(`Listening on http://${hostname}:${port}`);
      console.log('========================================');
    });
}).catch((err) => {
  console.error('Failed to start Next.js app:', err);
  process.exit(1);
});
