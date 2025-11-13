// Historical Data FIXED - Handles both device types properly
// Replace your historical-data.js with this version

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

    console.log(
      `📊 Fetching hourly data for ${deviceId} on ${startOfDay.toDateString()}`
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      `/.netlify/functions/store-energy-data?` +
        new URLSearchParams({
          deviceId,
          startTime: startOfDay.toISOString(),
          endTime: endOfDay.toISOString(),
        }),
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);
    const result = await response.json();

    console.log(`📊 Hourly data result:`, result);

    // If device is switch-only (LDNIO SCW1050), return empty hourly data
    if (deviceId === "bf3ef2ae093d5173c3yma5") {
      console.log(
        `🚫 LDNIO SCW1050 detected - switch-only device, no power monitoring`
      );
      return []; // Empty data for switch-only devices
    }

    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Hourly data fetch timeout");
    } else {
      console.error("Error fetching hourly data:", error);
    }
    return [];
  }
}

// Get aggregated stats for a specific time period
async function getAggregatedStats(deviceId, startTime, endTime) {
  try {
    console.log(
      `📊 Fetching aggregated stats for ${deviceId} from ${startTime.toDateString()} to ${endTime.toDateString()}`
    );

    // If device is switch-only, return empty stats
    if (deviceId === "bf3ef2ae093d5173c3yma5") {
      console.log(`🚫 LDNIO SCW1050 detected - returning empty stats`);
      return {
        totalKWh: 0,
        totalCost: 0,
        maxWatts: 0,
        avgWatts: 0,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      `/.netlify/functions/get-historical-data?` +
        new URLSearchParams({
          deviceId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          type: "stats",
        }),
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("Failed to fetch aggregated stats");
      return null;
    }

    const result = await response.json();
    console.log(`📊 Aggregated stats result:`, result);
    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Aggregated stats fetch timeout");
    } else {
      console.error("Error fetching aggregated stats:", error);
    }
    return null;
  }
}

// Function to update historical view based on selected timeframe
async function updateHistoricalView() {
  const timeframe = document.getElementById("history-timeframe").value;
  console.log(
    `🔄 Updating historical view for timeframe: ${timeframe}, device: ${currentDeviceId}`
  );

  try {
    let statsData = null;
    let chartData = null;

    switch (timeframe) {
      case "today": {
        const today = new Date();
        const startOfDay = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );
        const now = new Date();

        console.log(
          `📅 Today: ${startOfDay.toDateString()} to ${now.toDateString()}`
        );

        // Get aggregated stats from database
        statsData = await getAggregatedStats(currentDeviceId, startOfDay, now);

        // Get hourly breakdown for charts
        chartData = await getHourlyData(currentDeviceId, today);
        break;
      }

      case "yesterday": {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfYesterday = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate()
        );
        const endOfYesterday = new Date(startOfYesterday);
        endOfYesterday.setDate(endOfYesterday.getDate() + 1);

        console.log(
          `📅 Yesterday: ${startOfYesterday.toDateString()} to ${endOfYesterday.toDateString()}`
        );

        // Get aggregated stats from database
        statsData = await getAggregatedStats(
          currentDeviceId,
          startOfYesterday,
          endOfYesterday
        );

        // Get hourly breakdown for charts
        chartData = await getHourlyData(currentDeviceId, yesterday);
        break;
      }

      case "last7": {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        console.log(
          `📅 Last 7 days: ${startDate.toDateString()} to ${endDate.toDateString()}`
        );

        // Get aggregated stats from database
        statsData = await getAggregatedStats(
          currentDeviceId,
          startDate,
          endDate
        );

        // For switch-only devices, skip daily breakdown
        if (currentDeviceId !== "bf3ef2ae093d5173c3yma5") {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(
              `/.netlify/functions/get-historical-data?` +
                new URLSearchParams({
                  deviceId: currentDeviceId,
                  startTime: startDate.toISOString(),
                  endTime: endDate.toISOString(),
                  type: "daily",
                }),
              { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            if (response.ok) {
              chartData = await response.json();
              console.log(`📊 Last 7 days daily data:`, chartData);
            }
          } catch (error) {
            console.error("Error fetching daily breakdown for last7:", error);
          }
        } else {
          console.log(`🚫 Skipping daily breakdown for switch-only device`);
          chartData = [];
        }
        break;
      }

      case "last30": {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        console.log(
          `📅 Last 30 days: ${startDate.toDateString()} to ${endDate.toDateString()}`
        );

        // Get aggregated stats from database
        statsData = await getAggregatedStats(
          currentDeviceId,
          startDate,
          endDate
        );

        // For switch-only devices, skip daily breakdown
        if (currentDeviceId !== "bf3ef2ae093d5173c3yma5") {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(
              `/.netlify/functions/get-historical-data?` +
                new URLSearchParams({
                  deviceId: currentDeviceId,
                  startTime: startDate.toISOString(),
                  endTime: endDate.toISOString(),
                  type: "daily",
                }),
              { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            if (response.ok) {
              chartData = await response.json();
              console.log(`📊 Last 30 days daily data:`, chartData);
            }
          } catch (error) {
            console.error("Error fetching daily breakdown for last30:", error);
          }
        } else {
          console.log(`🚫 Skipping daily breakdown for switch-only device`);
          chartData = [];
        }
        break;
      }
    }

    if (statsData) {
      updateHistoricalStats(statsData);
      console.log(`✅ Historical stats updated`);
    } else {
      console.log(`⚠️ No stats data received`);
      updateHistoricalStats({
        totalKWh: 0,
        totalCost: 0,
        maxWatts: 0,
        avgWatts: 0,
      });
    }

    // Always call updateHistoricalCharts, even with empty data
    updateHistoricalCharts(chartData || [], timeframe);
  } catch (error) {
    console.error("Error updating historical view:", error);
  }
}

