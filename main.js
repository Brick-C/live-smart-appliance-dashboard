// Device management
let currentDeviceId = null;
let devices = [];
let deviceStates = {}; // Track on/off state per device

function updateDeviceInfo(device) {
  // Update the device information in the UI
  const deviceName = document.getElementById("device-name");
  const deviceType = document.getElementById("device-type");
  const deviceId = document.getElementById("device-id");

  if (deviceName) deviceName.textContent = device.name || "Unknown Device";
  if (deviceType) deviceType.textContent = device.type || "Unknown Type";
  if (deviceId) deviceId.textContent = device.id || "Unknown ID";
}

function getDeviceState(deviceId) {
  return deviceStates[deviceId] !== undefined ? deviceStates[deviceId] : true;
}

function setDeviceState(deviceId, state) {
  deviceStates[deviceId] = state;
}

async function loadDevices() {
  console.log("=== LOADING DEVICES ===");
  try {
    const response = await fetch(
      "/.netlify/functions/get-smart-plug-data?action=list"
    );
    if (!response.ok) throw new Error("Failed to load devices");

    devices = await response.json();
    console.log("Devices loaded:", devices);

    const selector = document.getElementById("device-selector");
    selector.innerHTML = devices
      .map((d) => `<option value="${d.id}">${d.name} (${d.type})</option>`)
      .join("");

    // Select first device by default
    if (devices.length > 0) {
      currentDeviceId = devices[0].id;
      selector.value = currentDeviceId;
      updateDeviceInfo(devices[0]);
      console.log("Default device selected:", currentDeviceId);
    }
  } catch (error) {
    console.error("Error loading devices:", error);
    document.getElementById("device-selector").innerHTML =
      '<option value="">Error loading devices</option>';
  }
}

async function changeDevice(deviceId) {
  console.log("=== DEVICE SWITCH START ===");
  console.log("Switching from:", currentDeviceId, "to:", deviceId);

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

    // CRITICAL FIX: Reset charts properly
    powerChart.data.labels = [];
    powerChart.data.datasets[0].data = [];
    powerChart.update("none"); // Force immediate update

    energyChart.data.labels = [];
    energyChart.data.datasets[0].data = [];
    energyChart.update("none"); // Force immediate update

    patternsChart.data.datasets[0].data = Array(24).fill(0);
    patternsChart.update("none"); // Force immediate update

    // Reset UI elements to loading state
    safeUpdateElement("current-watts", "Loading...");
    safeUpdateElement("total-kwh", "Loading...");

    lastUpdateTimestamp = Date.now();

    // Load historical data
    try {
      console.log("Loading historical data for:", currentDeviceId);
      const response = await fetch(
        "/.netlify/functions/store-energy-data?" +
          new URLSearchParams({
            deviceId: currentDeviceId,
            startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          })
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Historical data loaded:", data.length, "records");
        if (data.length > 0) {
          processHistoricalData(data);
        } else {
          console.log(
            "No historical data found - this is normal for new devices"
          );
          powerChart.update("none");
          energyChart.update("none");
        }
      }
    } catch (error) {
      console.error("Error loading historical data:", error);
    }

    // Fetch real-time data
    try {
      console.log("Fetching real-time data for:", currentDeviceId);
      await fetchDataAndRender();
    } catch (error) {
      console.error("Error fetching device data:", error);
    }

    // Update UI
    const button = document.getElementById("toggle-button");
    const isOn = getDeviceState(currentDeviceId);
    button.textContent = isOn ? "Turn OFF" : "Turn ON";

    console.log("=== DEVICE SWITCH COMPLETE ===");
  }
}

