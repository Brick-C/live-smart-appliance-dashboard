// Enhanced historical data debugging
async function debugHistoricalData() {
  const timeframe = document.getElementById("history-timeframe").value;
  console.log(`🔍 DEBUGGING HISTORICAL DATA - Timeframe: ${timeframe}`);

  try {
    let startTime, endTime, dataSource;

    switch (timeframe) {
      case "yesterday":
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        startTime = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate()
        );
        endTime = new Date(startTime);
        endTime.setDate(endTime.getDate() + 1);
        console.log(
          `📅 Yesterday range: ${startTime.toISOString()} to ${endTime.toISOString()}`
        );
        break;

      case "last7":
        endTime = new Date();
        startTime = new Date();
        startTime.setDate(startTime.getDate() - 7);
        console.log(
          `📅 Last 7 days range: ${startTime.toISOString()} to ${endTime.toISOString()}`
        );
        break;

      case "last30":
        endTime = new Date();
        startTime = new Date();
        startTime.setDate(startTime.getDate() - 30);
        console.log(
          `📅 Last 30 days range: ${startTime.toISOString()} to ${endTime.toISOString()}`
        );
        break;

      default:
        startTime = new Date();
        startTime.setHours(0, 0, 0, 0);
        endTime = new Date();
        console.log(
          `📅 Today range: ${startTime.toISOString()} to ${endTime.toISOString()}`
        );
    }

    // Test direct database query
    console.log(`🔍 Testing database query for device: ${currentDeviceId}`);

    const response = await fetch(
      `/.netlify/functions/store-energy-data?` +
        new URLSearchParams({
          deviceId: currentDeviceId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        })
    );

    const rawData = await response.json();
    console.log(`📊 Raw database response:`, rawData);
    console.log(
      `📊 Data length: ${
        rawData.readings ? rawData.readings.length : 0
      } readings`
    );

    if (rawData.readings && rawData.readings.length > 0) {
      console.log(`✅ Found ${rawData.readings.length} historical readings`);
      console.log(`📈 First reading:`, rawData.readings[0]);
      console.log(
        `📈 Last reading:`,
        rawData.readings[rawData.readings.length - 1]
      );
    } else {
      console.log(`❌ No historical data found for this timeframe`);
      console.log(`🔍 This could mean:`);
      console.log(`   1. No data was stored for this device in the database`);
      console.log(`   2. The device wasn't recording during this period`);
      console.log(
        `   3. The second device (LDNIO SCW1050) has no power monitoring`
      );
    }

    // Test aggregated data
    console.log(`🔍 Testing aggregated data...`);

    const aggResponse = await fetch(
      `/.netlify/functions/get-historical-data?` +
        new URLSearchParams({
          deviceId: currentDeviceId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          type:
            timeframe === "today" || timeframe === "yesterday"
              ? "hourly"
              : "daily",
        })
    );

    const aggData = await aggResponse.json();
    console.log(`📊 Aggregated data response:`, aggData);
  } catch (error) {
    console.error(`❌ Error in historical data debug:`, error);
  }
}

// Enhanced chart update with better debugging
function updateHistoricalChartsEnhanced(data, timeframe) {
  console.log(`📊 Updating charts for timeframe: ${timeframe}`);
  console.log(`📊 Data received:`, data);

  if (!data) {
    console.log(`⚠️ No data provided to chart update`);
    // Clear charts
    if (typeof patternsChart !== "undefined" && patternsChart.data) {
      patternsChart.data.labels = [];
      patternsChart.data.datasets[0].data = [];
      patternsChart.update();
    }
    return;
  }

  if (timeframe === "today" || timeframe === "yesterday") {
    console.log(`📈 Updating HOURLY chart for ${timeframe}`);

    // Enhanced hourly data processing
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const values = Array(24).fill(0);

    if (Array.isArray(data) && data.length > 0) {
      console.log(`📊 Processing ${data.length} hourly data points`);

      data.forEach((entry, index) => {
        console.log(`📊 Hourly entry ${index}:`, entry);

        if (entry._id !== null && entry._id !== undefined) {
          const hour = parseInt(entry._id);
          const watts = entry.avgWatts || 0;
          values[hour] = watts;
          console.log(`📊 Hour ${hour}: ${watts}W`);
        }
      });
    } else {
      console.log(
        `⚠️ No hourly data available - this might explain why charts appear empty`
      );
    }

    console.log(`📊 Final hourly values:`, values);

    if (typeof patternsChart !== "undefined" && patternsChart.data) {
      patternsChart.data.labels = hours;
      patternsChart.data.datasets[0].data = values;
      patternsChart.update();
      console.log(`✅ Hourly chart updated successfully`);
    } else {
      console.log(`❌ patternsChart is not defined or not ready`);
    }
  } else {
    console.log(`📈 Updating DAILY chart for ${timeframe}`);

    // Enhanced daily data processing
    let labels = [];
    let values = [];

    if (Array.isArray(data) && data.length > 0) {
      console.log(`📊 Processing ${data.length} daily data points`);

      labels = data.map((entry, index) => {
        console.log(`📊 Daily entry ${index}:`, entry);

        if (entry._id && entry._id.year && entry._id.month && entry._id.day) {
          const date = new Date(
            entry._id.year,
            entry._id.month - 1,
            entry._id.day
          );
          return date.toLocaleDateString();
        }
        return `Day ${index + 1}`;
      });

      values = data.map((entry) => entry.avgWatts || 0);

      console.log(`📊 Final daily labels:`, labels);
      console.log(`📊 Final daily values:`, values);
    } else {
      console.log(
        `⚠️ No daily data available - this might explain why charts appear empty`
      );
    }

    if (typeof patternsChart !== "undefined" && patternsChart.data) {
      patternsChart.data.labels = labels;
      patternsChart.data.datasets[0].data = values;
      patternsChart.update();
      console.log(`✅ Daily chart updated successfully`);
    } else {
      console.log(`❌ patternsChart is not defined or not ready`);
    }
  }
}

