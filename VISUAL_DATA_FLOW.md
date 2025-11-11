# Visual Guide: Dashboard Data Flow

## Timeline: How Energy Accumulates

```
SESSION 1 (Dashboard Opened)
├─ T=0:00   → Device power: 500W
│           → kWh this session: 0 kWh
│           → DB stored: 1 reading
│
├─ T=0:05   → Device power: 500W
│           → Added 0.00069 kWh (500W × 5sec/3600000)
│           → kWh this session: 0.00069 kWh
│           → DB stored: 2 readings
│
├─ T=0:10   → Device power: 500W
│           → Added 0.00069 kWh
│           → kWh this session: 0.00138 kWh
│           → DB stored: 3 readings
│
├─ T=1:00   → After 1 hour of continuous 500W
│           → kWh this session: 0.5 kWh ✓ MATCHES TUYA!
│           → DB stored: 720 readings
│           → Today's Cost = 0.5 kWh × $0.15 = $0.075
│
└─ T=24:00  → After 24 hours of continuous 500W
            → kWh this session: 12 kWh
            → DB stored: 17,280 readings
            → Today's Cost = 12 kWh × $0.15 = $1.80
```

## What Each Display Shows

```
┌─────────────────────────────────────────────────────────────────┐
│                    LIVE METRICS SECTION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Power Draw: 500 W  ← From Tuya API (real-time)               │
│                                                                 │
│  Total Energy: 0.001 kWh  ← From session memory                │
│  [This dashboard session only]                                 │
│  = Sum of all kWh_increment since page loaded                 │
│                                                                 │
│  Hourly Cost: $0.075/hr  ← Calculated from current power      │
│  = (watts / 1000) × rate/kWh                                   │
│  = (500 / 1000) × $0.15 = $0.075                              │
│                                                                 │
│  Daily Projection: $1.80  ← Projected for full 24 hours       │
│  = (currentDayCost) + (hourlyCost × hoursRemaining)           │
│  = $0.00 + ($0.075 × 24) = $1.80                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               SUMMARY SECTION (from MongoDB)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Peak Usage: 500 W  ← max(powerData.watts) from session       │
│                                                                 │
│  Average Usage: 500 W  ← mean of all watts from session       │
│                                                                 │
│  Total Energy: 0.001 kWh  ← sum of all kWh_increment         │
│                                                                 │
│  Total Cost: $0.00015  ← Total Energy × rate                  │
│  = 0.001 kWh × $0.15                                          │
│                                                                 │
│  *** TODAY'S COST: $0.42 ***  ← FROM DATABASE                │
│  [All readings stored since 00:00 today]                      │
│  = SELECT SUM(kWh) FROM readings WHERE timestamp TODAY        │
│    THEN multiply by electricity rate                           │
│                                                                 │
│  *** THIS WEEK'S COST: $2.85 ***  ← FROM DATABASE            │
│  [All readings stored in last 7 days]                         │
│  = SELECT SUM(kWh) FROM readings WHERE timestamp LAST 7 DAYS  │
│    THEN multiply by electricity rate                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why Tuya Shows 0.50 kWh vs Dashboard 0.001 kWh

```
TUYA APP                          DASHBOARD
(Lifetime View)                   (Session View)

Device connected 5 days ago       Dashboard opened 2 minutes ago
Total power used: 0.50 kWh        Power this session: 0.001 kWh

DIFFERENT TIME SCOPES!

To match:
- Close and reopen dashboard after 5 days of use
- Or fetch Tuya's lifetime reading on dashboard startup
```

## Data Storage Illustration

```
Device Power Draw Over 1 Hour (500W constant)

┌─────────────────────────────────────────────────────────┐
│ MEMORY (Session Data)                                   │
├─────────────────────────────────────────────────────────┤
│ powerData.cumulativeKWh = 0.5 kWh                      │
│ powerData.watts = [500, 500, 500, ...]                 │
│ powerData.kwh = [0.00069, 0.00069, ...]                │
│ powerData.labels = ["10:00", "10:05", ...]             │
└─────────────────────────────────────────────────────────┘

         ↓↓↓ STORED IN DATABASE ↓↓↓