// Add this helper function if not exists
function safeUpdateElement(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

const MAX_DATA_POINTS = 30; // Max points to display in the chart
let powerData = {
  labels: [],
  watts: [],
  kwh: [],
  cumulativeKWh: 0,
};
let lastUpdateTimestamp = Date.now();
const updateIntervalMs = 5000; // API fetch interval (5 seconds)

// --- CHART INITIALIZATION ---
const powerCtx = document.getElementById("powerChart").getContext("2d");
const powerChart = new Chart(powerCtx, {
  type: "line",
  data: {
    labels: powerData.labels,
    datasets: [
      {
        label: "Power (Watts)",
        data: powerData.watts,
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3,
        fill: true,
      },
    ],
  },
  options: {
    responsive: true,
    animation: false,
    scales: {
      y: {
        title: { display: true, text: "Watts", fontSize: 14 },
        beginAtZero: true,
      },
      x: {
        title: { display: true, text: "Time", fontSize: 14 },
        display: true,
      },
    },
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
  },
});

const energyCtx = document.getElementById("energyChart").getContext("2d");
const energyChart = new Chart(energyCtx, {
  type: "bar",
  data: {
    labels: powerData.labels,
    datasets: [
      {
        type: "bar",
        label: "Energy (kWh)",
        data: powerData.kwh,
        backgroundColor: "rgba(21, 108, 237, 1)",
        borderWidth: 0,
      },
      {
        type: "line",
        label: "Cumulative Energy (kWh)",
        data: powerData.kwh.map((_, i) =>
          powerData.kwh.slice(0, i + 1).reduce((a, b) => a + b, 0)
        ),
        borderColor: "rgba(160, 0, 0, 1)",
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0.3,
      },
    ],
  },
  options: {
    responsive: true,
    animation: false,
    scales: {
      y: {
        title: { display: true, text: "Energy (kWh)", fontSize: 14 },
        beginAtZero: true,
      },
      x: {
        title: { display: true, text: "Time", fontSize: 14 },
        display: true,
      },
    },
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
  },
});

/**
 * Fetches smart plug data by calling our secure Netlify serverless function.
 * @returns {Promise<{watts: number, device: string, timestamp: number}>}
 */
async function getRealTimeSmartPlugData() {
  const apiEndpoint = `/.netlify/functions/get-smart-plug-data${
    currentDeviceId ? `?deviceId=${currentDeviceId}` : ""
  }`;

  console.log("Fetching data from:", apiEndpoint);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiEndpoint, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error response:", errorText);
      throw new Error(`API function failed: ${errorText}`);
    }

    const data = await response.json();
    console.log("Received real-time data:", data);

    // Check if data is valid
    if (data.watts === 0) {
      console.warn("⚠️ Received 0 watts - device may be OFF or not responding");
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Smart plug data fetch timeout");
      throw new Error("Smart plug data request timed out");
    }
    console.error("Error fetching smart plug data:", error);
    throw error;
  }
}

// DATA PROCESSING & CHART UPDATE
async function processAndRenderData(newData) {
  console.log("Processing data:", {
    watts: newData.watts,
    deviceId: currentDeviceId,
    timestamp: new Date(newData.timestamp).toLocaleString(),
  });

  const now = new Date();
  const timeLabel = now.toLocaleTimeString();

  // Calculate Energy (kWh) consumed since the last update
  const deltaMs = newData.timestamp - lastUpdateTimestamp;
  lastUpdateTimestamp = newData.timestamp;

  const powerInKW = newData.watts / 1000;
  const timeInHours = deltaMs / 3600000;
  let kwh_increment = powerInKW * timeInHours;

  if (kwh_increment < 0) {
    kwh_increment = 0;
  }

  console.log("Energy calculation:", {
    deltaMs,
    powerInKW,
    timeInHours,
    kwh_increment,
  });

  // Store the data in our database with retry logic
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const storeData = {
        deviceId: currentDeviceId,
        watts: newData.watts,
        kWh: kwh_increment,
        cost: newData.energy ? kwh_increment * newData.energy.ratePerKWh : 0,
      };

      console.log("Storing data to database:", storeData);

      const response = await fetch("/.netlify/functions/store-energy-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(storeData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log("Data stored successfully");
      break; // Success, exit retry loop
    } catch (error) {
      retryCount++;
      console.error(
        `Failed to store energy data (attempt ${retryCount}/${maxRetries}):`,
        error
      );

      if (retryCount === maxRetries) {
        console.error("Max retries reached for storing energy data");
        break;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1000 * Math.pow(2, retryCount), 5000))
      );
    }
  }

  // Update Data Arrays (for charts)
  powerData.labels.push(timeLabel);
  powerData.watts.push(newData.watts);
  powerData.kwh.push(kwh_increment);

  // Update Cumulative Energy
  powerData.cumulativeKWh += kwh_increment;

  if (powerData.cumulativeKWh < 0) {
    powerData.cumulativeKWh = 0;
  }

  // Manage Data History
  if (powerData.labels.length > MAX_DATA_POINTS) {
    powerData.labels.shift();
    powerData.watts.shift();
    powerData.kwh.shift();
  }

  console.log("Updating charts with data:", {
    labelsCount: powerData.labels.length,
    wattsCount: powerData.watts.length,
    kwhCount: powerData.kwh.length,
    cumulativeKWh: powerData.cumulativeKWh,
  });

  // Update Charts with immediate force update
  powerChart.update("none");
  energyChart.update("none");

  // Update dashboard stats
  const currentWattsElement = document.getElementById("current-watts");
  if (currentWattsElement) {
    currentWattsElement.textContent = `${newData.watts} W`;
  }

  const totalKwhElement = document.getElementById("total-kwh");
  if (totalKwhElement) {
    const displayKwh = Math.max(0, powerData.cumulativeKWh);
    totalKwhElement.textContent = `${displayKwh.toFixed(4)} kWh`;
  }

  const lastUpdateElement = document.getElementById("last-update");
  if (lastUpdateElement) {
    lastUpdateElement.textContent = timeLabel;
  }

  // Update cost information
  if (newData.energy) {
    document.getElementById(
      "rate-per-kwh"
    ).textContent = `৳${newData.energy.ratePerKWh.toFixed(2)}/kWh`;
    document.getElementById(
      "hourly-cost"
    ).textContent = `৳${newData.energy.hourlyCost.toFixed(3)}/hr`;
    document.getElementById(
      "daily-cost"
    ).textContent = `৳${newData.energy.projectedDailyCost.toFixed(2)}`;
  }

  // Update historical data and analytics
  updateHistoricalData(newData);
  updateAnalytics(newData);
  updateCostDisplays();

  console.log("Data processing and rendering complete");
}

