// Device management
let currentDeviceId = null;
let devices = [];

function updateDeviceInfo(device) {
  // Update the device information in the UI
  const deviceName = document.getElementById("device-name");
  const deviceType = document.getElementById("device-type");
  const deviceId = document.getElementById("device-id");

  if (deviceName) deviceName.textContent = device.name || "Unknown Device";
  if (deviceType) deviceType.textContent = device.type || "Unknown Type";
  if (deviceId) deviceId.textContent = device.id || "Unknown ID";
}

async function loadDevices() {
  try {
    const response = await fetch(
      "/.netlify/functions/get-smart-plug-data?action=list"
    );
    if (!response.ok) throw new Error("Failed to load devices");

    devices = await response.json();
    const selector = document.getElementById("device-selector");
    selector.innerHTML = devices
      .map((d) => `<option value="${d.id}">${d.name} (${d.type})</option>`)
      .join("");

    // Select first device by default
    if (devices.length > 0) {
      currentDeviceId = devices[0].id;
      selector.value = currentDeviceId;
      updateDeviceInfo(devices[0]);
    }
  } catch (error) {
    console.error("Error loading devices:", error);
    document.getElementById("device-selector").innerHTML =
      '<option value="">Error loading devices</option>';
  }
}

async function changeDevice(deviceId) {
  if (deviceId === currentDeviceId) return;

  currentDeviceId = deviceId;
  const device = devices.find((d) => d.id === deviceId);
  if (device) {
    updateDeviceInfo(device);
    // Reset charts
    powerData.labels = [];
    powerData.watts = [];
    powerData.kwh = [];
    powerData.cumulativeKWh = 0;
    powerChart.update();
    energyChart.update();
    // Fetch new device data
    await fetchDataAndRender();
  }
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
        title: { display: true, text: "Watts" },
        beginAtZero: true,
      },
      x: {
        title: { display: true, text: "Time" },
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
        label: "Energy Consumption (kWh)",
        data: powerData.kwh,
        backgroundColor: "rgb(168, 85, 247)",
        borderWidth: 1,
      },
    ],
  },
  options: {
    responsive: true,
    animation: false,
    scales: {
      y: {
        title: { display: true, text: "Energy (kWh)" },
        beginAtZero: true,
      },
      x: {
        title: { display: true, text: "Time" },
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
  // This is the standard path to Netlify function.
  const apiEndpoint = `/.netlify/functions/get-smart-plug-data${
    currentDeviceId ? `?deviceId=${currentDeviceId}` : ""
  }`;

  const response = await fetch(apiEndpoint);

  if (!response.ok) {
    // Show error details if the serverless function fails
    const errorText = await response.text();
    throw new Error(`API function failed: ${errorText}`);
  }

  const data = await response.json();
  return data;
}

// DATA PROCESSING & CHART UPDATE
async function processAndRenderData(newData) {
  const now = new Date();
  const timeLabel = now.toLocaleTimeString();

  // 1. Calculate Energy (kWh) consumed since the last update
  const deltaMs = newData.timestamp - lastUpdateTimestamp;
  lastUpdateTimestamp = newData.timestamp;

  const powerInKW = newData.watts / 1000;
  const timeInHours = deltaMs / 3600000;
  const kwh_increment = powerInKW * timeInHours;

  // Store the data in our database with retry logic
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch("/.netlify/functions/store-energy-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId: currentDeviceId,
          watts: newData.watts,
          kWh: kwh_increment,
          cost: newData.energy ? kwh_increment * newData.energy.ratePerKWh : 0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
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

      // Exponential backoff between retries
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1000 * Math.pow(2, retryCount), 5000))
      );
    }
  }

  // 2. Update Data Arrays (for charts)
  powerData.labels.push(timeLabel);
  powerData.watts.push(newData.watts);
  powerData.kwh.push(kwh_increment);

  // 3. Update Cumulative Energy
  powerData.cumulativeKWh += kwh_increment;

  // 4. Manage Data History
  if (powerData.labels.length > MAX_DATA_POINTS) {
    powerData.labels.shift();
    powerData.watts.shift();
    powerData.kwh.shift();
  }

  // 5. Update Charts
  powerChart.update("none");
  energyChart.update("none");

  // Update dashboard stats with null checks
  const currentWattsElement = document.getElementById("current-watts");
  if (currentWattsElement) {
    currentWattsElement.textContent = `${newData.watts} W`;
  }

  const totalKwhElement = document.getElementById("total-kwh");
  if (totalKwhElement) {
    totalKwhElement.textContent = `${powerData.cumulativeKWh.toFixed(4)} kWh`;
  }

  const lastUpdateElement = document.getElementById("last-update");
  if (lastUpdateElement) {
    lastUpdateElement.textContent = timeLabel;
  }

  // Update cost information
  if (newData.energy) {
    document.getElementById(
      "rate-per-kwh"
    ).textContent = `$${newData.energy.ratePerKWh.toFixed(2)}/kWh`;
    document.getElementById(
      "hourly-cost"
    ).textContent = `$${newData.energy.hourlyCost.toFixed(3)}/hr`;
    document.getElementById(
      "daily-cost"
    ).textContent = `$${newData.energy.projectedDailyCost.toFixed(2)}`;
  }

  // Update historical data and analytics
  updateHistoricalData(newData);
  updateAnalytics(newData);

  // Update cost displays with current electricity rate
  updateCostDisplays();
}

