const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Readable } = require('stream');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const configFile = path.join(rootDir, 'configuration.json');
const whitelistFile = path.join(rootDir, 'rules', 'whitelist.txt');

const IP_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function isValidDomain(domain) {
  if (!domain || domain.length > 253) return false;
  if (!domain.includes('.')) return false;
  if (IP_REGEX.test(domain)) return false;
  if (domain.includes('*')) return false;
  if (domain === 'localhost' || domain === 'broadcasthost' || domain.endsWith('.local') || domain.endsWith('.lan') || domain.endsWith('.internal')) return false;
  
  const labels = domain.split('.');
  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
    if (!/^[a-z0-9_-]+$/.test(label)) return false;
  }
  return true;
}

function parseLine(line) {
  let trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('#')) return null;

  trimmed = trimmed.replace(/#.*$/, '').trim();
  if (!trimmed) return null;

  let clean = trimmed.replace(/^\|\|/, '').replace(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+/, '').replace(/\^.*$/, '').trim();
  clean = clean.replace(/^\*\.?/, '');

  const domain = clean.toLowerCase();
  if (isValidDomain(domain)) {
    return domain;
  }
  return null;
}

async function loadWhitelist() {
  const whitelist = new Set();
  if (!fs.existsSync(whitelistFile)) return whitelist;

  const content = fs.readFileSync(whitelistFile, 'utf8');
  for (const line of content.split('\n')) {
    const domain = parseLine(line);
    if (domain) whitelist.add(domain);
  }
  console.log(`[whitelist] Loaded ${whitelist.size.toLocaleString()} whitelisted domains.`);
  return whitelist;
}

