import { readFile, readdir } from 'node:fs/promises';
import { extname } from 'node:path';

const files = (await readdir(process.cwd())).filter((file) => extname(file) === '.html');
const problems = [];
const unsupportedClaims = [
  /all tamarins are safe/i,
  /golden lion tamarins are a keystone species/i,
  /\$1\s*=\s*1 tree/i,
  /our partners? (?:SGLT|AMLD|Save the Golden Lion Tamarin)/i
];

for (const file of files) {
  const html = await readFile(file, 'utf8');
  if (!/<html[^>]+lang="en"/i.test(html)) problems.push(`${file}: missing lang=\"en\"`);
  if (!/<main[\s>]/i.test(html)) problems.push(`${file}: missing main landmark`);
  if (!/<title>[^<]+<\/title>/i.test(html)) problems.push(`${file}: missing title`);
  for (const pattern of unsupportedClaims) {
    if (pattern.test(html)) problems.push(`${file}: contains unsupported claim matching ${pattern}`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

console.log(`Validated ${files.length} HTML files and conservation claim guardrails.`);
