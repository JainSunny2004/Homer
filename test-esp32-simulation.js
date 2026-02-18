// test-esp32-simulation.js - ESP32 Cooperative Transmission Simulator
// Now includes all modes: GPS, Peer-only, Cooperative, and Offline

const devices = [
  { id: 'Homing_Tracker_01', lat: 28.5450, lon: 77.1926 },
  { id: 'Homing_Tracker_02', lat: 28.5460, lon: 77.1930 },
  { id: 'Homing_Tracker_03', lat: 28.5455, lon: 77.1928 },
];

let runCount = 0;
const MAX_RUNS = 5; // Increased to 5 runs for more variety

// Scenarios for each run
const scenarios = [
  {
    name: 'Run 1: Normal GPS operation',
    configs: [
      { hasOwnGPS: true, hasPeer: false },  // Device 1: GPS only
      { hasOwnGPS: true, hasPeer: true },   // Device 2: Cooperative
      { hasOwnGPS: true, hasPeer: false },  // Device 3: GPS only
    ]
  },
  {
    name: 'Run 2: Device 1 GPS FAILS - Using Peer!',
    configs: [
      { hasOwnGPS: false, hasPeer: true },  // Device 1: PEER ONLY (GPS failed!)
      { hasOwnGPS: true, hasPeer: true },   // Device 2: Cooperative (helping Device 1)
      { hasOwnGPS: true, hasPeer: false },  // Device 3: GPS only
    ]
  },
  {
    name: 'Run 3: Multiple GPS failures',
    configs: [
      { hasOwnGPS: false, hasPeer: true },  // Device 1: PEER ONLY
      { hasOwnGPS: true, hasPeer: true },   // Device 2: Cooperative (helping others)
      { hasOwnGPS: false, hasPeer: true },  // Device 3: PEER ONLY
    ]
  },
  {
    name: 'Run 4: Device 2 completely offline',
    configs: [
      { hasOwnGPS: true, hasPeer: false },  // Device 1: GPS only
      { hasOwnGPS: false, hasPeer: false }, // Device 2: OFFLINE!
      { hasOwnGPS: true, hasPeer: true },   // Device 3: Cooperative
    ]
  },
  {
    name: 'Run 5: All cooperative',
    configs: [
      { hasOwnGPS: true, hasPeer: true },   // Device 1: Cooperative
      { hasOwnGPS: true, hasPeer: true },   // Device 2: Cooperative
      { hasOwnGPS: true, hasPeer: true },   // Device 3: Cooperative
    ]
  }
];

async function simulateESP32() {
  const scenario = scenarios[runCount];
  console.log(`\n📡 ${scenario.name}:`);
  console.log('━'.repeat(60));
  
  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];
    const config = scenario.configs[i];
    
    // Simulate accelerometer data
    const ax = (Math.random() * 2 - 1).toFixed(2);
    const ay = (Math.random() * 2 - 1).toFixed(2);
    const az = (9.8 + Math.random() * 0.4 - 0.2).toFixed(2);
    
    // Get peer device (next device in array, wrap around)
    const peerDevice = devices[(i + 1) % devices.length];
    
    // Determine location to send
    let displayLat, displayLon, locationSource;
    if (config.hasOwnGPS) {
      displayLat = device.lat;
      displayLon = device.lon;
      locationSource = 'GPS';
    } else if (config.hasPeer) {
      displayLat = peerDevice.lat;
      displayLon = peerDevice.lon;
      locationSource = 'PEER';
    } else {
      displayLat = 0;
      displayLon = 0;
      locationSource = 'NONE';
    }
    
    const url = `https://tmfzkyohyrcnujeipvds.supabase.co/functions/v1/ingest-data?device_id=${device.id}`
      + `&own_lat=${config.hasOwnGPS ? device.lat : 0}`
      + `&own_lon=${config.hasOwnGPS ? device.lon : 0}`
      + `&own_gps_valid=${config.hasOwnGPS ? 1 : 0}`
      + `&peer_lat=${config.hasPeer ? peerDevice.lat : 0}`
      + `&peer_lon=${config.hasPeer ? peerDevice.lon : 0}`
      + `&peer_dist=${config.hasPeer ? (Math.random() * 50 + 10).toFixed(2) : 0}`
      + `&peer_id=${config.hasPeer ? peerDevice.id.match(/\d+/)[0] : 0}`
      + `&peer_valid=${config.hasPeer ? 1 : 0}`
      + `&lat=${displayLat}`
      + `&lon=${displayLon}`
      + `&src=${locationSource}`
      + `&ax=${ax}&ay=${ay}&az=${az}&gx=0&gy=0&gz=0&p_dist=0&Pair_id=0`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtZnpreW9oeXJjbnVqZWlwdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNTU4MjcsImV4cCI6MjA4NjczMTgyN30.-0ZoLx8KuaOnOErljEUv4MvnbY6Wb7wWYwDVBrT0GYA'
        }
      });
      const data = await response.json();
      
      // Status icons
      const gpsIcon = config.hasOwnGPS ? '🟢' : '🔴';
      const peerIcon = config.hasPeer ? '🟢' : '⚫';
      const modeEmoji = config.hasOwnGPS && config.hasPeer ? '⚡' : 
                       config.hasOwnGPS ? '📡' : 
                       config.hasPeer ? '📲' : '❌';
      
      const mode = config.hasOwnGPS && config.hasPeer ? 'COOPERATIVE' :
                   config.hasOwnGPS ? 'GPS ONLY' :
                   config.hasPeer ? 'PEER ONLY (BLE)' : 'OFFLINE';
      
      console.log(`${modeEmoji} ${device.id}: GPS ${gpsIcon} | Peer ${peerIcon} | Mode: ${mode}`);
    } catch (error) {
      console.error(`❌ ${device.id}: ${error.message}`);
    }
    
    // Small delay between devices
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  runCount++;
  
  if (runCount >= MAX_RUNS) {
    console.log('\n' + '━'.repeat(60));
    console.log(`🎉 Test completed! ${MAX_RUNS} scenarios finished.`);
    console.log('✅ All modes demonstrated: GPS, Peer-only, Cooperative, and Offline');
    console.log('━'.repeat(60));
    process.exit(0);
  }
}

// Run every 8 seconds, stop after MAX_RUNS
const interval = setInterval(simulateESP32, 8000);
simulateESP32(); // Run immediately

console.log('🚀 ESP32 Cooperative Transmission Test Started!');
console.log('📊 Simulating all modes including GPS failures and BLE fallback...');
console.log('━'.repeat(60));
