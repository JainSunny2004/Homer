// reset-test.mjs
import fs                from 'fs';
import path              from 'path';
import { fileURLToPath } from 'url';
import { execSync }      from 'child_process';   // ← top-level import, no require()

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SUPABASE_REST = 'https://tmfzkyohyrcnujeipvds.supabase.co/rest/v1/gps_data';
const ANON_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtZnpreW9oeXJjbnVqZWlwdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNTU4MjcsImV4cCI6MjA4NjczMTgyN30.-0ZoLx8KuaOnOErljEUv4MvnbY6Wb7wWYwDVBrT0GYA';

const DEMO_IDS = ['Demo_Tracker_01', 'Demo_Tracker_02', 'Demo_Tracker_03', 'warmup'];
const KEYS     = {
  fences:      'polygon-fences',
  assignments: 'worker-assignments',
  settings:    'manager-settings',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function openFile(filePath) {
  const url = `file:///${filePath.replace(/\\/g, '/')}`;
  try {
    if      (process.platform === 'win32')  execSync(`start "" "${url}"`);
    else if (process.platform === 'darwin') execSync(`open "${url}"`);
    else                                    execSync(`xdg-open "${url}"`);
    return true;
  } catch { return false; }
}

async function deleteFromSupabase() {
  console.log('\n  🗄️  Clearing Demo_Tracker rows from Supabase...\n');
  let anyFailed = false;

  for (const id of DEMO_IDS) {
    try {
      const res = await fetch(`${SUPABASE_REST}?device_id=eq.${id}`, {
        method:  'DELETE',
        headers: {
          Authorization:  `Bearer ${ANON_KEY}`,
          apikey:          ANON_KEY,
          'Content-Type': 'application/json',
          Prefer:         'return=minimal',
        },
      });
      const icon = res.status === 204 ? '✅' : `⚠️  HTTP ${res.status}`;
      console.log(`  ${icon}  Deleted rows for ${id}`);
    } catch (err) {
      console.log(`  ⚠️  Could not reach Supabase for ${id} (${err.message})`);
      console.log(`      → Rows will be ignored by dashboard (Demo_ prefix won't collide)`);
      anyFailed = true;
    }
  }

  if (anyFailed) {
    console.log('\n  ℹ️  Supabase delete failed (edge function may be cold).');
    console.log('      This is non-critical — old rows expire naturally.');
    console.log('      Continuing with localStorage reset...');
  }
}

function writeResetFile() {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>ST-Homer Reset</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body {
      font-family:'Courier New',monospace; background:#0f172a; color:#94a3b8;
      display:flex; align-items:center; justify-content:center;
      height:100vh; flex-direction:column; gap:16px;
    }
    .card {
      background:#1e293b; border:1px solid #334155; border-radius:12px;
      padding:32px 40px; text-align:center; min-width:400px;
    }
    .logo  { font-size:2.5rem; margin-bottom:8px; }
    .title { color:#e2e8f0; font-size:1.1rem; font-weight:bold; margin-bottom:24px; }
    .ok    { color:#22c55e; font-size:1.2rem; font-weight:bold; }
    .msg   { color:#cbd5e1; font-size:0.88rem; margin-top:8px; }
    .sub   { color:#64748b; font-size:0.78rem; margin-top:6px; }
    .rows  { margin-top:20px; text-align:left; font-size:0.78rem; color:#475569; line-height:1.8; }
    .rows span { color:#f87171; }
    .bar  { width:100%; height:4px; background:#1e293b; border-radius:2px; margin-top:20px; overflow:hidden; }
    .fill { height:100%; background:#ef4444; border-radius:2px; animation:fill 2s linear forwards; }
    @keyframes fill { from{width:0%} to{width:100%} }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🧹</div>
    <div class="title">ST-Homer Test Reset</div>
    <div class="ok"  id="status">⏳ Clearing localStorage...</div>
    <div class="msg" id="msg"></div>
    <div class="sub" id="sub"></div>
    <div class="rows" id="rows"></div>
    <div class="bar"><div class="fill"></div></div>
  </div>
  <script>
    const keys = ['${KEYS.fences}', '${KEYS.assignments}', '${KEYS.settings}'];
    keys.forEach(k => localStorage.removeItem(k));
    const cleared = keys.filter(k => localStorage.getItem(k) === null);
    document.getElementById('status').textContent = '✅ localStorage cleared!';
    document.getElementById('msg').textContent    = cleared.length + ' / ' + keys.length + ' keys removed';
    document.getElementById('sub').textContent    = 'Redirecting to dashboard in 2s...';
    document.getElementById('rows').innerHTML     =
      keys.map(k => '🗑️  <span>' + k + '</span> → removed').join('<br>');
    setTimeout(() => { window.location.href = 'http://localhost:8080'; }, 2000);
  </script>
</body>
</html>`;

  const resetPath = path.join(__dirname, 'reset.html');
  fs.writeFileSync(resetPath, html, 'utf8');
  return resetPath;
}

async function reset() {
  console.log('═'.repeat(62));
  console.log('  ST-Homer — Test Reset');
  console.log('═'.repeat(62));

  await deleteFromSupabase();

  console.log('\n  📝 Writing reset.html...');
  const resetPath = writeResetFile();

  const opened = openFile(resetPath);
  if (opened) {
    console.log('  🌐 reset.html opened — localStorage will be cleared and dashboard reloaded.');
  } else {
    console.log('  ⚠️  Open this manually in Chrome:\n     ' + resetPath);
  }

  console.log('\n' + '═'.repeat(62));
  console.log('  ✅ Reset complete! Once dashboard reloads, run:');
  console.log('\n     node test-sprint3-simulation.mjs\n');
  console.log('═'.repeat(62));

  await sleep(4000);
  try { fs.unlinkSync(resetPath); } catch {}
  process.exit(0);
}

reset().catch(err => {
  console.error('\n❌ Reset failed:', err.message);
  process.exit(1);
});
