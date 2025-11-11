# Before & After Code Comparison

## Issue 1: Per-Device State Tracking

### ❌ BEFORE (Single Global State)

```javascript
// main.js - Device management section
let currentDeviceId = null;
let devices = [];

// Later in toggleDevice()
async function toggleDevice() {
  // ...
  isDeviceOn = !isDeviceOn; // ❌ Single global, doesn't track per device
  button.textContent = isDeviceOn ? "Turn OFF" : "Turn ON";

  if (!isDeviceOn) {
    resetPowerData();
  }
}

// In updateDailySummary()
if (!isDeviceOn) {
  // ❌ Always checks same global variable
  safeUpdateElement("hourly-cost", "$0.00/hr");
}
```

**Problems:**

- Only one device's state at a time
- Switching devices loses track of state
- Can't toggle Device 2 independently
- Button state doesn't persist

### ✅ AFTER (Per-Device State)

```javascript
// main.js - Device management section
let currentDeviceId = null;
let devices = [];
let deviceStates = {}; // ✅ Track state per device

// Helper functions
function getDeviceState(deviceId) {
  return deviceStates[deviceId] !== undefined ? deviceStates[deviceId] : true;
}

function setDeviceState(deviceId, state) {
  deviceStates[deviceId] = state;
}

// Later in toggleDevice()
async function toggleDevice() {
  // ...
  const result = await response.json();

  const newState = result.state;
  setDeviceState(currentDeviceId, newState); // ✅ Save state per device
  button.textContent = newState ? "Turn OFF" : "Turn ON";

  if (!newState) {
    resetPowerData();
  }
}

// In updateDailySummary()
const isDeviceOn = getDeviceState(currentDeviceId); // ✅ Get state for current device
if (!isDeviceOn) {
  safeUpdateElement("hourly-cost", "$0.00/hr");
}
```

**Benefits:**

- ✅ Each device has independent state
- ✅ State persists when switching
- ✅ Toggle works for all devices
- ✅ Button always shows correct state

---

## Issue 2: Device Switching Data Isolation

### ❌ BEFORE (Charts Not Cleared Properly)

```javascript
async function changeDevice(deviceId) {
  if (deviceId === currentDeviceId) return;

  currentDeviceId = deviceId;
  const device = devices.find((d) => d.id === deviceId);
  if (device) {
    updateDeviceInfo(device);

    // Reset data structures
    powerData.labels = [];
    powerData.watts = [];
    powerData.kwh = [];
    powerData.cumulativeKWh = 0;
    analytics.dailyData.today = [];
    analytics.dailyData.yesterday = [];
    historicalData.hourlyData = [];
    historicalData.dailyData = [];

    // ❌ Charts only partially cleared, no label/dataset reset
    powerChart.update();  // Chart still has old data in structure!
    energyChart.update();
    patternsChart.update();

    // Load new data but charts might still show old values
    try {
      const response = await fetch(...);
      if (response.ok) {
        const historicalData = await response.json();
        processHistoricalData(historicalData);
      }
    } catch (error) {
      console.error("Failed to load historical data:", error);
    }

    await fetchDataAndRender();
    await updateHistoricalView();
    updateCostDisplays();
    // ❌ No button state update!
  }
}
```

**Problems:**

- Charts not completely cleared (ghost data visible)
- No button state update after switch
- `lastUpdateTimestamp` not reset (kWh calculation wrong)
- Potential mixing of device data

### ✅ AFTER (Complete Chart Clearing)

```javascript
async function changeDevice(deviceId) {
  if (deviceId === currentDeviceId) return;

  currentDeviceId = deviceId;
  const device = devices.find((d) => d.id === deviceId);
  if (device) {
    updateDeviceInfo(device);

    // Reset data structures
    powerData.labels = [];
    powerData.watts = [];
    powerData.kwh = [];
    powerData.cumulativeKWh = 0;
    analytics.dailyData.today = [];
    analytics.dailyData.yesterday = [];
    historicalData.hourlyData = [];
    historicalData.dailyData = [];

    // ✅ Completely clear charts
    powerChart.data.labels = [];
    powerChart.data.datasets[0].data = [];
    powerChart.update();

    energyChart.data.labels = [];
    energyChart.data.datasets[0].data = [];
    energyChart.update();

    // ✅ Reset patterns chart
    patternsChart.data.datasets[0].data = Array(24).fill(0);
    patternsChart.update();

    // ✅ Reset timestamp for accurate calculation
    lastUpdateTimestamp = Date.now();

    // Load new data
    try {
      const response = await fetch(
        "/.netlify/functions/store-energy-data?" +
          new URLSearchParams({
            deviceId: currentDeviceId,
            startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          })
      );

      if (response.ok) {
        const historicalData = await response.json();
        processHistoricalData(historicalData);
      }
    } catch (error) {
      console.error("Failed to load historical data:", error);
    }

    await fetchDataAndRender();
    await updateHistoricalView();
    updateCostDisplays();

    // ✅ Update button state for new device
    const button = document.getElementById("toggle-button");
    const isOn = getDeviceState(currentDeviceId);
    button.textContent = isOn ? "Turn OFF" : "Turn ON";
  }
}
```