// Function to update historical charts
function updateHistoricalCharts(data, timeframe) {
  console.log(`📊 Updating charts for ${timeframe} with data:`, data);

  if (!data) data = [];

  // Handle switch-only device message
  if (currentDeviceId === "bf3ef2ae093d5173c3yma5") {
    console.log(
      `🚫 LDNIO SCW1050: Switch-only device, showing appropriate message`
    );
    showSwitchOnlyDeviceMessage(timeframe);

    // Clear charts for switch-only device
    if (typeof patternsChart !== "undefined" && patternsChart.data) {
      const isHourly = timeframe === "today" || timeframe === "yesterday";
      const labels = isHourly
        ? Array.from({ length: 24 }, (_, i) => `${i}:00`)
        : Array.from({ length: 7 }, (_, i) => `Day ${i + 1}`);

      patternsChart.data.labels = labels;
      patternsChart.data.datasets[0].data = Array(labels.length).fill(0);
      patternsChart.update();
    }
    return;
  }

  if (timeframe === "today" || timeframe === "yesterday") {
    // Update hourly pattern chart
    console.log(`📈 Updating HOURLY chart for ${timeframe}`);
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const values = Array(24).fill(0);

    if (Array.isArray(data) && data.length > 0) {
      console.log(`📊 Processing ${data.length} hourly data points`);

      // Handle different data formats
      data.forEach((entry) => {
        console.log(`📊 Hourly entry:`, entry);

        if (entry.readings && Array.isArray(entry.readings)) {
          // Format: {readings: [{timestamp, watts}, ...]}
          entry.readings.forEach((reading) => {
            const hour = new Date(reading.timestamp).getHours();
            values[hour] = reading.watts || 0;
          });
        } else if (entry._id !== null && entry._id !== undefined) {
          // Format: [{_id: hour, avgWatts: value}, ...]
          const hour = parseInt(entry._id);
          const watts = entry.avgWatts || 0;
          values[hour] = watts;
          console.log(`📊 Hour ${hour}: ${watts}W`);
        } else if (entry.hour !== undefined && entry.watts !== undefined) {
          // Format: [{hour: number, watts: value}, ...]
          values[entry.hour] = entry.watts;
        }
      });
    } else {
      console.log(`⚠️ No hourly data available`);
    }

    console.log(`📊 Final hourly values:`, values);

    if (typeof patternsChart !== "undefined" && patternsChart.data) {
      patternsChart.data.labels = hours;
      patternsChart.data.datasets[0].data = values;
      patternsChart.update();
      console.log(`✅ Hourly chart updated successfully`);
    } else {
      console.log(`❌ patternsChart is not defined`);
    }
  } else {
    // Update daily pattern chart
    console.log(`📈 Updating DAILY chart for ${timeframe}`);
    let labels = [];
    let values = [];

    if (Array.isArray(data) && data.length > 0) {
      console.log(`📊 Processing ${data.length} daily data points`);

      labels = data.map((entry, index) => {
        console.log(`📊 Daily entry ${index}:`, entry);

        if (entry._id && entry._id.year && entry._id.month && entry._id.day) {
          // Format: [{_id: {year, month, day}, avgWatts: value}, ...]
          const date = new Date(
            entry._id.year,
            entry._id.month - 1,
            entry._id.day
          );
          return date.toLocaleDateString();
        } else if (entry.date) {
          // Format: [{date: "YYYY-MM-DD", avgWatts: value}, ...]
          return new Date(entry.date).toLocaleDateString();
        } else {
          return `Day ${index + 1}`;
        }
      });

      values = data.map((entry) => entry.avgWatts || 0);

      console.log(`📊 Final daily labels:`, labels);
      console.log(`📊 Final daily values:`, values);
    } else {
      console.log(`⚠️ No daily data available`);
      // Generate placeholder labels for empty data
      const days = timeframe === "last7" ? 7 : 30;
      labels = Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        return date.toLocaleDateString();
      });
      values = Array(days).fill(0);
    }

    if (typeof patternsChart !== "undefined" && patternsChart.data) {
      patternsChart.data.labels = labels;
      patternsChart.data.datasets[0].data = values;
      patternsChart.update();
      console.log(`✅ Daily chart updated successfully`);
    } else {
      console.log(`❌ patternsChart is not defined`);
    }
  }
}