//MAIN LOOP
async function fetchDataAndRender() {
  console.log("=== FETCHING AND RENDERING DATA ===");

  const statusElement = document.getElementById("api-status");
  if (statusElement) {
    statusElement.textContent = "Fetching...";
    statusElement.classList.remove("text-green-500", "text-red-600");
    statusElement.classList.add("text-yellow-600");
  }

  try {
    const data = await getRealTimeSmartPlugData();
    console.log("Data fetched successfully, processing...");

    await processAndRenderData(data);

    if (statusElement) {
      statusElement.textContent = "Success";
      statusElement.classList.remove("text-yellow-600", "text-red-600");
      statusElement.classList.add("text-green-500");
    }

    console.log("=== DATA FETCH AND RENDER COMPLETE ===");
  } catch (error) {
    console.error("Failed to fetch smart plug data:", error);

    if (statusElement) {
      statusElement.textContent = "ERROR";
      statusElement.classList.remove("text-yellow-600", "text-green-500");
      statusElement.classList.add("text-red-600");
    }

    throw error;
  }
}

// Start the initial fetch immediately, then set the interval
window.onload = function () {
  console.log("=== WINDOW LOAD EVENT ===");

  // Run updates on the charts once the page is loaded
  powerChart.update();
  energyChart.update();

  // Load available devices first
  loadDevices().then(async () => {
    console.log("Devices loaded, starting data fetching...");

    // Load historical data from the server for the default device
    try {
      console.log("Loading initial historical data...");
      const response = await fetch(
        "/.netlify/functions/store-energy-data?" +
          new URLSearchParams({
            deviceId: currentDeviceId,
            startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
          })
      );

      if (response.ok) {
        const historicalData = await response.json();
        console.log(
          "Initial historical data loaded:",
          historicalData.length,
          "records"
        );

        // Process historical data
        if (historicalData.length > 0) {
          historicalData.forEach((reading) => {
            powerData.labels.push(
              new Date(reading.timestamp).toLocaleTimeString()
            );
            powerData.watts.push(reading.watts);
            powerData.kwh.push(reading.kWh);
            powerData.cumulativeKWh += reading.kWh;
          });

          // Update charts with historical data
          powerChart.update();
          energyChart.update();
        }
      }
    } catch (error) {
      console.error("Failed to load initial historical data:", error);
    }

    // Start real-time updates
    console.log("Starting real-time data fetching...");
    fetchDataAndRender();
    setInterval(fetchDataAndRender, updateIntervalMs);

    // Save historical data every 5 minutes
    setInterval(saveHistoricalData, 5 * 60 * 1000);
  });
};

