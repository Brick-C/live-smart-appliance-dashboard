// Default electricity rate
let electricityRate =
  parseFloat(localStorage.getItem("electricityRate")) || 0.15;

// Function to update electricity rate
function updateElectricityRate(rate) {
  rate = parseFloat(rate);
  if (rate >= 0) {
    electricityRate = rate;
    localStorage.setItem("electricityRate", rate.toString());
    // Update displayed costs
    updateCostDisplays();
  }
}

// Function to calculate cost for a given kWh usage
function calculateCost(kWh) {
  return kWh * electricityRate;
}

// Function to calculate daily cost from historical data
async function calculateDailyCost(deviceId, date = new Date()) {
  try {
    const startOfDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const endOfDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1
    );

    const response = await fetch(
      `/.netlify/functions/get-historical-data?` +
        new URLSearchParams({
          deviceId,
          type: "hourly",
          startTime: startOfDay.toISOString(),
          endTime: endOfDay.toISOString(),
        })
    );
    const data = await response.json();

    const totalKWh = data.reduce((sum, reading) => sum + (reading.kWh || 0), 0);
    return calculateCost(totalKWh);
  } catch (error) {
    console.error("Error calculating daily cost:", error);
    return 0;
  }
}

// Function to calculate weekly cost
async function calculateWeeklyCost(deviceId) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const response = await fetch(
      `/.netlify/functions/get-historical-data?` +
        new URLSearchParams({
          deviceId,
          type: "daily",
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        })
    );
    const data = await response.json();

    const totalKWh = data.reduce(
      (sum, reading) => sum + (reading.totalKWh || 0),
      0
    );
    return calculateCost(totalKWh);
  } catch (error) {
    console.error("Error calculating weekly cost:", error);
    return 0;
  }
}

// Function to update all cost displays
async function updateCostDisplays() {
  if (!currentDeviceId) return;

  // Update today's cost
  const todayCost = await calculateDailyCost(currentDeviceId);
  document.getElementById("today-cost").textContent = `$${todayCost.toFixed(
    2
  )}`;

  // Update this week's cost
  const weekCost = await calculateWeeklyCost(currentDeviceId);
  document.getElementById("week-cost").textContent = `$${weekCost.toFixed(2)}`;

  // Update rate display
  document.getElementById("electricity-rate").value =
    electricityRate.toFixed(2);
}

// Initialize electricity rate on page load
window.addEventListener("load", () => {
  document.getElementById("electricity-rate").value =
    electricityRate.toFixed(2);
  updateCostDisplays();
});
