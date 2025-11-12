# Yesterday's Summary Fix - Technical Analysis

## Problem Explanation

### What You're Currently Seeing ❌

- Summary section only shows TODAY's data
- "Today vs Yesterday" in Cost Insights shows "No previous data"
- Yesterday tab doesn't work
- All historical timeframes show current data

### What You Should Be Seeing ✅

#### If it's 2:00 PM today and device used 10 kWh:

```
Summary displays:
  Today (as of now):
    Peak Usage: 800W
    Average Usage: 250W
    Total Energy: 10 kWh
    Total Cost: ৳95.00

  Yesterday (full day):
    Peak Usage: 600W
    Average Usage: 200W
    Total Energy: 8 kWh
    Total Cost: ৳76.00

Cost Insights:
  "Today vs Yesterday: +25%" (because 95 > 76)
```

---

## Root Causes

### Issue 1: Yesterday's Data Not Fetched from Database ❌

**Currently:**

- Only today's data is fetched in `changeDevice()`
- Yesterday's data is only stored in browser localStorage
- If browser cache is cleared, yesterday's data is lost
- First time loading the page, no yesterday data exists

**Should be:**

- Query database for yesterday's data (00:00 to 23:59)
- Query database for today's data (00:00 to now)
- Display both in summary

### Issue 2: updateHistoricalView() Has API Issues ❌

**Problem:**

- `getHourlyData()` doesn't accept date parameter but code tries to pass it
- Function signature: `getHourlyData(deviceId)`
- Code calls: `getHourlyData(currentDeviceId, yesterday)` ← Extra parameter ignored!

**Should be:**

- Accept date parameters
- Query correct date range from API
- Support yesterday, last7, last30 queries

### Issue 3: Summary Not Updating Based on Timeframe ❌

**Currently:**

- Summary section always shows current in-memory data
- Changing timeframe selector doesn't update summary
- Summary and historical charts are disconnected

**Should be:**

- When user selects "Yesterday", summary shows yesterday's stats
- When user selects "Last 7 Days", summary shows weekly aggregate
- When user selects "Last 30 Days", summary shows monthly aggregate

### Issue 4: Cost Comparison Not Working ❌

**In updateDailySummary():**

```javascript
document.getElementById("cost-comparison").textContent = analytics.dailyData
  .yesterday.length
  ? `${(...).toFixed(1)}%`
  : "No previous data";
```

**Problem:**

- `analytics.dailyData.yesterday` is an array of cost readings
- Only gets populated if page was loaded yesterday
- Never fetches from database
- Always shows "No previous data" on fresh page load

---

## Data Flow (What SHOULD Happen)

### On Page Load:

```
1. User loads dashboard
2. loadDevices() loads device list
3. changeDevice() triggers:
   - Fetch today's data: 00:00 - 23:59 (today)
   - Fetch yesterday's data: 00:00 - 23:59 (yesterday)
   - Fetch last 7 days
   - Store all in analytics.dailyData
4. Display summary for TODAY by default
```

### When User Changes Timeframe:

```
1. User clicks "Yesterday" tab
2. updateHistoricalView() triggers
3. Display summary for YESTERDAY instead
4. Update all charts for YESTERDAY
5. Update cost insights
```

### When User Switches Device:

```
1. User selects Device 2
2. changeDevice() triggers
3. Fetch Device 2's data (today + yesterday + 7 days)
4. Display Device 2's summary
```

---

## What Database Returns

### API Call for Yesterday:

```
GET /.netlify/functions/store-energy-data?
  deviceId=device_1
  startTime=2025-11-11T00:00:00Z
  endTime=2025-11-11T23:59:59Z

Response: [
  { timestamp: "2025-11-11T00:05:00Z", watts: 100, kWh: 0.008, cost: 0.076 },
  { timestamp: "2025-11-11T00:10:00Z", watts: 150, kWh: 0.012, cost: 0.114 },
  ...
  { timestamp: "2025-11-11T23:55:00Z", watts: 50, kWh: 0.004, cost: 0.038 }
]
```

### Summary Calculation for Yesterday:

```
Peak: max(watts) = 600W
Average: sum(watts)/count = 200W
Total kWh: sum(kWh) = 8 kWh
Total Cost: sum(cost) = 76 BDT
```

---

## Example Values You Should See

### Assuming Device Used:

- Today: 5 hours so far @ 800W average = 4 kWh
- Yesterday: 8 hours active = 8 kWh