// Device control functionality
async function toggleDevice() {
  console.log("=== TOGGLE DEVICE ===");
  console.log("Toggling device:", currentDeviceId);

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
        deviceId: currentDeviceId, // ✅ Now correctly sent in body
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to toggle device");
    }

    const result = await response.json();
    console.log("Toggle result:", result);

    // Update device state based on response
    const newState = result.state;
    setDeviceState(currentDeviceId, newState);

    // Update button state
    button.textContent = newState ? "Turn OFF" : "Turn ON";

    // Reset power data if the device is turned off
    if (!newState) {
      resetPowerData();
    }

    // Fetch updated status
    await fetchDataAndRender();
  } catch (error) {
    console.error("Error toggling device:", error);
    alert("Failed to toggle device. Please try again.");
  } finally {
    button.disabled = false;
    button.classList.remove("opacity-50");
  }
}

// Reset power data and update dashboard when the device is turned off
function resetPowerData() {
  console.log("=== RESETTING POWER DATA ===");

  powerData.labels = [];
  powerData.watts = [];
  powerData.kwh = [];
  powerData.cumulativeKWh = 0;

  analytics.dailyData.today = [];

  // Update dashboard to reflect zero usage
  safeUpdateElement("current-watts", "0 W");
  safeUpdateElement("total-kwh", "0.000 kWh");
  safeUpdateElement("hourly-cost", "৳0.00/hr");
  safeUpdateElement("daily-cost", "৳0.00");
  safeUpdateElement("total-cost", "৳0.00");

  // Reset charts
  powerChart.data.labels = [];
  powerChart.data.datasets[0].data = [];
  powerChart.update("none");

  energyChart.data.labels = [];
  energyChart.data.datasets[0].data = [];
  energyChart.update("none");

  console.log("Power data reset complete");
}

/**
 * Safely updates the text content of an element if it exists.
 * @param {string} id - The ID of the element to update.
 * @param {string} text - The text to set.
 */