async function fetchSourceStream(sourceUrl) {
  if (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')) {
    console.log(`[fetch] ${sourceUrl}`);
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} from ${sourceUrl}`);
    }
    return Readable.fromWeb(response.body);
  } else {
    const filePath = path.isAbsolute(sourceUrl) ? sourceUrl : path.join(rootDir, sourceUrl);
    console.log(`[read] ${filePath}`);
    if (!fs.existsSync(filePath)) {
      console.warn(`[warn] File not found: ${filePath}`);
      return null;
    }
    return fs.createReadStream(filePath);
  }
}

async function processSource(source, domainSet) {
  const stream = await fetchSourceStream(source.source);
  if (!stream) return 0;

  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  let count = 0;
  for await (const line of rl) {
    const domain = parseLine(line);
    if (domain) {
      domainSet.add(domain);
      count++;
    }
  }
  console.log(`  -> Loaded ${count.toLocaleString()} raw rules from [${source.name}]`);
  return count;
}

async function main() {
  const startTime = Date.now();
  console.log('[build] Starting compilation pipeline...\n');

  fs.mkdirSync(distDir, { recursive: true });

  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const whitelist = await loadWhitelist();
  const domainSet = new Set();

  for (const source of config.sources) {
    try {
      await processSource(source, domainSet);
    } catch (err) {
      console.error(`[error] Failed to process ${source.name}: ${err.message}`);
    }
  }

  console.log(`\n[info] Total unique domains collected: ${domainSet.size.toLocaleString()}`);

  let removedByWhitelist = 0;
  for (const allowed of whitelist) {
    if (domainSet.delete(allowed)) {
      removedByWhitelist++;
    }
  }
  if (removedByWhitelist > 0) {
    console.log(`[info] Removed ${removedByWhitelist.toLocaleString()} domains via whitelist.`);
  }

  console.log('[info] Sorting domains alphabetically...');
  const sortedDomains = Array.from(domainSet).sort();
  const totalRules = sortedDomains.length;
  const isoTime = new Date().toISOString();
  const formattedCount = totalRules.toLocaleString();

  console.log(`[info] Final unique rule count: ${formattedCount}`);

  // Single unified filter.txt
  const watermark = [
    '!',
    `! Title: ${config.name}`,
    `! Description: ${config.description}`,
    `! Homepage: ${config.homepage}`,
    `! Version: ${config.version}`,
    `! Last modified: ${isoTime}`,
    `! Total rules: ${formattedCount}`,
    '!'
  ].join('\n') + '\n';

  const filterFilePath = path.join(distDir, 'filter.txt');
  const filterStream = fs.createWriteStream(filterFilePath, { encoding: 'utf8' });
  filterStream.write(watermark);
  for (const domain of sortedDomains) {
    filterStream.write(`||${domain}^\n`);
  }
  filterStream.end();

  // Clean single-file dashboard
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.name}</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #131b2e;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --primary-hover: #0284c7;
      --border: #1e293b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      display: flex;
      justify-content: center;
      padding: 2.5rem 1rem;
      min-height: 100vh;
    }
    .container {
      max-width: 800px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1.75rem;
    }
    .header h1 {
      font-size: 1.85rem;
      font-weight: 700;
      color: #fff;
    }
    .header p {
      color: var(--text-muted);
      margin-top: 0.35rem;
      font-size: 1rem;
    }
    .badge-group {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      background: #090d16;
      border: 1px solid var(--border);
      color: var(--text);
    }
    .badge.count { color: var(--primary); }
    .url-section {
      margin-top: 1.5rem;
    }
    .url-card {
      background: #090d16;
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .url-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text);
    }
    .url-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .url-text {
      flex: 1;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      color: var(--primary);
      overflow-x: auto;
      white-space: nowrap;
      background: #0d1322;
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      border: 1px solid #1e293b;
    }
    button.copy-btn {
      background: var(--primary);
      color: #090d16;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    button.copy-btn:hover {
      background: var(--primary-hover);
      color: #fff;
    }
    .section-title {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: #e2e8f0;
    }
    ol {
      padding-left: 1.25rem;
      color: var(--text-muted);
    }
    li { margin-bottom: 0.5rem; }
    li strong { color: var(--text); }
    code {
      background: #090d16;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-size: 0.85rem;
      color: var(--primary);
    }
    a {
      color: var(--primary);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card header">
      <h1>${config.name}</h1>
      <p>${config.description}</p>
      
      <div class="badge-group">
        <span class="badge count">Rules: ${formattedCount}</span>
        <span class="badge">Pi-hole Ready</span>
        <span class="badge">AdGuard Ready</span>
        <span class="badge">Updated: ${new Date(isoTime).toISOString()}</span>
      </div>

      <div class="url-section">
        <div class="url-card">
          <div class="url-title">Filter URL (filter.txt)</div>
          <div class="url-box">
            <span id="filterUrl" class="url-text">Loading...</span>
            <button class="copy-btn" onclick="copyUrl('filterUrl', this)">Copy URL</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="section-title">Pi-hole Setup</h2>
      <ol>
        <li>Open Pi-hole admin console (<code>http://pi.hole/admin</code>)</li>
        <li>Navigate to <strong>Adlists</strong></li>
        <li>Paste the Filter URL into the <strong>Address</strong> field</li>
        <li>Click <strong>Add</strong>, then run <code>pihole -g</code> (or Tools &gt; Update Gravity)</li>
      </ol>
    </div>

    <div class="card">
      <h2 class="section-title">AdGuard Setup</h2>
      <ol>
        <li><strong>AdGuard Home</strong>: Filters &gt; DNS blocklists &gt; Add blocklist &gt; Paste Filter URL</li>
        <li><strong>AdGuard App</strong>: Settings &gt; DNS protection &gt; DNS Filters &gt; Add Filter &gt; Paste Filter URL</li>
        <li><strong>uBlock Origin</strong>: Settings &gt; Filter lists &gt; Import &gt; Paste Filter URL</li>
      </ol>
    </div>

    <footer>
      <p>Maintained by <a href="${config.homepage}">someno1se</a></p>
      <p style="margin-top: 0.35rem;">
        <a href="filter.txt" target="_blank">filter.txt</a> · 
        <a href="${config.homepage}" target="_blank">GitHub Repository</a>
      </p>
    </footer>
  </div>

  <script>
    const filterTxtUrl = window.location.origin + window.location.pathname.replace(/index\\.html$/, '') + 'filter.txt';
    document.getElementById('filterUrl').innerText = filterTxtUrl;

    function copyUrl(elementId, btn) {
      const text = document.getElementById(elementId).innerText;
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(() => { btn.innerText = orig; }, 2000);
      });
    }
  </script>
</body>
</html>
`;

  fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf8');

  // Clean old files if any
  const oldDomains = path.join(distDir, 'domains.txt');
  const oldHosts = path.join(distDir, 'hosts.txt');
  if (fs.existsSync(oldDomains)) fs.unlinkSync(oldDomains);
  if (fs.existsSync(oldHosts)) fs.unlinkSync(oldHosts);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n[done] Compilation completed in ${elapsed}s. Output: dist/filter.txt`);
}

main().catch(err => {
  console.error('[fatal] Error during build:', err);
  process.exit(1);
});
