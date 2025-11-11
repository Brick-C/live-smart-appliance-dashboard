# Troubleshooting Guide: Dashboard Issues

## Problem: "Today's Cost" and "This Week's Cost" Show $0.00

### Step 1: Check Console for Errors

1. Open your dashboard
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Look for red error messages

### Common Errors

#### Error: "Cannot read property 'kWh' of undefined"

```
This means the database query returned data in wrong format
or returned null/empty array
```

**Fix:**

1. Run in console: `checkDatabaseData()`
2. Look for output - if empty, no data in database yet
3. Wait 5-10 seconds, run again

#### Error: "TypeError: response.json is not a function"

```
This means API didn't return JSON
Usually a 500 or 404 error from the function
```

**Fix:**

1. Check Network tab (F12)
2. Look for requests to `store-energy-data`
3. Click on failed request to see error message

### Step 2: Verify Database Connection

In browser console, run:

```javascript
// Check if data is being stored
fetch("/.netlify/functions/store-energy-data?deviceId=YOUR_DEVICE_ID")
  .then((r) => {
    console.log("Status:", r.status);
    return r.json();
  })
  .then((data) => {
    console.log("Data:", data);
    console.log("Count:", data.length);
    if (data.length > 0) {
      console.log("First reading:", data[0]);
      console.log(
        "Sample kWh values:",
        data.slice(0, 3).map((d) => d.kWh)
      );
    }
  })
  .catch((e) => console.error("Error:", e));
```

**Expected Output:**

```
Status: 200
Data: Array(720)  // If running for ~1 hour
[
  {watts: 500, kWh: 0.00069, cost: 0.000104, timestamp: "..."},
  {watts: 500, kWh: 0.00069, cost: 0.000104, timestamp: "..."},
  ...
]
```

**If you get 0 records:**

- Dashboard just started (need to wait 5-10 minutes for data to accumulate)
- Device ID mismatch
- MongoDB connection failing

### Step 3: Check Device ID

In console, run:

```javascript
console.log("Current Device ID:", currentDeviceId);
console.log("All Devices:", devices);

// Check if they match what's in database
```

**Device IDs must be EXACT match** between:

- ✓ Tuya API response
- ✓ Selector dropdown
- ✓ What gets stored in MongoDB
- ✓ What you query for

### Step 4: Manual Cost Calculation

If database has data but cost won't display, calculate manually:

```javascript
// Get today's readings
fetch(
  "/.netlify/functions/store-energy-data?" +
    new URLSearchParams({
      deviceId: currentDeviceId,
      startTime: new Date().toISOString().split("T")[0] + "T00:00:00Z",
      endTime: new Date().toISOString().split("T")[0] + "T23:59:59Z",
    })
)
  .then((r) => r.json())
  .then((data) => {
    const totalKwh = data.reduce((s, r) => s + (r.kWh || 0), 0);
    const rate = parseFloat(document.getElementById("electricity-rate").value);
    const cost = totalKwh * rate;

    console.log("Total kWh today:", totalKwh);
    console.log("Rate:", rate + "/kWh");
    console.log("Cost:", "$" + cost.toFixed(2));
    console.log("Should display:", "$" + cost.toFixed(2));
  });
```

---

## Problem: Energy Usage Much Lower Than Tuya

### Root Cause

Dashboard shows session energy only. Tuya shows device lifetime energy.

### Example Timeline

```
Monday: Device starts being used (unknown when)
  - Tuya shows: 0.50 kWh (since device purchase)

Tuesday 10:00 AM: You open dashboard
  - Dashboard shows: 0.001 kWh (5 minutes of session)

Tuesday 11:00 AM: Still on dashboard
  - Dashboard shows: 0.5 kWh (1 hour of session) ✓ NOW MATCHES TUYA!

Tuesday 3:00 PM: Still on dashboard
  - Dashboard shows: 5.0 kWh (5 hours of session)
  - Tuya shows: 0.50 kWh ← STILL SHOWS DEVICE LIFETIME
```

### Solution Options

#### Option A: Wait for Session to Match

Just keep dashboard open. Eventually your session energy will equal Tuya's.

#### Option B: Load Device's Lifetime Energy at Startup

Modify `main.js` to fetch device lifetime from Tuya on load:

```javascript
// In window.onload, before setting up polls:
async function getDeviceLifetimeEnergy() {
  try {
    // This would require Tuya API support for lifetime data
    const response = await fetch(
      "/.netlify/functions/get-smart-plug-data?deviceId=" + currentDeviceId
    );
    const data = await response.json();

    // If Tuya returns lifetime data, use it
    if (data.lifetimeKWh) {
      powerData.cumulativeKWh = data.lifetimeKWh;
    }
  } catch (e) {
    console.error("Could not load lifetime energy:", e);
  }
}
```

#### Option C: Only Show Database Total (Not Session)

Change the "Total Energy" display to calculate from database:

```javascript
async function getTotalEnergyFromDB() {
  const allTime = await fetch(
    "/.netlify/functions/store-energy-data?deviceId=" + currentDeviceId
  ).then((r) => r.json());

  return allTime.reduce((s, r) => s + (r.kWh || 0), 0);
}
```

---

## Problem: Costs Don't Update When I Change Electricity Rate

### Check If Change Saved

```javascript
// In console:
console.log("Current rate in JS:", electricityRate);
console.log("In localStorage:", localStorage.getItem("electricityRate"));
console.log(
  "In HTML input:",
  document.getElementById("electricity-rate").value
);
```

All three should match.

### Force Update

```javascript
// In console:
updateElectricityRate(0.2); // Change to your rate
updateCostDisplays(); // Recalculate all costs
```

### Make It Persistent

The rate should auto-save when you change the input:

```html
<!-- In index.html, this should call updateElectricityRate on change -->
<input
  type="number"
  id="electricity-rate"
  onchange="updateElectricityRate(this.value)"
/>
```

Verify this `onchange` attribute exists and the function is called.

---

## Problem: Database Queries Return Empty

### Check Network Tab

1. Open DevTools → Network tab
2. Refresh page
3. Look for requests to `store-energy-data`

### Expected Requests

```
✓ Every 5 seconds: POST store-energy-data (stores reading) - 200 OK
✓ On page load: GET store-energy-data (loads today's data) - 200 OK
✓ When cost displays update: GET store-energy-data (calc costs) - 200 OK
```

### If Requests Are 503 or 504

Database connection timeout. Check:

1. **MongoDB URI** - Is it set in Netlify environment variables?

   ```
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true
   ```

2. **Network connectivity** - Can Netlify reach MongoDB?

   - Check MongoDB IP whitelist (should allow AWS/Netlify IPs)
   - Check connection string is correct

3. **Database exists** - `energy_monitor` database must exist
   ```bash
   # In MongoDB Atlas:
   # Collections: energy_readings, device_settings
   ```

### If Requests Return [] (Empty Array)

Database is working but has no data.

**Normal for first 5-10 minutes** after opening dashboard.

**Check if anything is being stored:**

```javascript
// In console - wait 30 seconds, then run:
checkDatabaseData();
```

If still empty after 1 minute:

- POST requests aren't being sent (check Network tab)
- POST requests are failing silently (check error handling)
- Data is being deleted (check MongoDB directly)

---

## Problem: Charts Not Showing

### Power Chart (Real-time watts)

Should show line graph with live updates every 5 seconds.

**Fix:**

```javascript
// In console:
console.log("Chart data:", powerChart.data);
console.log("Watts array:", powerData.watts);
console.log("Labels:", powerData.labels);

// Manually update:
powerChart.update();
```

### Energy Chart (kWh per poll)

Should show bar chart with energy per interval.

**Fix:**

```javascript
// In console:
console.log("Energy data:", powerChart.data.datasets[0].data);
console.log("kWh increments:", powerData.kwh);

// Rebuild chart:
energyChart.data.labels = powerData.labels;
energyChart.data.datasets[0].data = powerData.kwh;
energyChart.update();
```

### Usage Patterns Chart (hourly average)

Should show typical usage by hour of day.

**Only appears after 1+ hour** of data collection.

**Fix:**

```javascript
// In console:
console.log("Hourly data:", historicalData.hourlyData);
console.log("Patterns chart data:", patternsChart.data.datasets[0].data);

// Rebuild if needed:
patternsChart.update();
```

---

## Network Tab Quick Reference

### What You Should See

