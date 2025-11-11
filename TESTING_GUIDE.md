# Testing Guide: Device Switching and Toggle Fix

## Test Scenario 1: Basic Device Switching

### Setup

- Have 2 devices configured in Netlify environment (DEVICE_ID_1 and DEVICE_ID_2)
- Both devices are ON

### Steps

1. Open dashboard in browser
2. Device 1 should be selected by default
3. Note down Device 1's:
   - Current Watts value
   - Chart visualization
   - Button text (should say "Turn OFF")

### Expected Results

- ✅ Device 1 data displays correctly
- ✅ Charts show Device 1's power draw and energy
- ✅ Button shows "Turn OFF" (device is on)

### Execution

1. Click device selector dropdown
2. Select Device 2
3. Wait 2-3 seconds for data to load

### Expected Results After Switch

- ✅ Device name changes to "Computer" or "Device 2"
- ✅ Device ID changes to DEVICE_ID_2
- ✅ Current Watts value changes to Device 2's current power
- ✅ Charts completely refresh with Device 2's data (not Device 1's)
- ✅ Peak Usage, Average Usage, Total Energy update to Device 2's values
- ✅ Button text reflects Device 2's state ("Turn ON" or "Turn OFF")

### If This Fails

- Check console (F12) for errors
- Verify both devices are sending data to Tuya API
- Check network tab to see if correct deviceId is being sent

---

## Test Scenario 2: Toggle Device OFF Then Switch

### Setup

- 2 devices, both ON
- Device 1 is selected

### Steps

1. Click "Turn OFF" button
2. Wait for animation to complete

### Expected Results

- ✅ Button text changes to "Turn ON"
- ✅ Current Watts becomes "0 W"
- ✅ All cost displays become "$0.00"
- ✅ Charts clear (no data points)
- ✅ Peak Usage, Average Usage become "0W" or "--"

### Continue Test

1. Switch to Device 2
2. Device 2 should still show its data (not affected by Device 1 being OFF)

### Expected Results

- ✅ Device 2's current watts displays
- ✅ Device 2's charts show data
- ✅ Button shows "Turn OFF" (Device 2 is still on)
- ✅ Device 2's data is independent from Device 1

### Then Switch Back

1. Switch back to Device 1

### Expected Results

- ✅ Device 1 still shows OFF state
- ✅ Button shows "Turn ON"
- ✅ All values are "$0.00" or "0"
- ✅ Device 1's OFF state persisted across device switches

---

## Test Scenario 3: Toggle Multiple Devices

### Setup

- Device 1: Currently ON
- Device 2: Currently ON

### Test Sequence

1. Device 1 selected → Click "Turn OFF" ✅ Device 1 shows OFF
2. Switch to Device 2 ✅ Device 2 shows ON, has data
3. Click "Turn OFF" ✅ Device 2 shows OFF, data clears
4. Switch to Device 1 ✅ Device 1 shows OFF state (unchanged)
5. Switch to Device 2 ✅ Device 2 shows OFF state (unchanged)
6. Click "Turn ON" (Device 2) ✅ Device 2 shows ON, data resumes
7. Switch to Device 1 → Click "Turn ON" ✅ Device 1 shows ON, data resumes
8. Switch to Device 2 ✅ Device 2 shows ON (state persisted)

### Expected Results

- ✅ Each device's state (ON/OFF) is independent
- ✅ Each device's state persists when switching away
- ✅ Switching back shows the device in the state it was left in
- ✅ No interference between devices

---

## Test Scenario 4: Verify Per-Device Data Isolation

### Setup

- Device 1: ON, running for 10 minutes (showing 0.05 kWh)
- Device 2: ON, just started (showing 0.001 kWh)

### Steps

1. Select Device 1, note:
   - Total Energy: 0.05 kWh
   - Total Cost: $0.0075
2. Switch to Device 2, verify:
   - Total Energy: 0.001 kWh (NOT 0.05 kWh)
   - Total Cost: $0.00015 (NOT $0.0075)
3. Switch back to Device 1, verify:
   - Total Energy: still 0.05 kWh (unchanged)
   - Total Cost: still $0.0075 (unchanged)

### Expected Results

- ✅ Each device shows only its own data
- ✅ Switching doesn't lose Device 1's accumulated data
- ✅ Switching doesn't mix data between devices

---

## Test Scenario 5: Charts Refresh Correctly

### Setup

- Device 1: ON with data history
- Device 2: ON with data history

### Steps

#### Check Power Chart

