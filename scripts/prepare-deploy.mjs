import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outputDirectory = join(process.cwd(), 'dist', 'taskando');
mkdirSync(outputDirectory, { recursive: true });
copyFileSync(join(process.cwd(), 'server.cjs'), join(outputDirectory, 'server.cjs'));
writeFileSync(join(outputDirectory, 'package.json'), `${JSON.stringify({
  name: '@taskando/web-deploy',
  version: '1.0.0',
  private: true,
  scripts: {
    start: 'node server.cjs',
    deploy: 'node server.cjs',
  },
  dependencies: {
    express: '5.2.1',
  },
}, null, 2)}\n`);

console.log('Pacote de deploy preparado em dist/taskando.');
