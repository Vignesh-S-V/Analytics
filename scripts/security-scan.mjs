import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const textExtensions = new Set(['.js','.jsx','.ts','.tsx','.json','.yml','.yaml','.toml','.html','.css','.md','.txt','.sh','.mjs','.cjs','.env']);
const skipExact = new Set(['.env.example', 'package-lock.json']);
const patterns = [
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g],
  ['GitHub personal access token', /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
  ['AWS access key ID', /\bAKIA[0-9A-Z]{16}\b/g],
  ['Private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['Server secret assignment', /\b(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|GEMINI_API_KEY)\s*[:=]\s*["']?(?!your_|YOUR_|<|\$)[A-Za-z0-9_./+=-]{16,}/g],
];
const findings = [];
for (const file of tracked) {
  if (skipExact.has(file) || file.startsWith('node_modules/') || file.startsWith('dist/')) continue;
  if (!textExtensions.has(extname(file)) && !file.startsWith('.github/')) continue;
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  for (const [name, pattern] of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) findings.push({file,name,line:text.slice(0,match.index).split('\n').length});
  }
}
if (findings.length) {
  for (const item of findings) process.stderr.write(`Potential ${item.name} in ${item.file}:${item.line}\n`);
  process.stderr.write('Remove exposed credentials and rotate them before merging.\n');
  process.exit(1);
}
process.stdout.write(`Secret-pattern scan passed for ${tracked.length} tracked files. Current-tree scan only; it does not scan Git history.\n`);
