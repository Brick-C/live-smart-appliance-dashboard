// Enhanced Cost Integration for Both Device Types
// Replace your existing cost-calculator.js or integrate this logic

class CostCalculator {
  constructor() {
    this.ratePerKWh = 9.5; // BDT per kWh
    this.apiBaseUrl = window.location.origin;
  }

  // Calculate cost for power monitoring devices
  async calculateAndDisplayCosts(deviceId) {
    try {
      // Show loading state
      this.updateCostDisplays({ loading: true });

      // Get historical data for the last 24 hours
      const dailyData = await this.getHistoricalData(deviceId, 24);
      const weeklyData = await this.getHistoricalData(deviceId, 168); // 7 days

      // Calculate costs based on actual consumption
      const dailyCost = this.calculateCostFromData(dailyData);
      const weeklyCost = this.calculateCostFromData(weeklyData);

      this.updateCostDisplays({
        todayCost: dailyCost > 0 ? `${dailyCost.toFixed(2)} BDT` : "--",
        weekCost: weeklyCost > 0 ? `${weeklyCost.toFixed(2)} BDT` : "--",
        deviceType: this.isPowerMonitoringDevice(deviceId) ? "power" : "switch",
      });

      console.log(`Cost calculation for ${deviceId}:`);
      console.log(`Today's cost: ${dailyCost} BDT`);
      console.log(`This week's cost: ${weeklyCost} BDT`);
      console.log(
        `Device type: ${
          this.isPowerMonitoringDevice(deviceId)
            ? "Power Monitoring"
            : "Switch Only"
        }`
      );
    } catch (error) {
      console.error("Cost calculation failed:", error);
      this.updateCostDisplays({
        todayCost: "--",
        weekCost: "--",
        error: true,
      });
    }
  }

  // Get historical data from your store-energy-data endpoint
  async getHistoricalData(deviceId, hours) {
    const endTime = new Date();
    const startTime = new Date(endTime - hours * 60 * 60 * 1000);

    const response = await fetch(
      `${this.apiBaseUrl}/store-energy-data?` +
        new URLSearchParams({
          deviceId: deviceId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch historical data: ${response.status}`);
    }

    return await response.json();
  }

  // Calculate cost from energy data
  calculateCostFromData(energyData) {
    if (!energyData.readings || energyData.readings.length === 0) {
      return 0;
    }

    // For devices with actual power monitoring
    if (energyData.readings[0].kWh !== undefined) {
      const totalKWh = energyData.readings.reduce(
        (sum, reading) => sum + (reading.kWh || 0),
        0
      );
      return totalKWh * this.ratePerKWh;
    }

    // For devices without power monitoring, show estimated or zero cost
    return 0;
  }

  // Determine if device supports power monitoring
  isPowerMonitoringDevice(deviceId) {
    // Device ID 1 (Deep Freezer) has power monitoring
    // Device ID 2 (Computer) is switch-only
    return deviceId !== "bf3ef2ae093d5173c3yma5";
  }

  // Update HTML cost displays
  updateCostDisplays({ todayCost, weekCost, deviceType, loading, error } = {}) {
    const todayCostElement = document.getElementById("today-cost");
    const weekCostElement = document.getElementById("week-cost");

    if (loading) {
      if (todayCostElement) todayCostElement.textContent = "Loading...";
      if (weekCostElement) weekCostElement.textContent = "Loading...";
      return;
    }

    if (error) {
      if (todayCostElement) todayCostElement.textContent = "--";
      if (weekCostElement) weekCostElement.textContent = "--";
      return;
    }

    if (todayCostElement) todayCostElement.textContent = todayCost || "--";
    if (weekCostElement) weekCostElement.textContent = weekCost || "--";

    // Add device type indicator
    if (deviceType === "switch") {
      this.showDeviceTypeMessage("Switch-only device: No power monitoring");
    } else if (deviceType === "power") {
      this.showDeviceTypeMessage("Power monitoring enabled");
    }
  }

  showDeviceTypeMessage(message) {
    // Create or update device type indicator
    let indicator = document.getElementById("device-type-indicator");
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = "device-type-indicator";
      indicator.style.cssText =
        "font-size: 0.8em; color: #666; margin-top: 4px;";
      document.querySelector(".cost-summary").appendChild(indicator);
    }
    indicator.textContent = message;
  }
}

// Enhanced device switching with cost integration
function changeDeviceWithCosts(newDeviceId) {
  console.log(`Switching from current device to: ${newDeviceId}`);

  // Update device selector
  const deviceSelector = document.getElementById("device-selector");
  if (deviceSelector) {
    deviceSelector.value = newDeviceId;
  }

  // Reset charts before loading new data
  resetCharts();

  // Load historical data for the selected device
  loadHistoricalData(newDeviceId);

  // Initialize cost calculator
  const costCalculator = new CostCalculator();

  // Calculate costs for the new device
  costCalculator.calculateAndDisplayCosts(newDeviceId);

  // Update current device ID
  currentDeviceId = newDeviceId;

  console.log(`✅ Device switched to: ${newDeviceId}`);
}

// Enhanced cost updater that runs every 30 seconds
function startCostUpdater() {
  setInterval(async () => {
    if (currentDeviceId) {
      const costCalculator = new CostCalculator();
      await costCalculator.calculateAndDisplayCosts(currentDeviceId);
    }
  }, 30000); // Update every 30 seconds
}

// Initialize cost system when page loads
document.addEventListener("DOMContentLoaded", () => {
  // Start the cost updater
  startCostUpdater();

  // Calculate costs for initial device
  if (currentDeviceId) {
    const costCalculator = new CostCalculator();
    costCalculator.calculateAndDisplayCosts(currentDeviceId);
  }
});

// Manual cost refresh function
window.refreshCosts = async function () {
  if (currentDeviceId) {
    const costCalculator = new CostCalculator();
    await costCalculator.calculateAndDisplayCosts(currentDeviceId);
  }
};

// Override the existing changeDevice function if it exists
if (typeof window.changeDevice === "function") {
  const originalChangeDevice = window.changeDevice;
  window.changeDevice = function (newDeviceId) {
    // Call original changeDevice logic
    originalChangeDevice(newDeviceId);
    // Then update costs
    const costCalculator = new CostCalculator();
    costCalculator.calculateAndDisplayCosts(newDeviceId);
  };
}
