const express = require('express');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const app = express();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const candidates = [
  __dirname,
  join(__dirname, 'browser'),
  join(__dirname, 'dist', 'taskando'),
  join(__dirname, 'dist', 'taskando', 'browser'),
];
const browserDirectory = candidates.find((directory) => existsSync(join(directory, 'index.html')));

if (!browserDirectory) {
  throw new Error('Build do Angular não encontrado. Execute npm run build antes de iniciar o servidor.');
}

app.disable('x-powered-by');
app.get('/health', (_request, response) => response.json({ status: 'ok' }));
app.get(['/server.cjs', '/package.json'], (_request, response) => response.sendStatus(404));
app.use(express.static(browserDirectory, { index: false, maxAge: '1y', immutable: true }));
app.use((request, response, next) => {
  if (!['GET', 'HEAD'].includes(request.method)) return next();
  response.setHeader('Cache-Control', 'no-cache');
  return response.sendFile(join(browserDirectory, 'index.html'));
});

if (require.main === module) {
  app.listen(port, host, () => {
    console.log(`Taskando Front disponível em ${host}:${port}.`);
  });
}

module.exports = { app, browserDirectory };