function safeUpdateElement(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

// Analytics management
const analytics = {
  baselineWatts: 5, // Typical standby power consumption
  peakThreshold: 800, // Threshold for peak usage warning
  efficiencyThresholds: {
    excellent: 90,
    good: 75,
    fair: 60,
  },
  dailyData: {
    today: [],
    yesterday: [],
  },
};

function updateAnalytics(newData) {
  if (!newData) return;

  // Update daily data
  const now = new Date();
  const currentRate = newData.energy?.ratePerKWh || 0.15;
  const currentCost = (newData.watts / 1000) * currentRate;

  analytics.dailyData.today.push({
    time: now,
    watts: newData.watts,
    cost: currentCost,
  });

  // Calculate efficiency score (0-100)
  const efficiencyScore = calculateEfficiencyScore(newData.watts);
  safeUpdateElement("efficiency-score", efficiencyScore);
  updateEfficiencyLabel(efficiencyScore);

  // Calculate averages
  const dailyAvgWatts =
    analytics.dailyData.today.reduce((sum, data) => sum + data.watts, 0) /
    (analytics.dailyData.today.length || 1);
  const dailyTotalCost = analytics.dailyData.today.reduce(
    (sum, data) => sum + data.cost,
    0
  );

  // Update efficiency score explanation
  let efficiencyExplanation = [];
  if (newData.watts > analytics.peakThreshold) {
    efficiencyExplanation.push("High power usage detected");
  }
  if (dailyAvgWatts > 500) {
    efficiencyExplanation.push("Above average daily consumption");
  }
  if (newData.watts > analytics.baselineWatts && newData.watts < 50) {
    efficiencyExplanation.push("Standby power detected");
  }

  const efficiencyLabelEl = document.getElementById("efficiency-label");
  if (efficiencyLabelEl) {
    efficiencyLabelEl.title = efficiencyExplanation.join(", ");
  }

  // Update cost insights with actual data
  const dailyCostProjection = (dailyTotalCost / now.getHours()) * 24;
  const monthlyCostProjection = dailyCostProjection * 30;

  const costComparisonEl = document.getElementById("cost-comparison");
  if (costComparisonEl) {
    costComparisonEl.textContent = analytics.dailyData.yesterday.length
      ? `${(
          (dailyTotalCost /
            analytics.dailyData.yesterday.reduce(
              (sum, data) => sum + data.cost,
              0
            ) -
            1) *
          100
        ).toFixed(1)}%`
      : "No previous data";
  }

  const projectedCostEl = document.getElementById("projected-cost");
  if (projectedCostEl) {
    projectedCostEl.textContent = `৳${monthlyCostProjection.toFixed(2)}`;
  }

  // Update usage analysis with current data
  updateUsageAnalysis(newData, dailyAvgWatts);

  // Generate and update smart tips with context
  updateSmartTips(newData, {
    dailyAvgWatts,
    dailyTotalCost,
    efficiencyScore,
  });
}

function calculateEfficiencyScore(currentWatts) {
  // Simple efficiency calculation based on typical usage patterns
  let score = 100;

  // Penalize for high power usage
  if (currentWatts > analytics.peakThreshold) {
    score -= 20;
  }

  // Penalize for unnecessary standby power
  if (currentWatts > analytics.baselineWatts && currentWatts < 50) {
    score -= 10;
  }

  // Factor in time of day
  const hour = new Date().getHours();
  if ((hour >= 23 || hour <= 5) && currentWatts > analytics.baselineWatts) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

function updateEfficiencyLabel(score) {
  const element = document.getElementById("efficiency-label");
  if (!element) return;

  if (score >= analytics.efficiencyThresholds.excellent) {
    element.textContent = "Excellent";
    element.className = "text-sm text-green-600";
  } else if (score >= analytics.efficiencyThresholds.good) {
    element.textContent = "Good";
    element.className = "text-sm text-blue-600";
  } else if (score >= analytics.efficiencyThresholds.fair) {
    element.textContent = "Fair";
    element.className = "text-sm text-yellow-600";
  } else {
    element.textContent = "Needs Improvement";
    element.className = "text-sm text-red-600";
  }
}

function updateUsageAnalysis(newData, dailyAvgWatts) {
  // Detect standby power waste with more context
  const standbyDetection = document.getElementById("standby-detection");
  const standbyWaste =
    newData.watts > analytics.baselineWatts && newData.watts < 50;
  const hour = new Date().getHours();
  const isOffPeakHours = hour >= 23 || hour <= 5;

  if (standbyDetection) {
    if (standbyWaste && isOffPeakHours) {
      standbyDetection.textContent = "Off-peak standby power waste detected";
      standbyDetection.className = "text-sm text-red-600";
    } else if (standbyWaste) {
      standbyDetection.textContent = "Possible standby power waste detected";
      standbyDetection.className = "text-sm text-yellow-600";
    } else if (newData.watts <= analytics.baselineWatts) {
      standbyDetection.textContent = "Normal standby power";
      standbyDetection.className = "text-sm text-green-600";
    }
  }

  // Enhanced peak times analysis
  const peakTimes = document.getElementById("peak-times");
  const isPeakUsage = newData.watts > analytics.peakThreshold;
  const isHigherThanAverage = newData.watts > dailyAvgWatts * 1.5;

  if (peakTimes) {
    if (isPeakUsage && isOffPeakHours) {
      peakTimes.textContent = "Critical: High usage during off-peak hours";
      peakTimes.className = "text-sm text-red-600 font-bold";
    } else if (isPeakUsage) {
      peakTimes.textContent = "High usage detected - Consider rescheduling";
      peakTimes.className = "text-sm text-red-600";
    } else if (isHigherThanAverage) {
      peakTimes.textContent = "Above average usage detected";
      peakTimes.className = "text-sm text-yellow-600";
    } else {
      peakTimes.textContent = "Normal usage pattern";
      peakTimes.className = "text-sm text-green-600";
    }
  }

  // Add usage pattern explanation
  const usageExplanation = document.getElementById("usage-explanation");
  if (usageExplanation) {
    let explanationText = "Current Status: ";
    if (isPeakUsage) {
      explanationText += `Peak usage (${newData.watts}W > ${analytics.peakThreshold}W threshold)`;
    } else if (isHigherThanAverage) {
      explanationText += `Above average (${newData.watts}W > ${Math.round(
        dailyAvgWatts
      )}W avg)`;
    } else if (standbyWaste) {
      explanationText += `Standby waste (${newData.watts}W > ${analytics.baselineWatts}W baseline)`;
    } else {
      explanationText += `Normal operation (${newData.watts}W)`;
    }
    usageExplanation.textContent = explanationText;
  }
}

function updateSmartTips(newData, context) {
  const tips = [];
  const hour = new Date().getHours();
  const isOffPeakHours = hour >= 23 || hour <= 5;
  const isPeakUsage = newData.watts > analytics.peakThreshold;
  const isStandby =
    newData.watts > analytics.baselineWatts && newData.watts < 50;

  // High Power Usage Tips
  if (isPeakUsage) {
    if (isOffPeakHours) {
      tips.push(
        "⚡🌙 Critical: High power usage during off-peak hours. Consider rescheduling these activities for daytime."
      );
    } else if (context.dailyAvgWatts > 500) {
      tips.push(
        "⚡📈 Consistently high power usage. Consider spreading device usage throughout the day and check for energy-intensive appliances."
      );
    } else {
      tips.push(
        "⚡ Temporary high power usage detected. This might increase your peak demand charges."
      );
    }
  }

  // Standby Power Tips
  if (isStandby) {
    if (isOffPeakHours) {
      tips.push(
        "💡🌙 Night-time standby power detected. Use a timer or smart plug to automatically cut power to non-essential devices."
      );
    } else if (context.dailyTotalCost > 5) {
      // Adjust threshold as needed
      tips.push(
        "💡💰 Standby power is contributing to higher daily costs. Consider using a smart power strip to eliminate phantom loads."
      );
    } else {
      tips.push(
        "💡 Minor standby power detected. Group similar devices on a single switchable outlet."
      );
    }
  }

  // Efficiency Score Based Tips
  if (context.efficiencyScore < 60) {
    tips.push(
      "🎯 Low efficiency score. Schedule an energy audit to identify major power drains."
    );
  } else if (context.efficiencyScore < 75) {
    tips.push(
      "🎯 Moderate efficiency. Small changes like LED bulbs and regular maintenance can help improve your score."
    );
  }

  // Cost-based Tips
  const projectedDailyCost = (context.dailyTotalCost / hour) * 24;
  if (projectedDailyCost > 10) {
    // Adjust threshold as needed
    tips.push(
      "💰 High daily cost projected. Consider using energy-intensive devices during off-peak rate hours."
    );
  }

  // Time-based Tips
  if (isOffPeakHours && newData.watts > analytics.baselineWatts * 2) {
    tips.push(
      "🌙 Consider using scheduler features or timers to automatically manage device power during night hours."
    );
  }

  // Pattern-based Tips
  if (context.dailyAvgWatts > 500 && hour > 12 && hour < 18) {
    tips.push(
      "📊 Peak afternoon usage detected. Shift non-essential tasks to morning or evening to reduce strain on the grid."
    );
  }

  // Dynamic Tips Based on Previous Day Comparison
  if (analytics.dailyData.yesterday.length > 0) {
    const yesterdayAvg =
      analytics.dailyData.yesterday.reduce((sum, data) => sum + data.watts, 0) /
      analytics.dailyData.yesterday.length;
    if (context.dailyAvgWatts > yesterdayAvg * 1.2) {
      tips.push(
        "📈 Usage is 20% higher than yesterday. Review recent changes in device usage patterns."
      );
    }
  }

  const tipsElement = document.getElementById("energy-tips");
  if (tipsElement) {
    tipsElement.innerHTML =
      tips.length > 0
        ? tips.map((tip) => `<li class="mb-2">${tip}</li>`).join("")
        : '<li class="text-green-600">✅ No immediate energy saving opportunities identified.</li>';
  }

  // Update tip count for UI feedback
  const tipCountElement = document.getElementById("tip-count");
  if (tipCountElement) {
    tipCountElement.textContent = `${tips.length} Active Tips`;
  }
}

// Historical data management with persistence
const historicalData = {
  hourlyData: [],
  dailyData: [],
  weeklyData: [],
  monthlyData: [],
};

// Load historical data from localStorage
function loadHistoricalData() {
  const savedData = localStorage.getItem("smartPlugHistoricalData");
  if (savedData) {
    const parsedData = JSON.parse(savedData);
    // Check if the data is from today
    const lastSavedDate = new Date(parsedData.timestamp);
    const today = new Date();

    if (lastSavedDate.toDateString() === today.toDateString()) {
      historicalData.hourlyData = parsedData.hourlyData;
      historicalData.dailyData = parsedData.dailyData;
      // Move yesterday's data
      if (parsedData.dailyData.length > 0) {
        analytics.dailyData.yesterday = parsedData.dailyData;
      }
    } else if (
      lastSavedDate.toDateString() ===
      new Date(today.setDate(today.getDate() - 1)).toDateString()
    ) {
      // Yesterday's data becomes historical
      analytics.dailyData.yesterday = parsedData.dailyData;
    }
  }
}

// Save historical data to localStorage
function saveHistoricalData() {
  const dataToSave = {
    timestamp: new Date().toISOString(),
    hourlyData: historicalData.hourlyData,
    dailyData: analytics.dailyData.today,
  };
  localStorage.setItem("smartPlugHistoricalData", JSON.stringify(dataToSave));
}

// Initialize the patterns chart
const patternsCtx = document.getElementById("patternsChart").getContext("2d");
const patternsChart = new Chart(patternsCtx, {
  type: "line",
  data: {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: "Average Usage by Hour",
        data: Array(24).fill(0),
        borderColor: "rgb(99, 102, 241)",
        backgroundColor: "rgba(99, 102, 241, 0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  },
  options: {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Average Power (W)",
        },
      },
      x: {
        title: {
          display: true,
          text: "Hour of Day",
        },
      },
    },
  },
});