### Summary Should Display:

**Today Tab (Current):**

```
Peak Usage: 800W (right now)
Average Usage: 800W (average of today so far)
Total Energy: 4.000 kWh (today's accumulation)
Total Cost: ৳38.00 (4 kWh × 9.5 ৳/kWh)
```

**Yesterday Tab:**

```
Peak Usage: 600W (yesterday's peak)
Average Usage: 200W (yesterday's average)
Total Energy: 8.000 kWh (yesterday's total)
Total Cost: ৳76.00 (8 kWh × 9.5 ৳/kWh)
```

**Last 7 Days Tab:**

```
Peak Usage: 850W (7-day peak)
Average Usage: 350W (7-day average)
Total Energy: 56.000 kWh (7-day total)
Total Cost: ৳532.00
```

**Last 30 Days Tab:**

```
Peak Usage: 900W (30-day peak)
Average Usage: 300W (30-day average)
Total Energy: 216.000 kWh (30-day total)
Total Cost: ৳2,052.00
```

**Cost Insights - Today vs Yesterday:**

```
If today's cost so far: ৳38.00
If yesterday's cost: ৳76.00
Comparison: -50% (using 50% less than yesterday at this time)
```

---

## Required Fixes

### Fix 1: Load All Historical Data on Device Change ✅ NEEDED

- Fetch today's data (00:00 - now)
- Fetch yesterday's data (00:00 - 23:59)
- Fetch last 7 days
- Fetch last 30 days
- Store in separate objects

### Fix 2: Update getHourlyData() Function ✅ NEEDED

- Add date parameter support
- Query specific date ranges
- Return proper data format

### Fix 3: Make updateHistoricalView() Work ✅ NEEDED

- Load correct data for selected timeframe
- Update summary statistics
- Update charts
- Update cost insights

### Fix 4: Update updateDailySummary() ✅ NEEDED

- Accept timeframe parameter
- Calculate stats from selected period
- Display correct values
- Show cost comparison

### Fix 5: Fix Currency Symbols ✅ NEEDED

- Change `$` to `৳` in historical-data.js

---

## Summary Table: What Each Timeframe Should Show

| Timeframe | Date Range               | Peak              | Average         | Total kWh       | Total Cost      |
| --------- | ------------------------ | ----------------- | --------------- | --------------- | --------------- |
| Today     | 00:00 - Now              | Current day's max | Current day avg | Sum today       | Sum today       |
| Yesterday | 00:00 - 23:59 (prev day) | Yesterday's max   | Yesterday avg   | Yesterday total | Yesterday total |
| Last 7    | 7 days ago - Now         | 7-day max         | 7-day avg       | 7-day sum       | 7-day sum       |
| Last 30   | 30 days ago - Now        | 30-day max        | 30-day avg      | 30-day sum      | 30-day sum      |

---

## Database Query Examples

### Get Today's Data (From 00:00 to Now):

```javascript
const today = new Date();
const startOfDay = new Date(
  today.getFullYear(),
  today.getMonth(),
  today.getDate()
);
const now = new Date();

fetch(`/.netlify/functions/store-energy-data?
  deviceId=${deviceId}
  &startTime=${startOfDay.toISOString()}
  &endTime=${now.toISOString()}`);
```

### Get Yesterday's Data (00:00 to 23:59):

```javascript
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const startOfYesterday = new Date(
  yesterday.getFullYear(),
  yesterday.getMonth(),
  yesterday.getDate()
);
const endOfYesterday = new Date(
  yesterday.getFullYear(),
  yesterday.getMonth(),
  yesterday.getDate() + 1
);

fetch(`/.netlify/functions/store-energy-data?
  deviceId=${deviceId}
  &startTime=${startOfYesterday.toISOString()}
  &endTime=${endOfYesterday.toISOString()}`);
```

### Get Last 7 Days:

```javascript
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - 7);

fetch(`/.netlify/functions/store-energy-data?
  deviceId=${deviceId}
  &startTime=${startDate.toISOString()}
  &endTime=${endDate.toISOString()}`);
```

---

## Next Steps

1. **Update historical-data.js** to fix currency symbols ($ → ৳)
2. **Update getHourlyData()** to accept date parameters
3. **Update updateHistoricalView()** to load correct data
4. **Update updateDailySummary()** to work with timeframes
5. **Load yesterday's data on page load** in changeDevice()
