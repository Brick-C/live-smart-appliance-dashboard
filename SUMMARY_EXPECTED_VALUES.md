# Summary Tab - Expected Values Reference

## Quick Answer to Your Question

### What Value Should You See in Yesterday's Summary?

**Answer:** The **complete 24-hour totals for yesterday (00:00 to 23:59)**

---

## Example: Real Usage Scenario

### Assuming Device Used:

**Yesterday (Full Day Nov 11):**

- Device ran for 8 hours
- Average power: 200W
- Total consumption: 1.6 kWh per hour × 8 = 8 kWh
- Cost: 8 kWh × 9.5 ৳/kWh = **৳76.00**
- Peak moment: 600W

**Today (Nov 12 - So Far):**

- Device has been running 2 hours
- Average power: 800W
- Total consumption: 0.8 kWh × 2 = 1.6 kWh
- Cost: 1.6 kWh × 9.5 ৳/kWh = **৳15.20**
- Peak so far: 800W

---

## What You Should See in Summary Section

### TODAY Tab (Selected by Default)

```
┌─────────────────────────────┐
│ SUMMARY                     │
├─────────────────────────────┤
│ Peak Usage:     800 W       │
│ Average Usage:  750 W       │
│ Total Energy:   1.600 kWh   │
│ Total Cost:     ৳15.20      │
│ Today's Cost:   ৳15.20      │
│ This Week's:    ৳95.00      │
└─────────────────────────────┘

TIMEFRAME: [Today] [Yesterday] [Last 7] [Last 30]
```

### YESTERDAY Tab (After Clicking)

```
┌─────────────────────────────┐
│ SUMMARY                     │
├─────────────────────────────┤
│ Peak Usage:     600 W       │
│ Average Usage:  200 W       │
│ Total Energy:   8.000 kWh   │
│ Total Cost:     ৳76.00      │
│ Today's Cost:   [greyed]    │
│ This Week's:    [greyed]    │
└─────────────────────────────┘

TIMEFRAME: [Today] [Yesterday] [Last 7] [Last 30]
```

### Cost Insights (Shows Comparison)

```
┌─────────────────────────────┐
│ COST INSIGHTS               │
├─────────────────────────────┤
│ Today vs Yesterday: -80%    │ ← NEW! Was "No previous data"
│ Monthly Projection: ৳432   │
└─────────────────────────────┘
```

---

## Value Calculations

### How "Today vs Yesterday" is Calculated:

**Formula:**

```
Comparison = ((Today's Cost / Yesterday's Cost) - 1) × 100
```

**Example 1:**

```
Today's cost so far: ৳15.20
Yesterday's total:  ৳76.00
Comparison: ((15.20 / 76) - 1) × 100 = -80%
```

**Example 2 (If today is MORE):**

```
Today's cost so far: ৳25.00
Yesterday's total:  ৳20.00
Comparison: ((25 / 20) - 1) × 100 = +25%
```

---

## Different Timeframe Examples

### LAST 7 DAYS Example

```
Day 1 (Nov 5):  5 kWh  → ৳47.50
Day 2 (Nov 6):  6 kWh  → ৳57.00
Day 3 (Nov 7):  4 kWh  → ৳38.00
Day 4 (Nov 8):  7 kWh  → ৳66.50
Day 5 (Nov 9):  8 kWh  → ৳76.00
Day 6 (Nov 10): 5 kWh  → ৳47.50
Day 7 (Nov 11): 8 kWh  → ৳76.00
              ────────────────
Total:        43 kWh  → ৳408.50

Summary Shows:
  Peak Usage:     850 W
  Average Usage:  350 W
  Total Energy:   43.000 kWh
  Total Cost:     ৳408.50
```

### LAST 30 DAYS Example

```
30 days × average 5 kWh = 150 kWh total
150 kWh × 9.5 ৳/kWh = ৳1,425.00

Summary Shows:
  Peak Usage:     900 W
  Average Usage:  350 W
  Total Energy:   150.000 kWh
  Total Cost:     ৳1,425.00
```

---

## Timeline: What Loads When

### On Page Load (First Time):

```
T0: Page opens
    ↓
T1: Load today's data (00:00 - now)
T2: Load yesterday's data (00:00 - 23:59 previous day)
T3: Load last 7 days
T4: Display TODAY tab by default
    ↓
Result: Summary shows TODAY with yesterday available for comparison
```

