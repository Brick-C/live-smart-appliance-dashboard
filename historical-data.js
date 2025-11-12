// Functions to fetch and display historical data
async function getHourlyData(deviceId, date = null) {
  try {
    // If date is provided, use it; otherwise use today
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const response = await fetch(
      `/.netlify/functions/store-energy-data?` +
        new URLSearchParams({
          deviceId,
          startTime: startOfDay.toISOString(),
          endTime: endOfDay.toISOString(),
        })
    );
    return await response.json();
  } catch (error) {
    console.error("Error fetching hourly data:", error);
    return null;
  }
}

async function getWeeklyData(deviceId, startDate = null, endDate = null) {
  try {
    // Default to last 7 days if dates not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const response = await fetch(
      `/.netlify/functions/store-energy-data?` +
        new URLSearchParams({
          deviceId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        })
    );
    return await response.json();
  } catch (error) {
    console.error("Error fetching weekly data:", error);
    return null;
  }
}

// Function to update historical view based on selected timeframe
async function updateHistoricalView() {
  const timeframe = document.getElementById("history-timeframe").value;

  try {
    let data;
    switch (timeframe) {
      case "today": {
        data = await getHourlyData(currentDeviceId, new Date());
        break;
      }
      case "yesterday": {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        data = await getHourlyData(currentDeviceId, yesterday);
        break;
      }
      case "last7": {
        data = await getWeeklyData(currentDeviceId);
        break;
      }
      case "last30": {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        data = await getWeeklyData(currentDeviceId, startDate, endDate);
        break;
      }
    }

    if (data && Array.isArray(data)) {
      // Update charts and statistics
      updateHistoricalCharts(data, timeframe);
      updateHistoricalStats(data);
    }
  } catch (error) {
    console.error("Error updating historical view:", error);
  }
}

// Function to update historical charts
function updateHistoricalCharts(data, timeframe) {
  if (timeframe === "today" || timeframe === "yesterday") {
    // Update hourly pattern chart
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const values = Array(24).fill(0);

    data.forEach((entry) => {
      values[entry._id] = entry.avgWatts;
    });

    patternsChart.data.labels = hours;
    patternsChart.data.datasets[0].data = values;
    patternsChart.update();
  } else {
    // Update daily pattern chart
    const labels = data.map((entry) =>
      new Date(
        entry._id.year,
        entry._id.month - 1,
        entry._id.day
      ).toLocaleDateString()
    );
    const values = data.map((entry) => entry.avgWatts);

    patternsChart.data.labels = labels;
    patternsChart.data.datasets[0].data = values;
    patternsChart.update();
  }
}

// Function to update historical statistics
function updateHistoricalStats(data) {
  let totalKWh = 0;
  let totalCost = 0;
  let maxWatts = 0;
  let avgWatts = 0;

  if (Array.isArray(data)) {
    data.forEach((entry) => {
      totalKWh += entry.totalKWh || 0;
      totalCost += entry.totalCost || 0;
      maxWatts = Math.max(maxWatts, entry.maxWatts || 0);
      avgWatts += entry.avgWatts || 0;
    });
    avgWatts = avgWatts / data.length;
  }

  // Update the UI elements
  document.getElementById("peak-usage").textContent = `${maxWatts.toFixed(1)}W`;
  document.getElementById("avg-usage").textContent = `${avgWatts.toFixed(1)}W`;
  document.getElementById("total-usage").textContent = `${totalKWh.toFixed(
    3
  )} kWh`;
  document.getElementById("total-cost").textContent = `৳${totalCost.toFixed(
    2
  )}`;
}