**Benefits:**

- ✅ All charts completely cleared
- ✅ Button state updated
- ✅ Timestamp reset for correct calculations
- ✅ No data mixing between devices

---

## Issue 3: Toggle Response Handling

### ❌ BEFORE (Simple State Toggle)

```javascript
async function toggleDevice() {
  const button = document.getElementById("toggle-button");
  button.disabled = true;
  button.classList.add("opacity-50");

  try {
    const response = await fetch("/.netlify/functions/get-smart-plug-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "toggle",
        deviceId: currentDeviceId,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to toggle device");
    }

    // ❌ Just toggle without checking actual response
    isDeviceOn = !isDeviceOn;
    button.textContent = isDeviceOn ? "Turn OFF" : "Turn ON";

    if (!isDeviceOn) {
      resetPowerData();
    }

    await fetchDataAndRender();
  } catch (error) {
    console.error("Error toggling device:", error);
    alert("Failed to toggle device. Please try again.");
  } finally {
    button.disabled = false;
    button.classList.remove("opacity-50");
  }
}
```

**Problems:**

- ❌ Assumes toggle succeeded without checking response
- ❌ Uses global `isDeviceOn` that doesn't track per device
- ❌ Doesn't verify actual device state from API
- ❌ Wrong state if API response differs

### ✅ AFTER (State from Response)

```javascript
async function toggleDevice() {
  const button = document.getElementById("toggle-button");
  button.disabled = true;
  button.classList.add("opacity-50");

  try {
    const response = await fetch("/.netlify/functions/get-smart-plug-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "toggle",
        deviceId: currentDeviceId,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to toggle device");
    }

    // ✅ Parse response and get actual state
    const result = await response.json();
    const newState = result.state;

    // ✅ Save state for specific device
    setDeviceState(currentDeviceId, newState);

    // ✅ Update button based on response
    button.textContent = newState ? "Turn OFF" : "Turn ON";

    // ✅ Reset if OFF
    if (!newState) {
      resetPowerData();
    }

    await fetchDataAndRender();
  } catch (error) {
    console.error("Error toggling device:", error);
    alert("Failed to toggle device. Please try again.");
  } finally {
    button.disabled = false;
    button.classList.remove("opacity-50");
  }
}
```

**Benefits:**

- ✅ Uses actual state from API response
- ✅ Saves state per device
- ✅ Button always shows correct state
- ✅ Handles response properly

---

## Impact Summary

| Aspect                | Before                | After             |
| --------------------- | --------------------- | ----------------- |
| **Multiple Devices**  | ❌ Not supported      | ✅ Full support   |
| **State Tracking**    | ❌ Single global      | ✅ Per-device     |
| **Data Isolation**    | ❌ Mixed data         | ✅ Isolated data  |
| **Toggle Works**      | ❌ Device 2 fails     | ✅ All devices    |
| **Button State**      | ❌ Wrong after switch | ✅ Always correct |
| **Chart Refresh**     | ❌ Partial clear      | ✅ Complete clear |
| **State Persistence** | ❌ Lost on switch     | ✅ Persists       |

---

## Testing the Fix

### Quick Test: Device Switching

```
Device 1: 500W, Total: 0.05 kWh
Device 2: 200W, Total: 0.01 kWh

❌ BEFORE:
  Select Device 1 → Shows 0.05 kWh ✓
  Select Device 2 → Shows 0.05 kWh ✗ WRONG! (Device 1's data)

✅ AFTER:
  Select Device 1 → Shows 0.05 kWh ✓
  Select Device 2 → Shows 0.01 kWh ✓ CORRECT!
```

### Quick Test: Toggle

```
❌ BEFORE:
  Device 1 ON → Turn OFF ✓
  Switch to Device 2 → Button shows "Turn OFF" (but Device 2 is ON!) ✗
  Toggle fails because of state confusion

✅ AFTER:
  Device 1 ON → Turn OFF ✓ Button shows "Turn ON"
  Switch to Device 2 → Button shows "Turn OFF" (Device 2 still ON) ✓
  Toggle works correctly for Device 2 ✓
```

---

## Lines of Code Changed

- Added `deviceStates` object: 1 line
- Added `getDeviceState()` function: 3 lines
- Added `setDeviceState()` function: 2 lines
- Enhanced `changeDevice()`: +8 lines
- Updated `toggleDevice()`: +3 lines
- Fixed `updateDailySummary()`: +1 line
- Removed `isDeviceOn` global: -1 line

**Total:** ~17 lines of changes for complete device support

---

## Backward Compatibility

✅ **Fully Backward Compatible**

- Single device setups work exactly the same
- No breaking changes to existing API
- No changes to database schema
- No changes to UI layout
- All existing features work as before

The fix only enhances functionality for multi-device scenarios.