// Update historical data with new readings
function updateHistoricalData(newData) {
  const hour = new Date().getHours();

  // Update hourly averages
  if (!historicalData.hourlyData[hour]) {
    historicalData.hourlyData[hour] = {
      sum: newData.watts,
      count: 1,
      max: newData.watts,
    };
  } else {
    historicalData.hourlyData[hour].sum += newData.watts;
    historicalData.hourlyData[hour].count++;
    historicalData.hourlyData[hour].max = Math.max(
      historicalData.hourlyData[hour].max,
      newData.watts
    );
  }

  // Update patterns chart
  const hourlyAverages = Array(24).fill(0);
  historicalData.hourlyData.forEach((data, index) => {
    if (data) {
      hourlyAverages[index] = data.sum / data.count;
    }
  });
  patternsChart.data.datasets[0].data = hourlyAverages;
  patternsChart.update("none");

  // Update peak hours list
  updatePeakHoursList(hourlyAverages);

  // Update daily summary
  updateDailySummary(newData);
}

function updatePeakHoursList(hourlyAverages) {
  const peakThreshold = Math.max(...hourlyAverages) * 0.7; // 70% of max
  const peakHours = hourlyAverages
    .map((avg, hour) => ({ hour, avg }))
    .filter(({ avg }) => avg > peakThreshold)
    .sort((a, b) => b.avg - a.avg);

  const peakHoursList = document.getElementById("peak-hours-list");
  if (peakHoursList) {
    peakHoursList.innerHTML = peakHours
      .map(
        ({ hour, avg }) => `
            <li>${hour}:00 - ${hour + 1}:00 
                <span class="text-orange-600 font-semibold">
                  (${Math.round(avg)}W avg)
                </span>
            </li>
          `
      )
      .join("");
  }
}

