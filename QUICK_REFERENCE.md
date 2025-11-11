# Quick Reference: Energy Calculation Summary

## The Two Numbers You're Confused About

### Why Tuya Shows 0.50 kWh but Dashboard Shows 0.001 kWh

```
┌──────────────────────────────┐
│  TUYA APP (Lifetime View)    │
├──────────────────────────────┤
│  Device purchased 5 days ago │
│  Total energy ever used:     │
│  0.50 kWh (LIFETIME TOTAL)   │
└──────────────────────────────┘
           ≠ (NOT EQUAL TO)
┌──────────────────────────────┐
│ DASHBOARD (Session View)     │
├──────────────────────────────┤
│ Dashboard opened 5 minutes   │
│ ago. Energy used since then: │
│ 0.001 kWh (SESSION ONLY)     │
└──────────────────────────────┘

BOTH CORRECT!
Just measuring different things.

To match Tuya:
Keep dashboard open for ~1+ hour
```

---

## How Each Number is Calculated

### Session Energy (in main.js - "Total Energy" display)

```javascript
// Updated every 5 seconds

const deltaMs = newData.timestamp - lastUpdateTimestamp; // Time since last poll
const powerInKW = newData.watts / 1000; // Watts → kW
const timeInHours = deltaMs / 3600000; // ms → hours
const kwh_increment = powerInKW * timeInHours; // kW × hours = kWh

powerData.cumulativeKWh += kwh_increment; // Running total
```

**Example: 500W device, 5-second interval**

```
Each poll adds: (500/1000) × (5/3600000) = 0.00069 kWh
After 1 hour (720 polls): 0.00069 × 720 = 0.5 kWh ✓
After 24 hours: 0.5 × 24 = 12 kWh
```

### Today's Cost (in cost-calculator.js - from MongoDB)

```javascript
// 1. Query MongoDB for today's readings
const readings = fetch('/.netlify/functions/store-energy-data', {
  deviceId: currentDeviceId,
  startTime: "2025-11-11T00:00:00Z",
  endTime: "2025-11-11T23:59:59Z"
})

// 2. Sum all kWh
const totalKWh = readings.reduce((sum, r) => sum + r.kWh, 0)

// 3. Multiply by rate
const todayCost = totalKWh × electricityRate
```

**Example: 12 readings stored with 0.5 kWh each**

```
Total kWh = 0.5 × 12 = 6 kWh
Cost at $0.15/kWh = 6 × 0.15 = $0.90
Display: "Today's Cost: $0.90"
```

---

## Data Flow in 30 Seconds

```
┌────────────────────────────────────────────────────┐
│  1. DEVICE SENDS POWER                             │
│     Tuya API: "Device is drawing 500W"             │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  2. CALCULATE ENERGY PER POLL                      │
│     5 seconds @ 500W = 0.00069 kWh                │
│     Store: {watts: 500, kWh: 0.00069}             │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  3. SEND TO DATABASE (MongoDB)                     │
│     POST /.netlify/functions/store-energy-data     │
│     Body: {deviceId, watts, kWh, cost, timestamp}  │
└────────────────────────────────────────────────────┘
                      ↓
┌────────────────────────────────────────────────────┐
│  4. UPDATE DASHBOARD DISPLAYS                      │
│                                                    │
│   Session Values (from memory):                    │
│   • Current Watts: 500 W                           │
│   • Total Energy: (sum of kWh_increments)          │
│   • Hourly Cost: watts/1000 × rate                 │
│                                                    │
│   Historical Values (from database):               │
│   • Today's Cost: (sum today's kWh) × rate        │
│   • This Week's Cost: (sum 7-day kWh) × rate      │
└────────────────────────────────────────────────────┘
```

---

## Side-by-Side Comparison

| Aspect              | Session Energy            | Today's Cost              |
| ------------------- | ------------------------- | ------------------------- |
| **Data Source**     | Browser memory            | MongoDB database          |
| **Time Scope**      | Since page loaded         | Since 00:00 today         |
| **When Cleared**    | Never (session continues) | Every midnight            |
| **Calculated When** | Every 5 seconds           | Every 5 seconds (updated) |
| **Formula**         | `Σ(kWh_increment)`        | `Σ(today's kWh) × rate`   |
| **Shows**           | 0.001 kWh                 | $0.42                     |
| **Why Different**   | Measures session          | Measures full day         |

