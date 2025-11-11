# Device Switching & Toggle Fix

## Issues Fixed

### Issue 1: Switching to Second Device Shows First Device's Data

**Problem:** When switching devices, the dashboard displayed cached data from the previously selected device instead of fetching fresh data for the new device.

**Root Cause:** The `changeDevice()` function wasn't properly clearing all chart data before fetching new data.

**Fix:**

- Added explicit chart data clearing for `powerChart`, `energyChart`, and `patternsChart`
- Reset `lastUpdateTimestamp` to ensure proper kWh delta calculation
- Clear labels and datasets completely before updating

### Issue 2: Turn ON/OFF Doesn't Work for Second Device

**Problem:** The toggle button worked for the first device but failed for the second device.

**Root Cause:**

1. Global `isDeviceOn` boolean was used to track state - didn't support multiple devices
2. The toggle response wasn't properly parsed for each device
3. Device-specific state wasn't maintained

**Fix:**

- Replaced global `isDeviceOn` boolean with `deviceStates` object: `{deviceId: true/false}`
- Added helper functions:
  - `getDeviceState(deviceId)` - Retrieve current state for device
  - `setDeviceState(deviceId, state)` - Update state for device
- Updated `toggleDevice()` to:
  - Parse response from backend
  - Update device-specific state using `setDeviceState()`
  - Update button text based on new state
  - Only reset charts if device is turned OFF
- Updated `changeDevice()` to restore correct button state for newly selected device

### Issue 3: Device State Lost on Switch

**Problem:** When switching between devices, the button state didn't reflect the actual device state.

**Fix:**

- In `changeDevice()`, the button state is now updated based on `getDeviceState()` for the newly selected device
- Ensures UI always shows correct toggle button text for current device

## Code Changes

### main.js Changes

#### 1. Added Per-Device State Tracking

```javascript
let deviceStates = {}; // Track on/off state per device

function getDeviceState(deviceId) {
  return deviceStates[deviceId] !== undefined ? deviceStates[deviceId] : true;
}

function setDeviceState(deviceId, state) {
  deviceStates[deviceId] = state;
}
```

#### 2. Enhanced changeDevice() Function

```javascript
async function changeDevice(deviceId) {
  // ... existing code ...

  // Reset last update timestamp to calculate proper delta
  lastUpdateTimestamp = Date.now();

  // Clear all charts properly
  powerChart.data.labels = [];
  powerChart.data.datasets[0].data = [];
  powerChart.update();

  energyChart.data.labels = [];
  energyChart.data.datasets[0].data = [];
  energyChart.update();

  patternsChart.data.datasets[0].data = Array(24).fill(0);
  patternsChart.update();

  // ... rest of code ...

  // Update button state for current device
  const button = document.getElementById("toggle-button");
  const isOn = getDeviceState(currentDeviceId);
  button.textContent = isOn ? "Turn OFF" : "Turn ON";
}
```

#### 3. Updated toggleDevice() Function

```javascript
async function toggleDevice() {
  // ... existing code ...

  const result = await response.json();

  // Update device state based on response
  const newState = result.state;
  setDeviceState(currentDeviceId, newState);

  // Update button state
  button.textContent = newState ? "Turn OFF" : "Turn ON";

  // Reset power data if the device is turned off
  if (!newState) {
    resetPowerData();
  }

  // ... rest of code ...
}
```

#### 4. Updated updateDailySummary() Function

```javascript
function updateDailySummary(newData) {
  // ... existing calculations ...

  // Check if the device is off using per-device state
  const isDeviceOn = getDeviceState(currentDeviceId);
  if (!isDeviceOn) {
    safeUpdateElement("hourly-cost", "$0.00/hr");
    safeUpdateElement("daily-cost", "$0.00");
    safeUpdateElement("total-cost", "$0.00");
    return;
  }
}
```

#### 5. Removed Global isDeviceOn Variable

- Deleted: `let isDeviceOn = true;` (was causing conflicts with per-device tracking)
- All references now use `getDeviceState(currentDeviceId)`

## How It Works Now

### Switching Devices

1. User selects new device from dropdown
2. `changeDevice(newDeviceId)` is called
3. All data structures cleared
4. All charts reset (labels and data)
5. `lastUpdateTimestamp` reset for accurate kWh calculation
6. Historical data loaded from MongoDB for new device
7. Button state updated to reflect new device's state
8. Next API poll uses `currentDeviceId` to fetch correct device data

### Toggling Device

1. User clicks Turn ON/OFF button
2. `toggleDevice()` is called with `currentDeviceId`
3. Backend toggles the specific device
4. Response includes new device state
5. `setDeviceState(deviceId, newState)` saves state
6. Button text updates
7. If OFF, all charts and stats reset
8. Next API poll shows new device state

### Per-Device State

- Each device has its own on/off state stored in `deviceStates`
- State persists when switching between devices
- State is independent per device
- Defaults to `true` (on) for new devices

## Testing Checklist

- [ ] Switch to Device 1, verify it shows Device 1's data
- [ ] Switch to Device 2, verify it shows Device 2's data (not Device 1's)
- [ ] Turn Device 1 OFF, verify all values reset to $0.00
- [ ] Switch to Device 2, verify Device 2's data is intact
- [ ] Turn Device 2 OFF, verify it resets
- [ ] Switch back to Device 1, verify its state is still OFF
- [ ] Turn Device 1 back ON, verify data resumes
- [ ] Charts update properly when switching devices
- [ ] Button text matches actual device state
- [ ] Peak Usage, Average Usage, Total Energy update for each device

## Summary

The fixes implement proper per-device state management instead of a single global state. Each device now maintains its own:

- On/Off state
- Power data (watts, kWh)
- Historical analytics
- UI state (button text)

This allows seamless switching between multiple devices while maintaining accurate data for each one.
