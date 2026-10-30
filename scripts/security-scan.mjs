import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const textExtensions = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.json', '.yml', '.yaml', '.toml',
  '.html', '.css', '.md', '.txt', '.sh', '.mjs', '.cjs', '.env'
]);
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

function scanText(text, context, history = false) {
  for (const [name, pattern] of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) findings.push({ context, name, history });
  }
}

// Scan the current working tree.
for (const file of tracked) {
  if (skipExact.has(file) || file.startsWith('node_modules/') || file.startsWith('dist/')) continue;
  if (!textExtensions.has(extname(file)) && !file.startsWith('.github/')) continue;
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  for (const [name, pattern] of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      findings.push({ context: file + ':' + text.slice(0, match.index).split('\n').length, name, history: false });
    }
  }
}

// Scan added lines from reachable history so secrets removed later still surface.
const historyPatch = execFileSync(
  'git',
  ['log', '--all', '--format=commit %H', '-p', '--no-ext-diff', '--', 'src', 'public', 'index.html', '.github', 'scripts', '.env*', 'package.json', 'vite.config.js', 'README.md'],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
);
let historyCommit = 'unknown';
let historyFile = 'unknown';
for (const line of historyPatch.split('\n')) {
  if (line.startsWith('commit ')) historyCommit = line.slice(7, 19);
  if (line.startsWith('+++ b/')) historyFile = line.slice(6).trim();
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  // .env.example is a documentation template containing intentionally fake sample values.
  // It is excluded from current-tree scanning above; apply the same rule to its historical revisions.
  if (historyFile === '.env.example') continue;
  scanText(line.slice(1), historyFile + ' (commit ' + historyCommit + ')', true);
}

if (findings.length) {
  for (const item of findings) {
    process.stderr.write('Potential ' + item.name + ' in ' + item.context + '\n');
  }
  process.stderr.write('Remove exposed credentials and rotate them before merging.\n');
  process.exit(1);
}
process.stdout.write('Secret-pattern scan passed for ' + tracked.length + ' current tracked files and reachable text-file history.\n');
