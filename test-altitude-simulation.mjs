// test-altitude-simulation.mjs
// Verifies Z-axis (altitude) feature: colour-coded markers + Elevation Panel
import https from 'https';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_HOST = 'tmfzkyohyrcnujeipvds.supabase.co';
const SUPABASE_PATH = '/functions/v1/ingest-data';
const AUTH_KEY      = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtZnpreW9oeXJjbnVqZWlwdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNTU4MjcsImV4cCI6MjA4NjczMTgyN30.-0ZoLx8KuaOnOErljEUv4MvnbY6Wb7wWYwDVBrT0GYA';

// Four demo devices, one per altitude band
const DEVICES = [
  { id: 'Alt_Tracker_01', label: 'Worker A — Ground',   altitude: 1.5,  band: 'Ground (<4 m)',    color: '🟢' },
  { id: 'Alt_Tracker_02', label: 'Worker B — Level 1',  altitude: 5.8,  band: 'Level 1 (4–8 m)',  color: '🟡' },
  { id: 'Alt_Tracker_03', label: 'Worker C — Level 2',  altitude: 9.2,  band: 'Level 2 (8–12 m)', color: '🟠' },
  { id: 'Alt_Tracker_04', label: 'Worker D — Level 3+', altitude: 14.7, band: 'Level 3+ (≥12 m)',  color: '🔴' },
];

// Spread workers slightly so they don't stack on the map
const BASE_LAT = 28.5450;
const BASE_LON = 77.1925;
const OFFSETS  = [
  { lat: 0.0000, lon: 0.0000 },
  { lat: 0.0002, lon: 0.0003 },
  { lat: 0.0004, lon: -0.0002 },
  { lat: -0.0002, lon: 0.0004 },
];

const KEYS = {
  fences:      'polygon-fences',
  assignments: 'worker-assignments',
  settings:    'manager-settings',
};

const TEST_FENCE = {
  id: 'alt-test-fence',
  name: 'Altitude Test Zone',
  coordinates: [
    { lat: 28.5440, lng: 77.1910 },
    { lat: 28.5465, lng: 77.1910 },
    { lat: 28.5465, lng: 77.1945 },
    { lat: 28.5440, lng: 77.1945 },
  ],
  color: '#84994F',
  shiftStart: '00:00',
  shiftEnd: '23:59',
  toleranceMeters: 20,
  isGreenCorridor: false,
};

const TEST_ASSIGNMENTS = DEVICES.map((d, i) => ({
  id: `alt-assignment-0${i + 1}`,
  workerId: d.id,
  fenceId: TEST_FENCE.id,
  jobLabel: d.label,
}));

const TEST_SETTINGS = {
  deviceTimeoutSeconds: 120,
  outOfZoneAlertDelaySeconds: 30,
  breakDurationValue: 15,
  breakDurationUnit: 'minutes',
  breakStartTime: '13:00',
  inactivityThresholdMinutes: 5,
  inactivityBreakExtendMinutes: 15,
  silenceAlertMinutes: 10,
  coMovementThresholdMeters: 10,
  coMovementDurationSeconds: 60,
  shiftChangeTime: '02:00',
  shiftChangeWindowMinutes: 5,
  autoRefreshIntervalSeconds: 3,
  defaultMapZoom: 17,
  showOfflineDevices: true,
};

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function httpsGet(qs) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: SUPABASE_HOST,
      path: `${SUPABASE_PATH}?${qs}`,
      method: 'GET',
      headers: { Authorization: AUTH_KEY },
      timeout: 10000,
      rejectUnauthorized: false,
      family: 4,
    }, res => { res.resume(); resolve(res.statusCode); });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