//MAIN LOOP
async function fetchDataAndRender() {
  document.getElementById("api-status").textContent = "Fetching...";
  document.getElementById("api-status").classList.remove("text-green-500");
  document.getElementById("api-status").classList.add("text-yellow-600");

  try {
    const data = await getRealTimeSmartPlugData();
    processAndRenderData(data);

    document.getElementById("api-status").textContent = "Success";
    document
      .getElementById("api-status")
      .classList.remove("text-yellow-600", "text-red-600");
    document.getElementById("api-status").classList.add("text-green-500");
  } catch (error) {
    console.error("Failed to fetch smart plug data:", error);
    document.getElementById("api-status").textContent = "ERROR";
    document
      .getElementById("api-status")
      .classList.remove("text-yellow-600", "text-green-500");
    document.getElementById("api-status").classList.add("text-red-600");
  }
}

// Start the initial fetch immediately, then set the interval
window.onload = function () {
  // Run updates on the charts once the page is loaded
  powerChart.update();
  energyChart.update();

  // Load available devices first
  loadDevices().then(async () => {
    // Load historical data from the server
    try {
      const response = await fetch(
        "/.netlify/functions/store-energy-data?" +
          new URLSearchParams({
            deviceId: currentDeviceId,
            startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
          })
      );

      if (response.ok) {
        const historicalData = await response.json();
        // Process historical data
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
    } catch (error) {
      console.error("Failed to load historical data:", error);
    }

    // Start real-time updates
    fetchDataAndRender();
    setInterval(fetchDataAndRender, updateIntervalMs);

    // Save historical data every 5 minutes
    setInterval(saveHistoricalData, 5 * 60 * 1000);
  });
};

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
  // Update daily data
  const now = new Date();
  analytics.dailyData.today.push({
    time: now,
    watts: newData.watts,
    cost: (newData.watts / 1000) * newData.energy.ratePerKWh,
  });

  // Calculate efficiency score (0-100)
  const efficiencyScore = calculateEfficiencyScore(newData.watts);
  document.getElementById("efficiency-score").textContent = efficiencyScore;
  updateEfficiencyLabel(efficiencyScore);

  // Update cost insights
  updateCostInsights(newData);

  // Update usage analysis
  updateUsageAnalysis(newData);

  // Generate and update smart tips
  updateSmartTips(newData);
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

function updateCostInsights(newData) {
  // Calculate today's total cost
  const todayTotal = analytics.dailyData.today.reduce(
    (sum, data) => sum + data.cost,
    0
  );

  // Project monthly cost
  const projectedMonthly = (todayTotal / new Date().getHours()) * 24 * 30;

  document.getElementById("cost-comparison").textContent = analytics.dailyData
    .yesterday.length
    ? `${(
        (todayTotal /
          analytics.dailyData.yesterday.reduce(
            (sum, data) => sum + data.cost,
            0
          ) -
          1) *
        100
      ).toFixed(1)}%`
    : "No data";

  document.getElementById(
    "projected-cost"
  ).textContent = `$${projectedMonthly.toFixed(2)}`;
}

function updateUsageAnalysis(newData) {
  // Detect standby power waste
  const standbyDetection = document.getElementById("standby-detection");
  if (newData.watts > analytics.baselineWatts && newData.watts < 50) {
    standbyDetection.textContent = "Possible standby power waste detected";
    standbyDetection.className = "text-sm text-yellow-600";
  } else if (newData.watts <= analytics.baselineWatts) {
    standbyDetection.textContent = "Normal standby power";
    standbyDetection.className = "text-sm text-green-600";
  }

  // Update peak times
  const peakTimes = document.getElementById("peak-times");
  if (newData.watts > analytics.peakThreshold) {
    peakTimes.textContent = "High usage detected - Consider rescheduling usage";
    peakTimes.className = "text-sm text-red-600";
  } else {
    peakTimes.textContent = "Normal usage pattern";
    peakTimes.className = "text-sm text-green-600";
  }
}

function updateSmartTips(newData) {
  const tips = [];
  const hour = new Date().getHours();

  if (newData.watts > analytics.peakThreshold) {
    tips.push(
      "⚡ High power usage detected. Consider spreading usage throughout the day."
    );
  }

  if (newData.watts > analytics.baselineWatts && newData.watts < 50) {
    tips.push("💡 Standby power detected. Consider using a smart power strip.");
  }

  if (hour >= 23 || hour <= 5) {
    tips.push(
      "🌙 Night-time usage detected. Check for unnecessary active devices."
    );
  }

  if (analytics.dailyData.today.length > 0) {
    const avgWatts =
      analytics.dailyData.today.reduce((sum, data) => sum + data.watts, 0) /
      analytics.dailyData.today.length;
    if (avgWatts > 500) {
      tips.push(
        "📊 Today's average usage is high. Review device settings for energy savings."
      );
    }
  }

  document.getElementById("energy-tips").innerHTML =
    tips.length > 0
      ? tips.map((tip) => `<li>${tip}</li>`).join("")
      : "<li>✅ No immediate energy saving opportunities identified.</li>";
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
  patternsChart.update();

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

function updateDailySummary(newData) {
  const timeframe = document.getElementById("history-timeframe").value;
  const peakUsage = Math.max(...powerData.watts);
  const avgUsage =
    powerData.watts.reduce((a, b) => a + b, 0) / powerData.watts.length;

  document.getElementById("peak-usage").textContent = `${peakUsage.toFixed(
    1
  )}W`;
  document.getElementById("avg-usage").textContent = `${avgUsage.toFixed(1)}W`;
  document.getElementById(
    "total-usage"
  ).textContent = `${powerData.cumulativeKWh.toFixed(3)} kWh`;
  document.getElementById("total-cost").textContent = `$${(
    powerData.cumulativeKWh * newData.energy.ratePerKWh
  ).toFixed(2)}`;
}

// Export functionality
async function exportData(format) {
  try {
    // Fetch latest data to get current rate
    const currentData = await getRealTimeSmartPlugData();
    const ratePerKWh = currentData.energy?.ratePerKWh || 0.12; // Use default if not available

    const timeframe = document.getElementById("history-timeframe").value;
    const exportData = {
      device:
        devices.find((d) => d.id === currentDeviceId)?.name || "Unknown Device",
      timeframe,
      timestamp: new Date().toISOString(),
      readings: powerData.watts.map((watts, i) => ({
        time: powerData.labels[i],
        watts,
        kWh: powerData.kwh[i],
      })),
      summary: {
        peakUsage: Math.max(...powerData.watts),
        averageUsage:
          powerData.watts.reduce((a, b) => a + b, 0) / powerData.watts.length,
        totalKWh: powerData.cumulativeKWh,
        totalCost: powerData.cumulativeKWh * ratePerKWh,
      },
    };

    let dataStr;
    let fileName;

    if (format === "json") {
      dataStr = JSON.stringify(exportData, null, 2);
      fileName = `energy-data-${timeframe}-${new Date().toISOString()}.json`;
    } else {
      // CSV format
      const csvRows = [
        ["Time", "Watts", "kWh", "Cost"],
        ...exportData.readings.map((r) => [
          r.time,
          r.watts.toFixed(2),
          r.kWh.toFixed(4),
          (r.kWh * ratePerKWh).toFixed(2),
        ]),
        [], // Empty row for summary
        ["Summary"],
        ["Peak Usage (W)", exportData.summary.peakUsage.toFixed(2)],
        ["Average Usage (W)", exportData.summary.averageUsage.toFixed(2)],
        ["Total Energy (kWh)", exportData.summary.totalKWh.toFixed(4)],
        ["Total Cost ($)", exportData.summary.totalCost.toFixed(2)],
      ];
      dataStr = csvRows.map((row) => row.join(",")).join("\n");
      fileName = `energy-data-${timeframe}-${new Date().toISOString()}.csv`;
    }

    const blob = new Blob([dataStr], {
      type: format === "json" ? "application/json" : "text/csv",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Error exporting data:", error);
    alert("Failed to export data. Please try again.");
  }
}

// Update historical view when timeframe changes
document
  .getElementById("history-timeframe")
  .addEventListener("change", function () {
    updateHistoricalView();
  });

// Device control functionality
let isDeviceOn = true; // Track device state

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
      body: JSON.stringify({ action: "toggle" }),
    });

    if (!response.ok) {
      throw new Error("Failed to toggle device");
    }

    // Update button state
    isDeviceOn = !isDeviceOn;
    button.textContent = isDeviceOn ? "Turn OFF" : "Turn ON";

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