---

## Typical Timeline

```
T=0:00  Dashboard opens
        • Session Energy: 0 kWh
        • Today's Cost: $0.00 (no DB data yet)

T=0:05  First reading stored
        • Session Energy: 0.00069 kWh
        • Today's Cost: $0.000010 (rounding to display)

T=5:00  5 minutes of data collected
        • Session Energy: 0.069 kWh
        • Today's Cost: $0.010 ✓ NOW VISIBLE

T=1:00  1 hour of data
        • Session Energy: 0.5 kWh ✓ MATCHES TUYA
        • Today's Cost: $0.075

T=24:00 Full day
        • Session Energy: 12 kWh
        • Today's Cost: $1.80
```

---

## What You're Looking At

```
┌─────────────────────────────────────────────────────┐
│         ENERGY MONITOR DASHBOARD                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  LIVE METRICS (Real-time, from this session)       │
│  ├─ Current Power: 500 W ← Updated every 5 sec    │
│  ├─ Total Energy: 0.001 kWh ← Since you opened it │
│  ├─ Hourly Cost: $0.075/hr ← Projected            │
│  └─ Daily Projection: $1.80 ← Full 24 hours       │
│                                                    │
│  SUMMARY (Mixed: session + database)              │
│  ├─ Peak Usage: 500 W ← From session memory       │
│  ├─ Average Usage: 500 W ← From session memory    │
│  ├─ Total Energy: 0.001 kWh ← From session       │
│  ├─ Total Cost: $0.00015 ← From session          │
│  ├─ TODAY'S COST: $0.42 ← FROM DATABASE ✓        │
│  └─ THIS WEEK'S COST: $2.85 ← FROM DATABASE ✓    │
│                                                    │
└─────────────────────────────────────────────────────┘
```

**The "TODAY'S COST" and "THIS WEEK'S COST" values**
come from MongoDB and represent actual energy usage
stored in the database, NOT just this session.

---

## Expected Values After Common Time Periods

**Assuming: 500W constant draw, $0.15/kWh rate**

| Time Elapsed | Session kWh | Hourly Cost | Daily Projection | Today's Cost (DB) |
| ------------ | ----------- | ----------- | ---------------- | ----------------- |
| 5 minutes    | 0.042       | $0.075/hr   | $1.80            | $0.006\*          |
| 30 minutes   | 0.25        | $0.075/hr   | $1.80            | $0.038\*          |
| 1 hour       | 0.5         | $0.075/hr   | $1.80            | $0.075\*          |
| 8 hours      | 4.0         | $0.075/hr   | $1.80            | $0.60             |
| 24 hours     | 12.0        | $0.075/hr   | $1.80            | $1.80             |

\* Small values due to rounding in display

---

## Debugging Tip

Open browser console and run:

```javascript
checkDatabaseData();
```

This will show:

- Total records in database TODAY
- Total kWh accumulated
- Total cost so far
- And verify database connection

**If you see records** → Database is working ✓
**If you see 0 records** → Wait 10 minutes or check MongoDB connection ✗

---

## Key Takeaway

```
┌─────────────────────────────────────────────┐
│  TWO SOURCES OF TRUTH                       │
├─────────────────────────────────────────────┤
│                                             │
│  1. THIS SESSION (Memory)                   │
│     └─ Only what's happened since page load │
│     └─ Examples: Current Watts, Peak Usage  │
│                                             │
│  2. DATABASE (MongoDB)                      │
│     └─ Everything stored from device        │
│     └─ Examples: Today's Cost, Week's Cost  │
│                                             │
│  THEY ARE DIFFERENT ON PURPOSE!             │
│  Each serves a different purpose.           │
│                                             │
└─────────────────────────────────────────────┘
```

Your dashboard is working correctly.
The values just measure different things.