```
Every 5 seconds:
  POST /.netlify/functions/store-energy-data
    Status: 200
    Size: ~200 bytes
    Response: {"message": "Reading stored successfully"}

Every time costs display updates (or page load):
  GET /.netlify/functions/store-energy-data?deviceId=...&startTime=...&endTime=...
    Status: 200
    Size: varies (1KB - 100KB depending on records)
    Response: [{...}, {...}, ...] array of readings

First page load:
  GET /.netlify/functions/get-smart-plug-data?action=list
    Status: 200
    Response: [{id: "...", name: "..."}, ...]

Every 5 seconds (real-time):
  GET /.netlify/functions/get-smart-plug-data?deviceId=...
    Status: 200
    Response: {watts: 500, timestamp: ..., energy: {...}}
```

### If You See 500, 502, 503, 504

**5xx errors** = Server error, not your fault

**Check:**

1. Netlify Functions deployment successful
2. Environment variables set (MONGODB_URI, TUYA_ACCESS_ID, TUYA_ACCESS_SECRET)
3. MongoDB connection string is valid
4. Database collections exist

---

## Quick Diagnostic Script

Copy-paste this into browser console to get a full diagnostic:

```javascript
async function fullDiagnostic() {
  console.log("=== DASHBOARD DIAGNOSTIC ===\n");

  // 1. Device Info
  console.log("1. DEVICE INFO");
  console.log("  Current Device:", currentDeviceId);
  console.log("  Available Devices:", devices);

  // 2. Session Energy
  console.log("\n2. SESSION DATA");
  console.log("  Cumulative kWh:", powerData.cumulativeKWh);
  console.log("  Watts readings:", powerData.watts.length);
  console.log("  Electricity Rate:", electricityRate);

  // 3. Database Data
  console.log("\n3. DATABASE CHECK");
  try {
    const dbData = await fetch(
      "/.netlify/functions/store-energy-data?deviceId=" + currentDeviceId
    ).then((r) => r.json());
    console.log("  Records in DB:", dbData.length);
    if (dbData.length > 0) {
      const totalKwh = dbData.reduce((s, r) => s + (r.kWh || 0), 0);
      const totalCost = totalKwh * electricityRate;
      console.log("  Total kWh:", totalKwh);
      console.log("  Total Cost:", "$" + totalCost.toFixed(2));
    }
  } catch (e) {
    console.error("  DB Error:", e.message);
  }

  // 4. UI Elements
  console.log("\n4. UI ELEMENTS");
  console.log(
    "  Today Cost Element:",
    document.getElementById("today-cost").textContent
  );
  console.log(
    "  Week Cost Element:",
    document.getElementById("week-cost").textContent
  );
  console.log(
    "  Total kWh Element:",
    document.getElementById("total-kwh").textContent
  );
  console.log(
    "  Total Cost Element:",
    document.getElementById("total-cost").textContent
  );

  // 5. Charts
  console.log("\n5. CHARTS");
  console.log("  Power Chart Points:", powerChart.data.datasets[0].data.length);
  console.log(
    "  Energy Chart Points:",
    energyChart.data.datasets[0].data.length
  );
  console.log(
    "  Patterns Chart Points:",
    patternsChart.data.datasets[0].data.length
  );

  console.log("\n=== END DIAGNOSTIC ===");
}

// Run it:
fullDiagnostic();
```

---

## Still Not Working?

### Check Netlify Function Logs

1. Go to Netlify Dashboard
2. Site Settings → Functions
3. Click on function name (e.g., `store-energy-data`)
4. View recent logs
5. Look for error messages

### Enable Verbose Logging

Add to `store-energy-data.js`:

```javascript
console.log("Received:", { deviceId, watts, kWh, cost });
console.log("MongoDB URI exists:", !!process.env.MONGODB_URI);
```

### Test API Directly

In terminal:

```bash
# Test store function
curl -X GET "https://your-netlify-site.netlify.app/.netlify/functions/store-energy-data?deviceId=abc123"

# Test with curl POST
curl -X POST "https://your-netlify-site.netlify.app/.netlify/functions/store-energy-data" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"abc123","watts":500,"kWh":0.00069,"cost":0.000104}'
```

### Contact Support With This Info

If still broken, save and share:

1. Output of `fullDiagnostic()`
2. Netlify Functions logs
3. Network tab HAR file (export under Network tab)
4. Browser console errors (screenshots)
5. Device ID being used
