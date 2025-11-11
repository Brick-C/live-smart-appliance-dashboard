# Energy Calculation & Data Flow Guide

## Issue 1: Total Energy Shows 0.001 kWh vs Tuya's 0.50 kWh

### Why This Happens

Your dashboard calculates energy **per session**, while the Tuya app shows **lifetime total**.

```
Tuya App = Total energy consumed by device ever (0.50 kWh)
Dashboard = Energy consumed since dashboard opened (e.g., 0.001 kWh for 5 minutes)
```

### The Calculation (in main.js - line ~205)

```javascript
const deltaMs = newData.timestamp - lastUpdateTimestamp; // Time since last poll
lastUpdateTimestamp = newData.timestamp; // Update timestamp

const powerInKW = newData.watts / 1000; // Convert watts to kW
const timeInHours = deltaMs / 3600000; // Convert ms to hours
const kwh_increment = powerInKW * timeInHours; // kW × hours = kWh

powerData.cumulativeKWh += kwh_increment; // Add to total
```

### Example

**Device: 500W load, API polling every 5 seconds**

```
Every 5 seconds:
  - Time: 5 seconds = 0.00000139 hours
  - kWh: 0.5 kW × 0.00000139 hours = 0.00000069 kWh

After 1 hour (720 polls):
  - ~0.5 kWh accumulated

After 24 hours (non-stop):
  - ~12 kWh accumulated
```

**Your Tuya device has 0.50 kWh total lifetime** → It's been using power for much longer than your dashboard session.

---

## Issue 2: "Today's Cost" & "This Week's Cost" Show "--"

### Root Cause

These values depend on **MongoDB having historical data** to calculate from. If:

- ❌ Dashboard just started
- ❌ No data was stored yet
- ❌ Database query fails
- ❌ Device ID mismatch

Then it shows `$0.00` → displays as `--` in the UI

### How It Works

```
1. processAndRenderData() sends data to MongoDB every 5 seconds
   ↓
   POST /.netlify/functions/store-energy-data
   {
     deviceId: "abc123",
     watts: 500,
     kWh: 0.00069,
     cost: 0.000104,
     timestamp: "2025-11-11T10:30:00Z"
   }

2. updateCostDisplays() fetches data from MongoDB
   ↓
   GET /.netlify/functions/store-energy-data?deviceId=abc123&startTime=...&endTime=...

   Returns: [{watts: 500, kWh: 0.00069, cost: 0.000104, timestamp: ...}, ...]

3. calculateDailyCost() sums the kWh
   ↓
   totalKWh = 0.00069 + 0.00069 + ... (from all readings today)
   cost = totalKWh × electricityRate
```

### Data Structure Stored in MongoDB

**Collection: `energy_readings`**

```javascript
{
  _id: ObjectId(...),
  deviceId: "DEVICE_ID_1",
  watts: 500,              // Current wattage at time of reading
  kWh: 0.00069,           // Energy consumed since last reading
  cost: 0.000104,         // Cost of that kWh (kWh × $rate/kWh)
  timestamp: 2025-11-11T10:30:00.000Z
}
```

---

## Complete Data Flow Architecture

### Real-Time Dashboard (Every 5 seconds)

```
┌─ getRealTimeSmartPlugData()
│  └─ Calls Tuya API for current power (watts)
│
├─ processAndRenderData(data)
│  ├─ Calculate kWh since last poll
│  ├─ Store reading in MongoDB
│  ├─ Update UI: "Current Watts", "Hourly Cost", "Daily Projection"
│  └─ Call updateHistoricalData() and updateAnalytics()
│
├─ updateHistoricalData()
│  └─ Build hourly averages for "Usage Patterns" chart
│
├─ updateAnalytics()
│  └─ Calculate efficiency score and smart tips
│
└─ updateCostDisplays() [called by updateAnalytics()]
   ├─ calculateDailyCost() → Fetch and sum today's readings from DB
   └─ calculateWeeklyCost() → Fetch and sum last 7 days from DB
```

### Summary Section Display

