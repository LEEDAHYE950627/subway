import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
const server = await readFile('server/arrivals.js', 'utf8');
const worker = (await readFile('worker/index.js', 'utf8')).replace("import { getArrivals } from '../server/arrivals.js';", '');
await writeFile('dist/server/index.js', server + '\n' + worker);
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