┌─────────────────────────────────────────────────────────┐
│ MONGODB: energy_readings Collection                    │
├─────────────────────────────────────────────────────────┤
│ Reading 1: {watts: 500, kWh: 0.00069, ...}             │
│ Reading 2: {watts: 500, kWh: 0.00069, ...}             │
│ Reading 3: {watts: 500, kWh: 0.00069, ...}             │
│ ... (one entry every 5 seconds = 720 readings/hour)    │
│ Reading 720: {watts: 500, kWh: 0.00069, ...}           │
│                                                        │
│ SUM(kWh) = 720 × 0.00069 = 0.5 kWh                    │
│ SUM(cost) = 0.5 × 0.15 = $0.075 (for 1 hour)         │
└─────────────────────────────────────────────────────────┘

         ↓↓↓ RETRIEVED BY ↓↓↓

┌─────────────────────────────────────────────────────────┐
│ calculateDailyCost() / calculateWeeklyCost()            │
├─────────────────────────────────────────────────────────┤
│ Fetches all readings from today (or last 7 days)       │
│ Sums up all the kWh values                             │
│ Multiplies by electricityRate                          │
│ Returns total cost for display                         │
└─────────────────────────────────────────────────────────┘
```

## API Request/Response Cycle (Every 5 Seconds)

```
1. FETCH REAL-TIME DATA
   GET /.netlify/functions/get-smart-plug-data?deviceId=abc123

   Response:
   {
     "watts": 500,
     "device": {...},
     "timestamp": 1731308400000,
     "energy": {
       "kW": 0.5,
       "ratePerKWh": 0.15,
       "hourlyCost": 0.075,
       "projectedDailyCost": 1.8
     }
   }

2. STORE IN DATABASE
   POST /.netlify/functions/store-energy-data
   Body:
   {
     "deviceId": "abc123",
     "watts": 500,
     "kWh": 0.00069,
     "cost": 0.000104
   }

   Response:
   {
     "message": "Reading stored successfully"
   }

3. UPDATE CALCULATIONS
   updateAnalytics(newData)
   updateHistoricalData(newData)
   updateCostDisplays()

4. FETCH TODAY'S DATA (on demand)
   GET /.netlify/functions/store-energy-data
   ?deviceId=abc123
   &startTime=2025-11-11T00:00:00Z
   &endTime=2025-11-11T23:59:59Z

   Response: [{watts: 500, kWh: 0.00069, ...}, {...}, ...]

   Process:
   - Sum all kWh values: 0.5 kWh
   - Multiply by rate: 0.5 × 0.15 = $0.075
   - Display: "Today's Cost: $0.075"
```

## Energy Calculation Formula

```
FOR EACH 5-SECOND POLL:

  Δt (time elapsed) = current timestamp - last timestamp  [milliseconds]

  P (power)          = watts received from Tuya API       [watts]

  kWh_increment      = (P / 1000) × (Δt / 3,600,000)     [kilowatt-hours]

  DETAILED:
  ┌─────────────────────────────────────────┐
  │ P / 1000           = Power in kilowatts │
  │ Δt / 3,600,000     = Time in hours      │
  │ kW × hours = kWh   = Energy consumed    │
  └─────────────────────────────────────────┘

EXAMPLE (500W device, 5 second interval):

  kWh = (500W / 1000) × (5000ms / 3,600,000)
      = 0.5 kW × 0.00000139 hours
      = 0.00000069 kWh
      ≈ 0.00069 kWh per 5 seconds

ACCUMULATION:

  After 5 sec:   0.00069 kWh
  After 10 sec:  0.00138 kWh
  After 1 min:   0.00415 kWh
  After 1 hour:  0.5 kWh ✓
  After 24 hrs:  12 kWh ✓
```

## Debug Checklist

```
□ Device appears in selector
  └─ GET /.netlify/functions/get-smart-plug-data?action=list

□ Power reading updating (changes every 5 sec)
  └─ GET /.netlify/functions/get-smart-plug-data

□ Data storing in database (check Network tab)
  └─ POST /.netlify/functions/store-energy-data (every 5 sec)

□ Session energy accumulating
  └─ powerData.cumulativeKWh should increase by ~0.00069/5sec

□ Today's Cost showing value (not $0.00)
  └─ Run checkDatabaseData() in console
  └─ Verify data returned from query
  └─ Check if electricityRate set correctly

□ Charts updating
  └─ powerChart and energyChart should animate
  └─ patternsChart should build over time
```