function processHistoricalData(data) {
  console.log("=== PROCESSING HISTORICAL DATA ===");
  console.log("Processing", data.length, "historical records");

  // Process historical readings
  data.forEach((reading) => {
    const readingDate = new Date(reading.timestamp);
    const hour = readingDate.getHours();

    // Update power data
    powerData.labels.push(readingDate.toLocaleTimeString());
    powerData.watts.push(reading.watts);
    powerData.kwh.push(reading.kWh);
    powerData.cumulativeKWh += reading.kWh;

    // Update hourly data
    if (!historicalData.hourlyData[hour]) {
      historicalData.hourlyData[hour] = {
        sum: reading.watts,
        count: 1,
        max: reading.watts,
      };
    } else {
      historicalData.hourlyData[hour].sum += reading.watts;
      historicalData.hourlyData[hour].count++;
      historicalData.hourlyData[hour].max = Math.max(
        historicalData.hourlyData[hour].max,
        reading.watts
      );
    }

    // Update today's data
    const today = new Date();
    if (readingDate.toDateString() === today.toDateString()) {
      analytics.dailyData.today.push({
        time: readingDate,
        watts: reading.watts,
        cost: reading.cost,
      });
    }
  });

  console.log("Historical data processing complete");
  console.log("Power data arrays:", {
    labels: powerData.labels.length,
    watts: powerData.watts.length,
    kwh: powerData.kwh.length,
    cumulativeKWh: powerData.cumulativeKWh,
  });

  // Update all charts and displays
  powerChart.update("none");
  energyChart.update("none");
  updateHistoricalCharts(data, "today");
  updateHistoricalStats(data);
  updatePeakHoursList(historicalData.hourlyData);
}