1. Select Device 1 → Observe Power Chart (should show Device 1's watts)
2. Switch to Device 2 → Power Chart should refresh with Device 2's data
3. Switch back to Device 1 → Power Chart shows Device 1's data again

#### Check Energy Chart

1. Select Device 1 → Observe Energy Chart (bar chart with kWh per interval)
2. Switch to Device 2 → Energy Chart should have different bars
3. Switch back to Device 1 → Energy Chart shows Device 1's bars

#### Check Usage Patterns Chart

1. Select Device 1 → Observe hourly pattern chart
2. Switch to Device 2 → Pattern should show Device 2's hourly breakdown
3. Switch back to Device 1 → Pattern shows Device 1's again

### Expected Results

- ✅ All three charts update when switching devices
- ✅ No ghost data from previous device
- ✅ Charts are completely independent per device

---

## Test Scenario 6: Button State Accuracy

### Setup

- Track button state during operations

### Test Sequence

1. Device 1 ON → Button shows "Turn OFF" ✅
2. Click Turn OFF → Button changes to "Turn ON" ✅
3. Switch to Device 2 → Button shows "Turn OFF" (Device 2 is ON) ✅
4. Click Turn OFF → Button shows "Turn ON" ✅
5. Switch to Device 1 → Button shows "Turn ON" ✅
6. Click Turn ON → Button shows "Turn OFF" ✅
7. Switch to Device 2 → Button shows "Turn ON" ✅

### Expected Results

- ✅ Button always reflects current device's state
- ✅ Button text is opposite of actual state (ON shows "Turn OFF", etc)
- ✅ State changes are immediate after toggle

---

## Test Scenario 7: Performance and Responsiveness

### Steps

1. Rapidly switch between devices (5-10 times)
2. While switching, watch for:

   - UI freezing or lagging
   - Charts flickering inappropriately
   - Data showing from wrong device
   - Console errors

3. Rapidly click toggle button
   - (May fail due to API rate limits, which is OK)
   - Should show appropriate error messages

### Expected Results

- ✅ UI responsive, no long freezes
- ✅ Charts update smoothly
- ✅ Correct device data always shown
- ✅ Appropriate error handling

---

## Debugging Checklist

### If Device 2 Shows Device 1's Data

```javascript
// In console:
console.log("Current Device ID:", currentDeviceId);
console.log(
  "All Device IDs:",
  devices.map((d) => d.id)
);
console.log("Device States:", deviceStates);

// Manually check which device is fetching:
// Go to Network tab and look at 'store-energy-data' queries
// The 'deviceId' parameter should match Device 2's ID
```

### If Toggle Doesn't Work for Device 2

```javascript
// In console:
console.log("Current Device ID:", currentDeviceId);
console.log("Device State for current:", getDeviceState(currentDeviceId));

// Check network tab:
// - POST to get-smart-plug-data should have correct deviceId in body
// - Response should have "success": true and "state": boolean
```

### If Charts Don't Clear on Switch

```javascript
// In console:
console.log("Power chart labels:", powerChart.data.labels);
console.log("Power chart data:", powerChart.data.datasets[0].data);

// After switching to Device 2:
// These should both be empty arrays initially, then populate with Device 2 data
```

### If Button State Wrong

```javascript
// In console:
console.log("Current Device:", currentDeviceId);
console.log("Device States:", deviceStates);
console.log(
  "Button text:",
  document.getElementById("toggle-button").textContent
);

// The button text should match:
// deviceStates[currentDeviceId] = true  → "Turn OFF"
// deviceStates[currentDeviceId] = false → "Turn ON"
```

---

## Console Testing Commands

```javascript
// Full device state check
function debugDevices() {
  console.log("=== DEVICE STATE DEBUG ===");
  console.log("Current Device ID:", currentDeviceId);
  console.log("All Devices:", devices);
  console.log("All Device States:", deviceStates);
  console.log("Current Device State:", getDeviceState(currentDeviceId));
  console.log(
    "Button Text:",
    document.getElementById("toggle-button").textContent
  );
  console.log("Power Data Length:", powerData.watts.length);
}

// Run it:
debugDevices();
```

---

## Expected Behavior Summary

| Action                 | Expected Result                               |
| ---------------------- | --------------------------------------------- |
| Switch to Device 2     | Shows Device 2's data, not Device 1's         |
| Toggle Device 1 OFF    | Device 1 shows $0.00, Device 2 unaffected     |
| Toggle Device 2 ON     | Device 2 resumes showing data                 |
| Switch devices rapidly | No data mixing, smooth updates                |
| Button state           | Always shows opposite of current device state |
| Charts                 | Completely refresh for new device             |
| Per-device state       | Persists when switching away and back         |

---

## Pass/Fail Criteria

### ✅ PASS

- All 3 charts update correctly when switching devices
- Toggle works for Device 1
- Toggle works for Device 2
- Device 1 data shows when selected, not when Device 2 selected
- Device 2 data shows when selected, not when Device 1 selected
- Button state is always correct for current device
- States persist across device switches
- No console errors

### ❌ FAIL

- Switching to Device 2 still shows Device 1's data
- Toggle doesn't work for Device 2
- Charts don't refresh when switching
- Wrong device state displayed on button
- Data from both devices mixes together
- Console shows errors
