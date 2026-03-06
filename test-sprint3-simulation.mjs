// test-sprint3-simulation.mjs
import fs            from 'fs';
import path          from 'path';
import https         from 'https';                  // ← replaces native fetch
import { fileURLToPath } from 'url';
import { execSync }  from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SUPABASE_HOST = 'tmfzkyohyrcnujeipvds.supabase.co';
const SUPABASE_PATH = '/functions/v1/ingest-data';
const AUTH_KEY      = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtZnpreW9oeXJjbnVqZWlwdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNTU4MjcsImV4cCI6MjA4NjczMTgyN30.-0ZoLx8KuaOnOErljEUv4MvnbY6Wb7wWYwDVBrT0GYA';

const DEVICES = [
  { id: 'Demo_Tracker_01', label: 'Demo Worker A' },
  { id: 'Demo_Tracker_02', label: 'Demo Worker B' },
  { id: 'Demo_Tracker_03', label: 'Demo Worker C' },
];

const INSIDE_ZONE  = { lat: 28.5450, lon: 77.1925 };
const OUTSIDE_ZONE = { lat: 28.5510, lon: 77.2010 };
const EDGE_ZONE    = { lat: 28.5439, lon: 77.1925 };
const YARD_FAR     = { lat: 28.5600, lon: 77.2100 };
const STATIC_AX = 100, STATIC_AY = 50, STATIC_AZ = 200;

const KEYS = {
  fences:      'polygon-fences',
  assignments: 'worker-assignments',
  settings:    'manager-settings',
};

const TEST_FENCE = {
  id:              'test-fence-sprint3',
  name:            'Sprint3 Test Zone',
  coordinates: [
    { lat: 28.5440, lng: 77.1910 },
    { lat: 28.5460, lng: 77.1910 },
    { lat: 28.5460, lng: 77.1940 },
    { lat: 28.5440, lng: 77.1940 },
  ],
  color:           '#22c55e',
  shiftStart:      '00:00',
  shiftEnd:        '23:59',
  toleranceMeters:  20,
  isGreenCorridor: false,
};

const GREEN_CORRIDOR = {
  id:              'test-corridor-sprint3',
  name:            'Sprint3 Green Corridor',
  coordinates: [
    { lat: 28.5500, lng: 77.2000 },
    { lat: 28.5520, lng: 77.2000 },
    { lat: 28.5520, lng: 77.2020 },
    { lat: 28.5500, lng: 77.2020 },
  ],
  color:           '#86efac',
  shiftStart:      '00:00',
  shiftEnd:        '23:59',
  toleranceMeters:  5,
  isGreenCorridor: true,
};

const TEST_ASSIGNMENTS = DEVICES.map((d, i) => ({
  id:       `test-assignment-0${i + 1}`,
  workerId: d.id,
  fenceId:  TEST_FENCE.id,
  jobLabel: d.label,
}));

const TEST_SETTINGS = {
  deviceTimeoutSeconds:         60,
  outOfZoneAlertDelaySeconds:   10,
  breakDurationValue:           15,
  breakDurationUnit:            'minutes',
  breakStartTime:               '13:00',
  inactivityThresholdMinutes:    5,
  inactivityBreakExtendMinutes: 15,
  silenceAlertMinutes:           5,
  coMovementThresholdMeters:    10,
  coMovementDurationSeconds:    30,
  shiftChangeTime:              '02:00',
  shiftChangeWindowMinutes:      5,
  autoRefreshIntervalSeconds:    3,
  defaultMapZoom:               16,
  showOfflineDevices:           true,
};

// ═════════════════════════════════════════════════════════════════════════════
// HTTPS REQUEST (replaces native fetch — works reliably on Windows)
// ═════════════════════════════════════════════════════════════════════════════

function httpsGet(qs) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname:           SUPABASE_HOST,
      path:               `${SUPABASE_PATH}?${qs}`,
      method:             'GET',
      headers:            { Authorization: AUTH_KEY },
      timeout:            10000,
      rejectUnauthorized: false,
      family:             4,          // ← force IPv4, skip IPv6
    };

    const req = https.request(options, res => {
      res.resume();
      resolve(res.statusCode);
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error',   reject);
    req.end();
  });
}