function updateDailySummary(newData) {
  if (!newData || powerData.watts.length === 0) return;

  const timeframe = document.getElementById("history-timeframe")?.value;
  const peakUsage = Math.max(...powerData.watts);
  const avgUsage =
    powerData.watts.reduce((a, b) => a + b, 0) / powerData.watts.length;

  // Calculate hourly cost
  const currentPowerKW = newData.watts / 1000;
  const hourlyCost = currentPowerKW * (newData.energy?.ratePerKWh || 0.15);

  // Calculate projected daily cost based on current usage pattern
  const hourOfDay = new Date().getHours();
  const hoursRemaining = 24 - hourOfDay;
  const currentDayCost = analytics.dailyData.today.reduce(
    (sum, data) => sum + data.cost,
    0
  );
  const projectedDailyCost = currentDayCost + hourlyCost * hoursRemaining;

  // Ensure all values are non-negative
  const cumulativeKwh = Math.max(0, powerData.cumulativeKWh);
  const totalCost = Math.max(
    0,
    cumulativeKwh * (newData.energy?.ratePerKWh || 0.15)
  );
  const projectedCost = Math.max(0, projectedDailyCost);
  const hourlyRate = Math.max(0, hourlyCost);

  // Update summary displays
  safeUpdateElement("peak-usage", `${peakUsage.toFixed(1)}W`);
  safeUpdateElement("avg-usage", `${avgUsage.toFixed(1)}W`);
  safeUpdateElement("total-usage", `${cumulativeKwh.toFixed(3)} kWh`);
  safeUpdateElement("total-cost", `৳${totalCost.toFixed(2)}`);
  safeUpdateElement("hourly-cost", `৳${hourlyRate.toFixed(3)}/hr`);
  safeUpdateElement("daily-cost", `৳${projectedCost.toFixed(2)}`);

  // Check if the device is off and skip calculations
  const isDeviceOn = getDeviceState(currentDeviceId);
  if (!isDeviceOn) {
    safeUpdateElement("hourly-cost", "৳0.00/hr");
    safeUpdateElement("daily-cost", "৳0.00");
    safeUpdateElement("total-cost", "৳0.00");
  }
}

// Update historical view when timeframe changes
document
  .getElementById("history-timeframe")
  ?.addEventListener("change", function () {
    updateHistoricalView();
  });

// Include the historical-data.js functions here or import them
// For now, include basic implementations:

async function updateHistoricalView() {
  const timeframe = document.getElementById("history-timeframe")?.value;

  try {
    // This is a simplified version - you should use the full implementation from historical-data.js
    console.log("Updating historical view for timeframe:", timeframe);
    // Implementation would go here based on your historical-data.js file
  } catch (error) {
    console.error("Error updating historical view:", error);
  }
}

async function updateCostDisplays() {
  try {
    // Update cost-related displays
    console.log("Updating cost displays for device:", currentDeviceId);
    // Implementation would go here
  } catch (error) {
    console.error("Error updating cost displays:", error);
  }
}

function updateHistoricalCharts(data, timeframe) {
  console.log("=== UPDATING HISTORICAL CHARTS ===");
  console.log("Updating charts with data length:", data.length);
  // Implementation based on historical-data.js
}

function updateHistoricalStats(statsData) {
  console.log("=== UPDATING HISTORICAL STATS ===");
  console.log("Updating stats with:", statsData);
  // Implementation based on historical-data.js
}

function updateElectricityRate(rate) {
  // Implementation for updating electricity rate
  console.log("Updating electricity rate to:", rate);
}

// Export functionality
async function exportData(format) {
  // Implementation for data export
  console.log("Exporting data in format:", format);
}

// Add event listener for device selector
document
  .getElementById("device-selector")
  ?.addEventListener("change", function () {
    changeDevice(this.value);
  });

console.log("=== MAIN.JS LOADED SUCCESSFULLY ===");