// Function to update historical statistics from aggregated database data
function updateHistoricalStats(statsData) {
  let totalKWh = 0;
  let totalCost = 0;
  let maxWatts = 0;
  let avgWatts = 0;

  if (statsData) {
    totalKWh = statsData.totalKWh || 0;
    totalCost = statsData.totalCost || 0;
    maxWatts = statsData.maxWatts || 0;
    avgWatts = statsData.avgWatts || 0;
  }

  console.log(
    `📊 Updating stats: ${maxWatts}W max, ${avgWatts}W avg, ${totalKWh}kWh, ${totalCost}BDT`
  );

  // Update the UI elements
  const peakUsageElement = document.getElementById("peak-usage");
  const avgUsageElement = document.getElementById("avg-usage");
  const totalUsageElement = document.getElementById("total-usage");
  const totalCostElement = document.getElementById("total-cost");

  if (peakUsageElement)
    peakUsageElement.textContent = `${maxWatts.toFixed(1)}W`;
  if (avgUsageElement) avgUsageElement.textContent = `${avgWatts.toFixed(1)}W`;
  if (totalUsageElement)
    totalUsageElement.textContent = `${totalKWh.toFixed(3)} kWh`;
  if (totalCostElement)
    totalCostElement.textContent = `৳${totalCost.toFixed(2)}`;
}

// Show message for switch-only devices
function showSwitchOnlyDeviceMessage(timeframe) {
  console.log(`🚫 Showing switch-only device message for ${timeframe}`);

  // Update stats to show it's a switch-only device
  const peakUsageElement = document.getElementById("peak-usage");
  const avgUsageElement = document.getElementById("avg-usage");
  const totalUsageElement = document.getElementById("total-usage");
  const totalCostElement = document.getElementById("total-cost");

  if (peakUsageElement) peakUsageElement.textContent = `--`;
  if (avgUsageElement) avgUsageElement.textContent = `--`;
  if (totalUsageElement) totalUsageElement.textContent = `0.000 kWh`;
  if (totalCostElement) totalCostElement.textContent = `৳0.00`;

  // You can add a visual indicator here if needed
  console.log(
    `📱 LDNIO SCW1050: Switch-only device - No power monitoring available for ${timeframe}`
  );
}
