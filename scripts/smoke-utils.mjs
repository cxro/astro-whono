import { readFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const smokeFixturePath = path.join(distDir, 'checks', 'markdown-smoke', 'index.html');

export const readSmokeFixtureHtml = async (label) => {
  try {
    return await readFile(smokeFixturePath, 'utf8');
  } catch {
    console.error(`${label} failed: unable to read build output.`);
    console.error(`Expected file: ${smokeFixturePath}`);
    console.error('Run `npm run build` first.');
    process.exit(1);
  }
};

export const reportSmokeCheckResult = (label, failedIds) => {
  if (!failedIds.length) {
    console.log(`${label} passed.`);
    return;
  }

  console.error(`${label} failed:`);
  for (const id of failedIds) {
    console.error(`- missing ${id}`);
  }
  process.exit(1);
};