async function send(deviceId, params, tag) {
  const qs = Object.entries({ device_id: deviceId, ...params })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  try {
    const status = await httpsGet(qs);
    const icon   = status === 200 ? '✅' : `⚠️  HTTP ${status}`;
    console.log(`  ${icon}  ${deviceId.padEnd(20)} │ ${tag}`);
    return status === 200;
  } catch (err) {
    console.log(`  ❌  ${deviceId.padEnd(20)} │ ${tag} — ${err.message}`);
    return false;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function divider(c = '─', n = 64) { console.log(c.repeat(n)); }

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

// ─── Seed helper ──────────────────────────────────────────────────────────────

function writeSeedAndOpen() {
  const fences      = JSON.stringify([TEST_FENCE]).replace(/'/g, "\\'");
  const assignments = JSON.stringify(TEST_ASSIGNMENTS).replace(/'/g, "\\'");
  const settings    = JSON.stringify(TEST_SETTINGS).replace(/'/g, "\\'");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Altitude Test Seed</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Courier New',monospace;background:#0f172a;color:#94a3b8;
      display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px}
    .card{background:#1e293b;border:1px solid #334155;border-radius:12px;
      padding:32px 40px;text-align:center;min-width:420px}
    .title{color:#e2e8f0;font-size:1.1rem;font-weight:bold;margin-bottom:20px}
    .ok{color:#22c55e;font-size:1.2rem;font-weight:bold}
    .rows{margin-top:16px;text-align:left;font-size:0.8rem;color:#475569;line-height:2}
    .rows span{color:#c3f832}
    .bar{width:100%;height:4px;background:#0f172a;border-radius:2px;margin-top:20px;overflow:hidden}
    .fill{height:100%;background:#84994F;border-radius:2px;animation:fill 2s linear forwards}
    @keyframes fill{from{width:0%}to{width:100%}}
  </style>
</head>
<body>
  <div class="card">
    <div class="title">🏗️ Altitude Test Seeder</div>
    <div class="ok" id="status">⏳ Seeding...</div>
    <div class="rows" id="rows"></div>
    <div class="bar"><div class="fill"></div></div>
  </div>
  <script>
    try {
      localStorage.setItem('${KEYS.fences}',      '${fences}');
      localStorage.setItem('${KEYS.assignments}',  '${assignments}');
      localStorage.setItem('${KEYS.settings}',     '${settings}');
      document.getElementById('status').textContent = '✅ Seeded!';
      document.getElementById('rows').innerHTML =
        '🟢 <span>Alt_Tracker_01</span> — Ground (1.5 m)<br>' +
        '🟡 <span>Alt_Tracker_02</span> — Level 1 (5.8 m)<br>' +
        '🟠 <span>Alt_Tracker_03</span> — Level 2 (9.2 m)<br>' +
        '🔴 <span>Alt_Tracker_04</span> — Level 3+ (14.7 m)';
      setTimeout(() => { window.location.href = 'http://localhost:8080'; }, 2000);
    } catch(e) {
      document.getElementById('status').textContent = '❌ ' + e.message;
    }
  </script>
</body>
</html>`;

  const filePath = path.join(__dirname, 'seed-altitude.html');
  fs.writeFileSync(filePath, html, 'utf8');

  const url = `file:///${filePath.replace(/\\/g, '/')}`;
  try {
    if (process.platform === 'win32') execSync(`start "" "${url}"`);
    else if (process.platform === 'darwin') execSync(`open "${url}"`);
    else execSync(`xdg-open "${url}"`);
    return true;
  } catch { return false; }
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

async function scenarioA_AllBands() {
  console.log('\n🏗️  SCENARIO A — All Four Altitude Bands');
  console.log('   Each tracker reports a different altitude band simultaneously.');
  divider();

  for (let i = 0; i < DEVICES.length; i++) {
    const dev = DEVICES[i];
    const off = OFFSETS[i];
    await send(dev.id, {
      lat: BASE_LAT + off.lat,
      lon: BASE_LON + off.lon,
      ax: 0.1, ay: 0.1, az: 9.8,
      src: 'GPS', battery: 85, impact: 0,
      p_dist: 0, Pair_id: 0,
      alt: dev.altitude,
    }, `${dev.color} alt=${dev.altitude}m | ${dev.band}`);
    await sleep(300);
  }

  console.log('\n  👁️  What to check on the dashboard:');
  console.log('   • MAP: 4 pins in different colours — green, yellow, orange, red');
  console.log('   • Click each pin → InfoWindow shows altitude badge + band label');
  console.log('   • ⛰️  Mountain icon (top-right header) → open Elevation Panel');
  console.log('   • Elevation Panel: bar chart with 4 bars at correct heights');
  console.log('   • Elevation Panel: floor reference lines at 0m, 4m, 8m, 12m');
  console.log('   • Elevation Panel: height diff table e.g. A↔D = 13.2m');
}

async function scenarioB_SameFloor() {
  console.log('\n📐 SCENARIO B — Two Workers on Same Floor');
  console.log('   Alt_Tracker_01 and Alt_Tracker_02 both at ~6m (Level 1).');
  console.log('   Height diff should be near 0. 3D ≈ 2D distance.');
  divider();

  await send('Alt_Tracker_01', {
    lat: BASE_LAT, lon: BASE_LON,
    ax: 0.2, ay: 0.1, az: 9.8,
    src: 'GPS', battery: 80, impact: 0,
    p_dist: 0, Pair_id: 0,
    alt: 6.0,
  }, '🟡 alt=6.0m | Level 1');
  await sleep(300);

  await send('Alt_Tracker_02', {
    lat: BASE_LAT + 0.0002, lon: BASE_LON + 0.0003,
    ax: 0.1, ay: 0.2, az: 9.7,
    src: 'GPS', battery: 78, impact: 0,
    p_dist: 0, Pair_id: 0,
    alt: 6.3,
  }, '🟡 alt=6.3m | Level 1');

  console.log('\n  👁️  What to check:');
  console.log('   • Both pins yellow (same band)');
  console.log('   • Elevation Panel: height diff ≈ 0.3m, 3D dist ≈ horizontal dist');
}

async function scenarioC_MaxHeightDiff() {
  console.log('\n⬆️  SCENARIO C — Maximum Height Separation');
  console.log('   Alt_Tracker_01 at ground (1m), Alt_Tracker_04 at roof (18m).');
  console.log('   Height diff = 17m. 3D distance >> 2D distance.');
  divider();

  await send('Alt_Tracker_01', {
    lat: BASE_LAT, lon: BASE_LON,
    ax: 0.1, ay: 0.1, az: 9.8,
    src: 'GPS', battery: 90, impact: 0,
    p_dist: 0, Pair_id: 0,
    alt: 1.0,
  }, '🟢 alt=1.0m | Ground');
  await sleep(300);

  await send('Alt_Tracker_04', {
    lat: BASE_LAT + 0.0001, lon: BASE_LON + 0.0001,
    ax: 0.2, ay: 0.1, az: 9.9,
    src: 'GPS', battery: 72, impact: 0,
    p_dist: 0, Pair_id: 0,
    alt: 18.0,
  }, '🔴 alt=18.0m | Level 3+');

  console.log('\n  👁️  What to check:');
  console.log('   • Alt_Tracker_01 green pin, Alt_Tracker_04 red pin');
  console.log('   • Elevation Panel: pair shows Δh ≈ 17m at the top of the diff table');
  console.log('   • 3D dist is much larger than 2D dist (which is ~15m horizontally)');
}

async function scenarioD_NoAltitude() {
  console.log('\n❓ SCENARIO D — Device Without Altitude (Old Firmware)');
  console.log('   Alt_Tracker_02 sends data with no alt param (simulates old hardware).');
  divider();

  await send('Alt_Tracker_02', {
    lat: BASE_LAT + 0.0002, lon: BASE_LON + 0.0003,
    ax: 0.3, ay: 0.2, az: 9.7,
    src: 'GPS', battery: 75, impact: 0,
    p_dist: 0, Pair_id: 0,
    // no alt param
  }, '⬜ no alt sent | backward-compat test');

  console.log('\n  👁️  What to check:');
  console.log('   • Alt_Tracker_02 pin turns grey (altitude unknown band)');
  console.log('   • Click pin → InfoWindow shows "Altitude Unknown" grey badge');
  console.log('   • Elevation Panel shows the note: "Some devices not reporting altitude"');
}

async function scenarioE_AltitudeUpdate() {
  console.log('\n🔄 SCENARIO E — Worker Moving Between Floors');
  console.log('   Alt_Tracker_03 climbs from ground → Level 1 → Level 2 in 3 steps.');
  divider();

  const steps = [
    { alt: 1.5, band: 'Ground', color: '🟢' },
    { alt: 5.0, band: 'Level 1', color: '🟡' },
    { alt: 9.5, band: 'Level 2', color: '🟠' },
  ];

  for (const step of steps) {
    await send('Alt_Tracker_03', {
      lat: BASE_LAT + 0.0004, lon: BASE_LON - 0.0002,
      ax: 0.2, ay: 0.3, az: 9.8,
      src: 'GPS', battery: 68, impact: 0,
      p_dist: 0, Pair_id: 0,
      alt: step.alt,
    }, `${step.color} alt=${step.alt}m | ${step.band}`);
    console.log(`  ⏳ Waiting 4s for dashboard to refresh...`);
    await sleep(4000);
  }

  console.log('\n  👁️  What to check:');
  console.log('   • Watch Alt_Tracker_03 pin change colour: green → yellow → orange');
  console.log('   • Elevation Panel bar updates height in real-time');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runAll() {
  divider('═');
  console.log('  ST-Homer — Altitude (Z-axis) Feature Simulation');
  console.log('  Tests: colour-coded markers + Elevation Panel');
  divider('═');

  console.log('\n  📝 Writing seed file and opening browser...');
  const opened = writeSeedAndOpen();
  if (opened) {
    console.log('  ✅ seed-altitude.html opened. It will seed localStorage');
    console.log('     and redirect to http://localhost:8080 in 2 seconds.');
  } else {
    console.log('  ⚠️  Could not auto-open. Open manually:');
    console.log(`     ${path.join(__dirname, 'seed-altitude.html')}`);
  }

  console.log('\n  Once the dashboard loads:');
  console.log('  1. Log in as manager');
  console.log('  2. Keep the map visible');
  console.log('  3. Click the ⛰️  Mountain icon in the header to open the Elevation Panel');
  divider('═');

  await waitForEnter('  ⏎  Press Enter once the dashboard is loaded and Elevation Panel is open... ');

  console.log('\n  🔥 Warming up edge function...');
  for (let i = 1; i <= 3; i++) {
    const ok = await send('warmup', {
      lat: 0, lon: 0, ax: 0, ay: 0, az: 0,
      src: 'GPS', battery: 0, impact: 0, p_dist: 0, Pair_id: 0,
    }, `🔥 Warm-up ${i}/3`);
    if (ok) break;
    await sleep(3000);
  }

  divider('═');
  console.log('  Running altitude scenarios — watch the dashboard in real-time');
  divider('═');

  await scenarioA_AllBands();
  await waitForEnter('\n  ⏎  Verified Scenario A? Press Enter for next... ');

  await scenarioB_SameFloor();
  await waitForEnter('\n  ⏎  Verified Scenario B? Press Enter for next... ');

  await scenarioC_MaxHeightDiff();
  await waitForEnter('\n  ⏎  Verified Scenario C? Press Enter for next... ');

  await scenarioD_NoAltitude();
  await waitForEnter('\n  ⏎  Verified Scenario D? Press Enter for next... ');

  await scenarioE_AltitudeUpdate();

  divider('═');
  console.log('\n✅  All altitude scenarios complete!\n');
  console.log('📋 Summary of what was verified:');
  console.log('   A — All 4 altitude bands render with correct marker colours');
  console.log('   B — Same-floor workers show near-zero height diff');
  console.log('   C — Max separation: Δh & 3D dist shown correctly in panel');
  console.log('   D — Old firmware (no alt) shows grey marker + unknown badge');
  console.log('   E — Live floor change updates marker colour in real-time');
  divider('═');

  try { fs.unlinkSync(path.join(__dirname, 'seed-altitude.html')); } catch {}
  process.exit(0);
}

runAll().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