// Enhanced historical view with better debugging
async function updateHistoricalViewEnhanced() {
  const timeframe = document.getElementById("history-timeframe").value;
  console.log(`🔄 ENHANCED UPDATE HISTORICAL VIEW - Timeframe: ${timeframe}`);

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
          `📅 Today range: ${startOfDay.toISOString()} to ${now.toISOString()}`
        );

        statsData = await getAggregatedStats(currentDeviceId, startOfDay, now);
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
          `📅 Yesterday range: ${startOfYesterday.toISOString()} to ${endOfYesterday.toISOString()}`
        );

        statsData = await getAggregatedStats(
          currentDeviceId,
          startOfYesterday,
          endOfYesterday
        );
        chartData = await getHourlyData(currentDeviceId, yesterday);
        break;
      }

      case "last7": {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        console.log(
          `📅 Last 7 days range: ${startDate.toISOString()} to ${endDate.toISOString()}`
        );

        statsData = await getAggregatedStats(
          currentDeviceId,
          startDate,
          endDate
        );

        try {
          const response = await fetch(
            `/.netlify/functions/get-historical-data?` +
              new URLSearchParams({
                deviceId: currentDeviceId,
                startTime: startDate.toISOString(),
                endTime: endDate.toISOString(),
                type: "daily",
              })
          );

          if (response.ok) {
            chartData = await response.json();
            console.log(`📊 Last 7 days chart data:`, chartData);
          }
        } catch (error) {
          console.error("Error fetching daily breakdown for last7:", error);
        }
        break;
      }

      case "last30": {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        console.log(
          `📅 Last 30 days range: ${startDate.toISOString()} to ${endDate.toISOString()}`
        );

        statsData = await getAggregatedStats(
          currentDeviceId,
          startDate,
          endDate
        );

        try {
          const response = await fetch(
            `/.netlify/functions/get-historical-data?` +
              new URLSearchParams({
                deviceId: currentDeviceId,
                startTime: startDate.toISOString(),
                endTime: endDate.toISOString(),
                type: "daily",
              })
          );

          if (response.ok) {
            chartData = await response.json();
            console.log(`📊 Last 30 days chart data:`, chartData);
          }
        } catch (error) {
          console.error("Error fetching daily breakdown for last30:", error);
        }
        break;
      }
    }

    console.log(`📊 Stats data received:`, statsData);
    console.log(`📊 Chart data received:`, chartData);

    if (statsData) {
      updateHistoricalStats(statsData);
      console.log(`✅ Historical stats updated`);
    } else {
      console.log(`⚠️ No stats data received`);
    }

    updateHistoricalChartsEnhanced(chartData || [], timeframe);
  } catch (error) {
    console.error("❌ Error updating historical view:", error);
  }
}

// Replace the existing event listener to use enhanced version
document.addEventListener("DOMContentLoaded", () => {
  const timeframeSelect = document.getElementById("history-timeframe");
  if (timeframeSelect) {
    timeframeSelect.addEventListener("change", async function () {
      console.log(`🔄 Timeframe changed to: ${this.value}`);

      // First, run debug to see what's happening
      await debugHistoricalData();

      // Then update the view with enhanced debugging
      await updateHistoricalViewEnhanced();
    });
  }
});

// Add a manual debug button for testing
function addHistoricalDebugButton() {
  const button = document.createElement("button");
  button.textContent = "🔍 Debug Historical Data";
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #4F46E5;
    color: white;
    padding: 10px 15px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    z-index: 1000;
    font-size: 12px;
  `;

  button.addEventListener("click", async () => {
    console.log(`🔍 Starting manual historical data debug...`);
    await debugHistoricalData();
  });

  document.body.appendChild(button);
}

// Call this to add the debug button
addHistoricalDebugButton();

console.log(`✅ Historical data debug tools loaded`);
console.log(`📝 Instructions:`);
console.log(`1. Open browser console (F12)`);
console.log(`2. Change timeframe in the historical section`);
console.log(`3. Watch the console for detailed debug information`);
console.log(`4. Click the debug button (bottom-right) for manual testing`);