| Element              | Data Source    | Calculated From            | Updated    |
| -------------------- | -------------- | -------------------------- | ---------- |
| **Peak Usage**       | Session memory | `max(powerData.watts)`     | Every poll |
| **Average Usage**    | Session memory | `sum(watts) / count`       | Every poll |
| **Total Energy**     | Session memory | Sum of all `kWh_increment` | Every poll |
| **Total Cost**       | Session memory | `totalKWh × rate`          | Every poll |
| **Today's Cost**     | **MongoDB**    | Today's readings sum       | Every poll |
| **This Week's Cost** | **MongoDB**    | Last 7 days sum            | Every poll |

---

## How to Verify & Debug

### 1. Check Console for Errors

Open **Developer Tools** (F12) → **Console** tab

Look for errors like:

```
Error calculating daily cost: TypeError: Cannot read property 'kWh' of undefined
Failed to calculate daily cost: API Error 500
```

### 2. Check Database Data

In browser console, run:

```javascript
checkDatabaseData();
```

This will log:

- Total records for today
- Total kWh for today
- Total cost for today
- Raw response from database

Expected output:

```
Database response: [{watts: 500, kWh: 0.00069, cost: 0.000104, timestamp: ...}, ...]
Total records: 720  (if running for 1 hour)
Total kWh today: 5.4
Total cost today: $0.81
```

### 3. Verify Data is Being Stored

Check the **Network** tab (F12) when you toggle device or refresh:

Look for:

- `store-energy-data` POST requests (should be every 5 sec, size ~200 bytes)
- Response: `{"message": "Reading stored successfully"}`

### 4. Manual Cost Calculation

```javascript
// In console:
// Get today's total from DB
fetch(
  "/.netlify/functions/store-energy-data?deviceId=DEVICE_ID&startTime=" +
    new Date().toISOString().split("T")[0] +
    "&endTime=" +
    new Date().toISOString()
)
  .then((r) => r.json())
  .then((data) => {
    const kWh = data.reduce((s, r) => s + (r.kWh || 0), 0);
    console.log("Total kWh:", kWh);
    console.log("Cost at $0.15/kWh:", kWh * 0.15);
  });
```

---

## Common Issues & Solutions

### Issue: Shows "$0.00" for Today's Cost

**Possible Causes:**

1. ❌ No data stored in database yet
2. ❌ Device ID doesn't match between frontend and backend
3. ❌ MongoDB connection failing
4. ❌ API timeout (check Network tab)

**Solution:**

- Run `checkDatabaseData()` in console
- Check MongoDB logs in Netlify Functions
- Verify `currentDeviceId` matches device in Tuya

### Issue: Energy keeps increasing after device is off

**Cause:** `resetPowerData()` isn't clearing values correctly

**Solution:** Check that `toggleDevice()` calls `resetPowerData()` after device state changes

### Issue: Tuya shows 0.50 kWh but dashboard shows 0.001 kWh

**This is NORMAL** - Dashboard only counts current session, not lifetime

**To match Tuya:**

- Get the Tuya device's cumulative energy via API
- Load it at dashboard startup
- Continue calculating from there

---

## Database Schema

### Energy Readings Collection

```javascript
db.energy_readings.find().pretty()[
  ({
    _id: ObjectId("..."),
    deviceId: "DEVICE_ID_1",
    watts: 500,
    kWh: 0.00069,
    cost: 0.000104,
    timestamp: ISODate("2025-11-11T10:30:00.000Z"),
  },
  {
    _id: ObjectId("..."),
    deviceId: "DEVICE_ID_1",
    watts: 450,
    kWh: 0.000622,
    cost: 0.0000933,
    timestamp: ISODate("2025-11-11T10:30:05.000Z"),
  })
  // ... one entry every 5 seconds
];
```

### Device Settings Collection

```javascript
db.device_settings.find().pretty()[
  {
    _id: ObjectId("..."),
    deviceId: "DEVICE_ID_1",
    setting: "electricityRate",
    value: 0.15, // $/kWh
    updatedAt: ISODate("2025-11-11T10:00:00.000Z"),
  }
];
```

---

## Summary

✅ **Session Energy (0.001 kWh)** = Time since dashboard opened × power usage
✅ **Today's Cost** = Sum of all readings today from MongoDB × rate
✅ **This Week's Cost** = Sum of all readings (last 7 days) from MongoDB × rate

**Both are correct - just different scopes!**