### When User Clicks "Yesterday":

```
User clicks "Yesterday" tab
    ↓
Display yesterday's data (already loaded)
    ↓
Summary updates to show:
  - Yesterday's peak
  - Yesterday's average
  - Yesterday's total kWh
  - Yesterday's total cost
```

---

## Key Numbers to Expect

### Peak Usage

- Today: Actual maximum watts since 12:00 AM
- Yesterday: Maximum watts from entire day
- Usually lower for yesterday (full day vs partial day)

### Average Usage

- Today: Average of (readings taken today) / (count)
- Yesterday: Average of (all readings yesterday) / 24 hours of data
- Should be similar if same time of day

### Total Energy (kWh)

- Today: Accumulating (increases every 5 seconds if device is ON)
- Yesterday: Fixed number (complete 24 hours)
- Yesterday number is usually higher (full day vs partial day)

### Total Cost

- Today: Increases every 5 seconds (based on kWh × rate)
- Yesterday: Fixed number (complete 24 hours)
- Currency: **৳** (Bangladeshi Taka)

---

## Common Scenarios

### Scenario 1: Device Never Used Yesterday

```
Today tab: Normal values
Yesterday tab:
  Peak Usage:     0 W
  Average Usage:  0 W
  Total Energy:   0.000 kWh
  Total Cost:     ৳0.00

Cost Insights: "No previous data" (because no consumption)
```

### Scenario 2: Device Always Running

```
Today tab (8:00 AM):
  - 8 hours accumulated
  - Peak: 100W (consistent)
  - Average: 100W
  - Energy: 0.8 kWh
  - Cost: ৳7.60

Yesterday tab:
  - Full 24 hours
  - Peak: 100W
  - Average: 100W
  - Energy: 2.4 kWh
  - Cost: ৳22.80

Comparison: -67% (8 hours vs 24 hours)
```

### Scenario 3: Device Just Turned ON

```
Today tab (just turned ON):
  - 1 minute accumulated
  - Peak: 50W
  - Average: 50W
  - Energy: 0.0008 kWh
  - Cost: ৳0.01

Yesterday tab:
  - Full 24 hours
  - Peak: 100W
  - Average: 100W
  - Energy: 2.4 kWh
  - Cost: ৳22.80

Comparison: -99%+ (almost nothing vs full day)
```

---

## Reality Check

### If Yesterday Shows:

```
├─ Peak: 600W
├─ Avg: 200W
├─ Energy: 8 kWh
└─ Cost: ৳76.00
```

**This means:**

- ✅ Device actually used that much
- ✅ Data was saved to database
- ✅ Calculations are correct
- ✅ Rate is 9.5 ৳/kWh (8 kWh × 9.5 = 76)

### If Yesterday Shows:

```
├─ Peak: 0W
├─ Avg: 0W
├─ Energy: 0 kWh
└─ Cost: ৳0.00
```

**This means:**

- Device was OFF all day
- Or data wasn't saved yesterday
- Both are normal

---

## What Changes Every 5 Seconds

**TODAY tab updates:**

- Peak Usage (if new max reached)
- Average Usage (new average calculated)
- Total Energy (keeps increasing)
- Total Cost (keeps increasing)

**YESTERDAY tab:**

- Stays the same (yesterday is complete)
- Never changes

**LAST 7 DAYS tab:**

- Updates as today's data adds to rolling 7-day

---

## Database Query Times

### Querying Yesterday:

```javascript
// Yesterday Nov 11, 2025
startTime: "2025-11-11T00:00:00.000Z"  (00:00 Bangladesh time)
endTime:   "2025-11-12T00:00:00.000Z"  (00:00 next day)

Result: All readings from yesterday
```

### Querying Today:

```javascript
// Today Nov 12, 2025
startTime: "2025-11-12T00:00:00.000Z"  (00:00 Bangladesh time)
endTime:   "2025-11-12T14:00:00.000Z"  (current time)

Result: All readings from today so far
```

---

## After Reload, You Should See

✅ Summary shows TODAY by default
✅ "Today vs Yesterday" shows percentage (not "No previous data")
✅ Clicking "Yesterday" shows different values
✅ All costs show `৳` symbol
✅ Values update every 5 seconds (for today only)
✅ Charts update when timeframe changes

**That's it! You're done!** 🎉
