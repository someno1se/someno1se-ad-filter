const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Readable } = require('stream');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const configFile = path.join(rootDir, 'configuration.json');
const whitelistFile = path.join(rootDir, 'rules', 'whitelist.txt');

// Domain extraction regex
// Matches: ||example.com^, 0.0.0.0 example.com, 127.0.0.1 example.com, example.com
const DOMAIN_REGEX = /^(?:\|\|)?(?:(?:0\.0\.0\.0|127\.0\.0\.1)\s+)?([a-z0-9*_-](?:[a-z0-9*._-]*[a-z0-9*_-])?)(?:\^.*)?$/i;
const IP_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function isValidDomain(domain) {
  if (!domain || domain.length > 253) return false;
  if (!domain.includes('.')) return false;
  if (IP_REGEX.test(domain)) return false;
  if (domain.includes('*')) return false; // DNS domains must not contain wildcards
  if (domain === 'localhost' || domain === 'broadcasthost' || domain.endsWith('.local') || domain.endsWith('.lan') || domain.endsWith('.internal')) return false;
  
  // RFC compliant domain label verification
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

  // Strip inline comments starting with # or space
  trimmed = trimmed.replace(/#.*$/, '').trim();
  if (!trimmed) return null;

  // Strip leading ||, 0.0.0.0, 127.0.0.1
  let clean = trimmed.replace(/^\|\|/, '').replace(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+/, '').replace(/\^.*$/, '').trim();
  
  // Strip leading wildcard *. or *
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
  console.log(`🛡️  Loaded ${whitelist.size.toLocaleString()} whitelisted domains.`);
  return whitelist;
}

async function fetchSourceStream(sourceUrl) {
  if (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')) {
    console.log(`🌐 Fetching remote: ${sourceUrl}`);
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} from ${sourceUrl}`);
    }
    return Readable.fromWeb(response.body);
  } else {
    const filePath = path.isAbsolute(sourceUrl) ? sourceUrl : path.join(rootDir, sourceUrl);
    console.log(`📂 Reading local: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found: ${filePath}`);
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
  console.log(`   └─ Loaded ${count.toLocaleString()} raw rules from [${source.name}]`);
  return count;
}

async function main() {
  const startTime = Date.now();
  console.log('🚀 Starting someno1se ad filter compilation pipeline...\n');

  fs.mkdirSync(distDir, { recursive: true });

  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const whitelist = await loadWhitelist();
  const domainSet = new Set();

  for (const source of config.sources) {
    try {
      await processSource(source, domainSet);
    } catch (err) {
      console.error(`❌ Failed to process ${source.name}: ${err.message}`);
    }
  }

  console.log(`\n📦 Total unique domains collected: ${domainSet.size.toLocaleString()}`);

  // Apply Whitelist
  let removedByWhitelist = 0;
  for (const allowed of whitelist) {
    if (domainSet.delete(allowed)) {
      removedByWhitelist++;
    }
  }
  if (removedByWhitelist > 0) {
    console.log(`🧹 Removed ${removedByWhitelist.toLocaleString()} domains via whitelist.`);
  }

  console.log('🔤 Sorting domains alphabetically...');
  const sortedDomains = Array.from(domainSet).sort();
  const totalRules = sortedDomains.length;
  const isoTime = new Date().toISOString();
  const formattedCount = totalRules.toLocaleString();

  console.log(`✨ Final unique rule count: ${formattedCount}`);

  // 1. Generate AdGuard filter.txt (Watermark at top, ONLY rules below)
  const adguardWatermark = [
    '!',
    `! Title: ${config.name}`,
    `! Description: ${config.description} (AdGuard / uBlock Edition)`,
    `! Homepage: ${config.homepage}`,
    `! Version: ${config.version}`,
    `! Last modified: ${isoTime}`,
    `! Total rules: ${formattedCount}`,
    '!'
  ].join('\n') + '\n';

  const filterFilePath = path.join(distDir, 'filter.txt');
  const filterStream = fs.createWriteStream(filterFilePath, { encoding: 'utf8' });
  filterStream.write(adguardWatermark);
  for (const domain of sortedDomains) {
    filterStream.write(`||${domain}^\n`);
  }
  filterStream.end();

  // 2. Generate Pi-hole domains.txt (Plain domain per line)
  const domainsWatermark = [
    '#',
    `# Title: ${config.name}`,
    `# Description: ${config.description} (Pi-hole Gravity Edition)`,
    `# Homepage: ${config.homepage}`,
    `# Version: ${config.version}`,
    `# Last modified: ${isoTime}`,
    `# Total rules: ${formattedCount}`,
    '#'
  ].join('\n') + '\n';

  const domainsFilePath = path.join(distDir, 'domains.txt');
  const domainsStream = fs.createWriteStream(domainsFilePath, { encoding: 'utf8' });
  domainsStream.write(domainsWatermark);
  for (const domain of sortedDomains) {
    domainsStream.write(`${domain}\n`);
  }
  domainsStream.end();

  // 3. Generate hosts.txt (0.0.0.0 domain format)
  const hostsWatermark = [
    '#',
    `# Title: ${config.name}`,
    `# Description: ${config.description} (Standard Hosts Edition)`,
    `# Homepage: ${config.homepage}`,
    `# Version: ${config.version}`,
    `# Last modified: ${isoTime}`,
    `# Total rules: ${formattedCount}`,
    '#'
  ].join('\n') + '\n';

  const hostsFilePath = path.join(distDir, 'hosts.txt');
  const hostsStream = fs.createWriteStream(hostsFilePath, { encoding: 'utf8' });
  hostsStream.write(hostsWatermark);
  for (const domain of sortedDomains) {
    hostsStream.write(`0.0.0.0 ${domain}\n`);
  }
  hostsStream.end();

  // 4. Generate Web Dashboard (index.html)
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
      --success: #10b981;
      --pihole-red: #ea2328;
      --adguard-green: #2ecc71;
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
      border-radius: 1rem;
      padding: 1.75rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .header h1 {
      font-size: 2rem;
      font-weight: 800;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .header p {
      color: var(--text-muted);
      margin-top: 0.5rem;
      font-size: 1.05rem;
    }
    .badge-group {
      display: flex;
      gap: 0.6rem;
      margin-top: 1.25rem;
      flex-wrap: wrap;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.9rem;
      font-weight: 700;
      background: #090d16;
      border: 1px solid var(--border);
    }
    .badge.count { color: var(--success); }
    .badge.pihole { color: #f87171; }
    .badge.adguard { color: #4ade80; }
    .badge.time { color: var(--primary); }

    .url-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    .url-card {
      background: #090d16;
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .url-title {
      font-size: 0.95rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .url-title.pi { color: #f87171; }
    .url-title.ag { color: #4ade80; }
    .url-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .url-text {
      flex: 1;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.88rem;
      color: var(--primary);
      overflow-x: auto;
      white-space: nowrap;
      background: #0d1322;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid #1e293b;
    }
    button.copy-btn {
      background: var(--primary);
      color: #090d16;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-weight: 700;
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
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    ol {
      padding-left: 1.25rem;
      color: var(--text-muted);
    }
    li { margin-bottom: 0.6rem; }
    li strong { color: var(--text); }
    code {
      background: #090d16;
      padding: 0.2rem 0.4rem;
      border-radius: 0.35rem;
      font-size: 0.9rem;
      color: #38bdf8;
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
      <h1>🛡️ ${config.name}</h1>
      <p>${config.description}</p>
      
      <div class="badge-group">
        <span class="badge count">● 차단 도메인: ${formattedCount}개</span>
        <span class="badge pihole">🍓 Pi-hole 지원</span>
        <span class="badge adguard">🛡️ AdGuard 지원</span>
        <span class="badge time">🕒 최근 갱신: ${new Date(isoTime).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
      </div>

      <div class="url-section">
        <!-- Pi-hole URL -->
        <div class="url-card">
          <div class="url-title pi">
            <span>🍓 파이홀(Pi-hole) 전용 링크 (domains.txt)</span>
          </div>
          <div class="url-box">
            <span id="piholeUrl" class="url-text">로딩 중...</span>
            <button class="copy-btn" onclick="copyUrl('piholeUrl', this)">링크 복사</button>
          </div>
        </div>

        <!-- AdGuard URL -->
        <div class="url-card">
          <div class="url-title ag">
            <span>🛡️ AdGuard / AdGuard Home / uBlock 전용 링크 (filter.txt)</span>
          </div>
          <div class="url-box">
            <span id="adguardUrl" class="url-text">로딩 중...</span>
            <button class="copy-btn" onclick="copyUrl('adguardUrl', this)">링크 복사</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="section-title">🍓 파이홀(Pi-hole)에 등록하는 방법</h2>
      <ol>
        <li>Pi-hole 관리자 페이지 접속 (<code>http://pi.hole/admin</code>)</li>
        <li>좌측 메뉴에서 <strong>Adlists</strong> 클릭</li>
        <li><strong>Address</strong> 입력창에 위 <em>[Pi-hole 전용 링크]</em> 붙여넣기</li>
        <li><strong>Add</strong> 버튼 클릭 후, 콘솔에서 <code>pihole -g</code> 또는 Tools &rarr; <strong>Update Gravity</strong> 실행!</li>
      </ol>
    </div>

    <div class="card">
      <h2 class="section-title">🛡️ AdGuard Home & 앱 등록 방법</h2>
      <ol>
        <li><strong>AdGuard Home</strong>: 필터 &rarr; DNS 차단 목록 &rarr; <em>차단 목록 추가</em> &rarr; <em>[AdGuard 전용 링크]</em> 등록</li>
        <li><strong>AdGuard 앱</strong>: 설정 &rarr; DNS 보호 &rarr; DNS 필터 &rarr; <em>필터 추가</em> &rarr; <em>[AdGuard 전용 링크]</em> 등록</li>
        <li><strong>uBlock Origin</strong>: 설정 &rarr; 필터 목록 &rarr; 하단 <em>가져오기...</em> &rarr; <em>[AdGuard 전용 링크]</em> 등록</li>
      </ol>
    </div>

    <footer>
      <p>Built with ❤️ by <a href="${config.homepage}">someno1se</a></p>
      <p style="margin-top: 0.35rem;">
        <a href="domains.txt" target="_blank">domains.txt</a> · 
        <a href="filter.txt" target="_blank">filter.txt</a> · 
        <a href="hosts.txt" target="_blank">hosts.txt</a> · 
        <a href="${config.homepage}" target="_blank">GitHub 저장소</a>
      </p>
    </footer>
  </div>

  <script>
    const baseUrl = window.location.origin + window.location.pathname.replace(/index\.html$/, '');
    document.getElementById('piholeUrl').innerText = baseUrl + 'domains.txt';
    document.getElementById('adguardUrl').innerText = baseUrl + 'filter.txt';

    function copyUrl(elementId, btn) {
      const text = document.getElementById(elementId).innerText;
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.innerText;
        btn.innerText = '복사 완료! ✅';
        setTimeout(() => { btn.innerText = orig; }, 2000);
      });
    }
  </script>
</body>
</html>
`;

  fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 Compilation completed in ${elapsed}s! All output files are ready in dist/`);
}

main().catch(err => {
  console.error('Fatal error during build:', err);
  process.exit(1);
});