// ═════════════════════════════════════════════════════════════════════════════
// SEED FILE
// ═════════════════════════════════════════════════════════════════════════════

function writeSeedFile() {
  const fences      = JSON.stringify([TEST_FENCE, GREEN_CORRIDOR]).replace(/'/g, "\\'");
  const assignments = JSON.stringify(TEST_ASSIGNMENTS).replace(/'/g, "\\'");
  const settings    = JSON.stringify(TEST_SETTINGS).replace(/'/g, "\\'");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>ST-Homer Seed</title>
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
    .ok    { color:#22c55e; font-size:1.3rem; font-weight:bold; }
    .err   { color:#ef4444; font-size:1.1rem; font-weight:bold; }
    .msg   { color:#cbd5e1; font-size:0.9rem; margin-top:8px; }
    .sub   { color:#64748b; font-size:0.78rem; margin-top:6px; }
    .rows  { margin-top:20px; text-align:left; font-size:0.78rem; color:#475569; line-height:1.8; }
    .rows span { color:#22c55e; }
    .bar  { width:100%; height:4px; background:#1e293b; border-radius:2px; margin-top:20px; overflow:hidden; }
    .fill { height:100%; background:#22c55e; border-radius:2px; animation:fill 2s linear forwards; }
    @keyframes fill { from{width:0%} to{width:100%} }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🏗️</div>
    <div class="title">ST-Homer Test Seeder</div>
    <div class="ok"  id="status">⏳ Seeding localStorage...</div>
    <div class="msg" id="msg"></div>
    <div class="sub" id="sub"></div>
    <div class="rows" id="rows"></div>
    <div class="bar" id="bar" style="display:none"><div class="fill"></div></div>
  </div>
  <script>
    try {
      localStorage.setItem('${KEYS.fences}',      '${fences}');
      localStorage.setItem('${KEYS.assignments}',  '${assignments}');
      localStorage.setItem('${KEYS.settings}',     '${settings}');
      const f = JSON.parse(localStorage.getItem('${KEYS.fences}'));
      const a = JSON.parse(localStorage.getItem('${KEYS.assignments}'));
      document.getElementById('status').textContent = '✅ Seeded successfully!';
      document.getElementById('msg').textContent    = f.length + ' fences  ·  ' + a.length + ' assignments  ·  settings applied';
      document.getElementById('sub').textContent    = 'Redirecting to dashboard in 2s...';
      document.getElementById('bar').style.display  = 'block';
      document.getElementById('rows').innerHTML     =
        '📦 <span>' + f[0].name + '</span> — primary fence<br>' +
        '🟢 <span>' + f[1].name + '</span> — green corridor<br>' +
        '👷 <span>' + a.map(x => x.workerId).join(', ') + '</span>';
      setTimeout(() => { window.location.href = 'http://localhost:8080'; }, 2000);
    } catch(e) {
      document.getElementById('status').className   = 'err';
      document.getElementById('status').textContent = '❌ Seed failed';
      document.getElementById('msg').textContent    = e.message;
    }
  </script>
</body>
</html>`;

  const filePath = path.join(__dirname, 'seed.html');
  fs.writeFileSync(filePath, html, 'utf8');
  return filePath;
}

function openInBrowser(filePath) {
  const url = `file:///${filePath.replace(/\\/g, '/')}`;
  try {
    if      (process.platform === 'win32')  execSync(`start "" "${url}"`);
    else if (process.platform === 'darwin') execSync(`open "${url}"`);
    else                                    execSync(`xdg-open "${url}"`);
    return true;
  } catch { return false; }
}

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function rnd(min, max) { return +(Math.random() * (max - min) + min).toFixed(3); }
function accel()       { return { ax: rnd(-0.5,0.5), ay: rnd(-0.5,0.5), az: rnd(9.6,10.0) }; }
function sleep(ms)     { return new Promise(r => setTimeout(r, ms)); }
function divider(c='─', n=62) { console.log(c.repeat(n)); }

async function send(deviceId, params, tag) {
  const qs = Object.entries({ device_id: deviceId, ...params })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  try {
    const status = await httpsGet(qs);
    const icon   = status === 200 ? '✅' : `⚠️  HTTP ${status}`;
    console.log(`  ${icon}  ${deviceId.padEnd(22)} │ ${tag}`);
    return status === 200;
  } catch (err) {
    console.log(`  ❌  ${deviceId.padEnd(22)} │ ${tag} — ${err.message}`);
    return false;
  }
}

function waitForEnter(msg) {
  return new Promise(resolve => {
    process.stdout.write(`\n${msg}`);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      console.log();
      resolve();
    });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIOS
// ═════════════════════════════════════════════════════════════════════════════

async function scenario1_NormalOperation() {
  console.log('\n🟢 SCENARIO 1 — Normal Operation');
  console.log('   All 3 demo devices inside zone, GPS, healthy battery');
  divider();
  for (const dev of DEVICES) {
    const a = accel();
    await send(dev.id, {
      lat: INSIDE_ZONE.lat, lon: INSIDE_ZONE.lon,
      ax: a.ax, ay: a.ay, az: a.az,
      gx: 0, gy: 0, gz: 0,
      src: 'GPS', battery: 85, impact: 0,
      p_dist: 0, Pair_id: 0,
    }, '🏠 Inside zone | GPS | 85% battery');
    await sleep(400);
  }
  console.log('\n  👁️  Dashboard: All 3 pins inside green fence. WorkerPanel → in-zone badge.');
}

async function scenario2_OutOfZone() {
  console.log('\n🔴 SCENARIO 2 — Out-of-Zone Alert');
  console.log('   Demo_Tracker_01 exits fence. Alert fires after 10s delay.');
  divider();
  const a    = accel();
  const base = {
    lat: OUTSIDE_ZONE.lat, lon: OUTSIDE_ZONE.lon,
    ax: a.ax, ay: a.ay, az: a.az,
    gx: 0, gy: 0, gz: 0,
    src: 'GPS', battery: 80, impact: 0,
    p_dist: 0, Pair_id: 0,
  };
  await send('Demo_Tracker_01', base, '🚫 Outside zone — run 1 (tracker initialised)');
  console.log('  ⏳ Waiting 12s for out-of-zone delay to pass...');
  await sleep(12000);
  await send('Demo_Tracker_01', { ...base }, '🚫 Outside zone — run 2 (alert fires now)');
  for (const id of ['Demo_Tracker_02', 'Demo_Tracker_03']) {
    const b = accel();
    await send(id, {
      lat: INSIDE_ZONE.lat, lon: INSIDE_ZONE.lon,
      ax: b.ax, ay: b.ay, az: b.az,
      gx: 0, gy: 0, gz: 0,
      src: 'GPS', battery: 82, impact: 0,
      p_dist: 0, Pair_id: 0,
    }, '🏠 Inside zone | baseline');
    await sleep(300);
  }
  console.log('\n  👁️  Dashboard: 🔔 Bell = 1. AlertsPanel: amber "Out of Zone: Demo_Tracker_01".');
}

async function scenario3_ToleranceEdge() {
  console.log('\n🟡 SCENARIO 3 — Tolerance Edge Case');
  console.log('   Demo_Tracker_01 just outside fence but within ±20m — NO alert expected.');
  divider();
  const a = accel();
  await send('Demo_Tracker_01', {
    lat: EDGE_ZONE.lat, lon: EDGE_ZONE.lon,
    ax: a.ax, ay: a.ay, az: a.az,
    gx: 0, gy: 0, gz: 0,
    src: 'GPS', battery: 78, impact: 0,
    p_dist: 0, Pair_id: 0,
  }, '🟡 Edge of fence (within ±20m tolerance)');
  console.log('\n  👁️  Dashboard: No new alert. Pin near fence edge. Bell count unchanged.');
}

async function scenario4_GreenCorridor() {
  console.log('\n🟩 SCENARIO 4 — Green Corridor Suppression');
  console.log('   Demo_Tracker_01 outside primary fence but inside green corridor → NO alert.');
  divider();
  const a = accel();
  await send('Demo_Tracker_01', {
    lat: 28.5510, lon: 77.2010,
    ax: a.ax, ay: a.ay, az: a.az,
    gx: 0, gy: 0, gz: 0,
    src: 'GPS', battery: 76, impact: 0,
    p_dist: 0, Pair_id: 0,
  }, '🟩 Outside fence but inside green corridor — suppressed');
  console.log('\n  👁️  Dashboard: No new out-of-zone alert. Green corridor suppresses it.');
}

async function scenario5_LowBattery() {
  console.log('\n🔋 SCENARIO 5 — Low Battery');
  console.log('   Demo_Tracker_02 battery drops to 12% (below 20% threshold).');
  divider();
  const a = accel();
  await send('Demo_Tracker_02', {
    lat: INSIDE_ZONE.lat, lon: INSIDE_ZONE.lon,
    ax: a.ax, ay: a.ay, az: a.az,
    gx: 0, gy: 0, gz: 0,
    src: 'GPS', battery: 12, impact: 0,
    p_dist: 0, Pair_id: 0,
  }, '🔋 LOW battery 12%');
  console.log('\n  👁️  Dashboard: WorkerPanel Demo_Tracker_02 card → red battery indicator at 12%.');
}

async function scenario6_Impact() {
  console.log('\n💥 SCENARIO 6 — Impact Detected');
  console.log('   Demo_Tracker_03 sends impact=1 with spiked accelerometer values.');
  divider();
  await send('Demo_Tracker_03', {
    lat: INSIDE_ZONE.lat, lon: INSIDE_ZONE.lon,
    ax: 0.9, ay: 0.8, az: 15.2,
    gx: 0, gy: 0, gz: 0,
    src: 'GPS', battery: 70, impact: 1,
    p_dist: 0, Pair_id: 0,
  }, '💥 IMPACT flag | az spike = 15.2');
  console.log('\n  👁️  Dashboard: Demo_Tracker_03 card → impact indicator. Device Log → high accel.');
}

async function scenario7_Inactivity() {
  console.log('\n😴 SCENARIO 7 — Inactivity Detection');
  console.log('   Demo_Tracker_01 sends identical ax/ay/az 4 times → inactivity alert.');
  divider();
  const base = {
    lat: INSIDE_ZONE.lat, lon: INSIDE_ZONE.lon,
    ax: STATIC_AX, ay: STATIC_AY, az: STATIC_AZ,
    gx: 0, gy: 0, gz: 0,
    src: 'GPS', battery: 75, impact: 0,
    p_dist: 0, Pair_id: 0,
  };
  await send('Demo_Tracker_01', { ...base }, '😴 Static accel — run 1 (motion tracker init)');
  await sleep(2000);
  await send('Demo_Tracker_01', { ...base }, '😴 Static accel — run 2 (inactivity alert expected)');
  await sleep(2000);
  await send('Demo_Tracker_01', { ...base }, '😴 Static accel — run 3 (alert already active)');
  await sleep(2000);
  await send('Demo_Tracker_01', { ...base }, '😴 Static accel — run 4 (alert already active)');
  console.log('\n  👁️  Dashboard: 🔔 Bell += 1. AlertsPanel: orange "Inactivity: Demo_Tracker_01".');
}

async function scenario8_InactivityResolved() {
  console.log('\n🏃 SCENARIO 8 — Inactivity Resolved');
  console.log('   Demo_Tracker_01 large accel delta → motion detected → alert clears.');
  divider();
  await send('Demo_Tracker_01', {
    lat: INSIDE_ZONE.lat, lon: INSIDE_ZONE.lon,
    ax: 850, ay: 720, az: 910,
    gx: 8, gy: 5, gz: 3,
    src: 'GPS', battery: 74, impact: 0,
    p_dist: 0, Pair_id: 0,
  }, '🏃 Large accel delta — movement detected');
  console.log('\n  👁️  Dashboard: Orange inactivity card disappears. Bell badge -= 1.');
}

async function scenario9_CoMovement() {
  console.log('\n👥 SCENARIO 9 — Co-movement Detection');
  console.log('   Demo_Tracker_01 and Demo_Tracker_02 at same coords for 30s+ → alert.');
  divider();
  const loc = {
    lat: INSIDE_ZONE.lat, lon: INSIDE_ZONE.lon,
    gx: 0, gy: 0, gz: 0,
    src: 'GPS', battery: 80, impact: 0,
    p_dist: 2.8, Pair_id: 1,
  };
  console.log('  ⚙️  Run 1 — pair tracker initialised');
  const a1 = accel(), a2 = accel();
  await send('Demo_Tracker_01', { ...loc, ax: a1.ax, ay: a1.ay, az: a1.az }, '👥 Co-located — run 1 (pair init)');
  await sleep(400);
  await send('Demo_Tracker_02', { ...loc, ax: a2.ax, ay: a2.ay, az: a2.az }, '👥 Co-located — run 1 (pair init)');
  console.log('  ⏳ Waiting 32s for co-movement duration threshold...');
  await sleep(32000);
  console.log('  ⚙️  Run 2 — duration passed → alert fires');
  const b1 = accel(), b2 = accel();
  await send('Demo_Tracker_01', { ...loc, ax: b1.ax, ay: b1.ay, az: b1.az }, '👥 Co-located — run 2 (alert expected)');
  await sleep(400);
  await send('Demo_Tracker_02', { ...loc, ax: b2.ax, ay: b2.ay, az: b2.az }, '👥 Co-located — run 2 (alert expected)');
  console.log('\n  👁️  Dashboard: 🔔 Bell += 1. AlertsPanel: blue "Co-movement: Demo_Tracker_01 & 02".');
}

async function scenario10_PeerFallback() {
  console.log('\n📲 SCENARIO 10 — BLE Peer Fallback');
  console.log('   Demo_Tracker_03 GPS failed — using Demo_Tracker_01 peer location via BLE.');
  divider();
  await send('Demo_Tracker_03', {
    lat: INSIDE_ZONE.lat, lon: INSIDE_ZONE.lon,
    ax: 0.1, ay: 0.2, az: 9.8,
    gx: 0, gy: 0, gz: 0,
    src: 'PEER', battery: 65, impact: 0,
    p_dist: 12.4, Pair_id: 1,
  }, '📲 src=PEER | GPS failed | using Demo_Tracker_01 location');
  console.log('\n  👁️  Dashboard: Demo_Tracker_03 card → 🔵 BLE badge instead of 📡 GPS badge.');
}

async function scenario11_SilenceStart() {
  console.log('\n🔇 SCENARIO 11 — Silence Alert Preview');
  console.log('   Final ping from Demo_Tracker_02 — then it goes silent.');
  divider();
  const a = accel();
  await send('Demo_Tracker_02', {
    lat: INSIDE_ZONE.lat, lon: INSIDE_ZONE.lon,
    ax: a.ax, ay: a.ay, az: a.az,
    gx: 0, gy: 0, gz: 0,
    src: 'GPS', battery: 60, impact: 0,
    p_dist: 0, Pair_id: 0,
  }, '🔇 Final ping for Demo_Tracker_02');
  console.log('\n  👁️  Dashboard: Wait 5 min. Then: red "Tracker Silent: Demo_Tracker_02" appears.');
  console.log('  ℹ️  Silence is time-based — triggered by dashboard hook after threshold elapses.');
}

async function scenario12_YardBoundary() {
  console.log('\n🏗️  SCENARIO 12 — Yard Boundary Exit');
  console.log('   Demo_Tracker_01 moves far outside yard. Firmware slows upload to 5min.');
  divider();
  await send('Demo_Tracker_01', {
    lat: YARD_FAR.lat, lon: YARD_FAR.lon,
    ax: 0.3, ay: 0.1, az: 9.8,
    gx: 0, gy: 0, gz: 0,
    src: 'GPS', battery: 72, impact: 0,
    p_dist: 0, Pair_id: 0,
  }, '🏗️  OUTSIDE yard boundary | firmware → 5min upload interval');
  console.log('\n  👁️  Dashboard: Demo_Tracker_01 pin jumps far outside site on map.');
}

async function scenario13_FullRecovery() {
  console.log('\n✅ SCENARIO 13 — Full Recovery');
  console.log('   All demo devices return inside zone, 90% battery, active movement.');
  divider();
  for (const dev of DEVICES) {
    const a = accel();
    await send(dev.id, {
      lat: INSIDE_ZONE.lat, lon: INSIDE_ZONE.lon,
      ax: a.ax, ay: a.ay, az: a.az,
      gx: 0, gy: 0, gz: 0,
      src: 'GPS', battery: 90, impact: 0,
      p_dist: 0, Pair_id: 0,
    }, '✅ Inside zone | GPS | 90% battery | clean');
    await sleep(400);
  }
  console.log('\n  👁️  Dashboard: All 3 pins inside fence. Co-movement alert auto-clears.');
  console.log('  ℹ️  Out-of-zone alert may persist — click X on alert card to clear manually.');
}

// ═════════════════════════════════════════════════════════════════════════════
// RUNNER
// ═════════════════════════════════════════════════════════════════════════════

async function runAll() {
  console.log('═'.repeat(62));
  console.log('  ST-Homer Sprint 1–3 — Full Simulation + Auto-Setup');
  console.log('  Demo devices: Demo_Tracker_01 / 02 / 03');
  console.log('═'.repeat(62));

  console.log('\n  📝 Generating seed.html...');
  const seedPath = writeSeedFile();
  console.log(`  ✅ Written: ${seedPath}`);

  console.log('\n  🌐 Opening seed page in browser...');
  const opened = openInBrowser(seedPath);

  console.log('\n' + '═'.repeat(62));
  console.log('  STEP 1 — Browser auto-seeding');
  console.log('═'.repeat(62));

  if (opened) {
    console.log('\n  ✅ seed.html opened automatically.');
  } else {
    console.log('\n  ⚠️  Could not auto-open. Open manually in Chrome:');
    console.log(`     ${seedPath}`);
  }

  console.log('\n  The seed page will:');
  console.log('  1. Write fences, assignments and settings to localStorage');
  console.log('  2. Auto-redirect to http://localhost:8080 after 2s');
  console.log('\n  Wait for the dashboard to fully load, then come back here.');
  console.log('═'.repeat(62));

  await waitForEnter('  ⏎  Press Enter once dashboard has loaded at localhost:8080... ');

  // ── Warm up with retry ────────────────────────────────────────────────────
  console.log('\n  🔥 Warming up Supabase edge function...');
  let warmed = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const ok = await send('warmup', {
      lat: 0, lon: 0, ax: 0, ay: 0, az: 0,
      gx: 0, gy: 0, gz: 0, src: 'GPS',
      battery: 0, impact: 0, p_dist: 0, Pair_id: 0,
    }, `🔥 Warm-up attempt ${attempt}/5`);
    if (ok) { warmed = true; break; }
    if (attempt < 5) { console.log('  ⏳ Retrying in 4s...'); await sleep(4000); }
  }

  if (warmed) {
    console.log('  ✅ Edge function warm — starting scenarios\n');
    await sleep(1000);
  } else {
    console.log('  ⚠️  Could not warm up. Continuing anyway — sends may partially fail.\n');
  }

  console.log('═'.repeat(62));
  console.log('  STEP 2 — Running 13 simulation scenarios');
  console.log('  Keep your dashboard open and watch in real-time');
  console.log('═'.repeat(62));

  await sleep(1000);

  await scenario1_NormalOperation();      await sleep(3000);
  await scenario2_OutOfZone();            await sleep(3000);
  await scenario3_ToleranceEdge();        await sleep(2000);
  await scenario4_GreenCorridor();        await sleep(2000);
  await scenario5_LowBattery();           await sleep(2000);
  await scenario6_Impact();               await sleep(2000);
  await scenario7_Inactivity();           await sleep(3000);
  await scenario8_InactivityResolved();   await sleep(2000);
  await scenario9_CoMovement();           await sleep(3000);
  await scenario10_PeerFallback();        await sleep(2000);
  await scenario11_SilenceStart();        await sleep(2000);
  await scenario12_YardBoundary();        await sleep(2000);
  await scenario13_FullRecovery();

  divider('═');
  console.log('\n🎉 All 13 scenarios complete!\n');
  console.log('📋 Final expected dashboard state:');
  console.log('   🔔 Bell:  out-of-zone clears on recovery; co-movement clears on separation');
  console.log('   🟠 Silence alert fires 5min after Scenario 11 if Demo_Tracker_02 stays silent');
  console.log('   🗺️  Map:  all 3 pins back inside Sprint3 Test Zone fence');
  console.log('   📊 Log:  all 3 demo devices online with latest coordinates');
  divider('═');

  try { fs.unlinkSync(path.join(__dirname, 'seed.html')); } catch {}
  process.exit(0);
}

runAll().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
