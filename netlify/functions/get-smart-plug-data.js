const { TuyaContext } = require("@tuya/tuya-connector-nodejs");

// Load environment variables in development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Define available devices
const DEVICES = [
  {
    id: process.env.DEVICE_ID_1,
    name: "Deep Freezer",
    location: "Smart Plug",
    type: "Smart Plug",
  },
  {
    id: process.env.DEVICE_ID_2,
    name: "Computer",
    location: "Smart Plug",
    type: "Smart Plug",
  },
];

exports.handler = async (event, context) => {
  // Initialize Tuya client with v2.0 API
  const ACCESS_ID = process.env.TUYA_ACCESS_ID;
  const ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET;

  if (!ACCESS_ID || !ACCESS_SECRET) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing Tuya API credentials" }),
    };
  }

  const tuya = new TuyaContext({
    baseUrl: "https://openapi.tuyaeu.com",
    accessKey: ACCESS_ID,
    secretKey: ACCESS_SECRET,
    timeout: 10000,
  });

  // Handle device control (POST)
  if (event.httpMethod === "POST") {
    try {
      const command = JSON.parse(event.body);
      console.log("Toggle command received:", command);

      // Extract deviceId from request body (for POST) or query params (for GET)
      const deviceId =
        command.deviceId ||
        event.queryStringParameters?.deviceId ||
        DEVICES[0].id;
      console.log("Using deviceId:", deviceId);

      if (command.action !== "toggle") {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid action" }),
        };
      }

      // === V2.0 API: Query current device status ===
      console.log("Querying device properties using v2.0 API...");
      const statusResponse = await Promise.race([
        tuya.request({
          method: "GET",
          path: `/v2.0/cloud/thing/${deviceId}/shadow/properties`,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Status request timeout")), 8000)
        ),
      ]);

      console.log(
        "V2.0 Status response:",
        JSON.stringify(statusResponse, null, 2)
      );

      // Check if the device responded correctly
      if (!statusResponse.success) {
        throw new Error(
          `Tuya API v2.0 request failed: ${
            statusResponse.msg || "Unknown error"
          }`
        );
      }

      // Extract switch status from v2.0 response structure
      const deviceState = statusResponse.result?.state || {};
      const currentSwitchState =
        deviceState.switch_1?.value || deviceState.switch_1;
      const newState = !currentSwitchState; // Toggle the state

      console.log("Current switch state:", currentSwitchState);
      console.log("New switch state:", newState);

      // === V2.0 API: Send toggle command ===
      console.log("Sending toggle command via v2.0 API...");
      await Promise.race([
        tuya.request({
          method: "POST",
          path: `/v2.0/cloud/thing/${deviceId}/shadow/properties/issue`,
          body: {
            properties: [
              {
                code: "switch_1",
                value: newState,
              },
            ],
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Toggle command timeout")), 8000)
        ),
      ]);

      console.log("Toggle command sent successfully");

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success: true,
          state: newState,
          deviceId: deviceId,
          message: "Device toggled via v2.0 API",
        }),
      };
    } catch (error) {
      console.error("Toggle error:", error);
      return {
        statusCode: 503,
        body: JSON.stringify({
          error: "Failed to toggle device",
          details: error.message,
          apiVersion: "v2.0",
        }),
      };
    }
  }

  try {
    // Handle list devices request
    if (
      event.httpMethod === "GET" &&
      event.queryStringParameters?.action === "list"
    ) {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          DEVICES.map((d) => ({
            id: d.id,
            name: d.name,
            location: d.location,
            type: d.type,
          }))
        ),
      };
    }

    // Get device ID from query parameters or use default
    const deviceId = event.queryStringParameters?.deviceId || DEVICES[0].id;
    const device = DEVICES.find((d) => d.id === deviceId) || DEVICES[0];

    console.log("=== V2.0 API: Querying device properties ===");
    console.log("Device ID:", deviceId);
    console.log("Device info:", device);

    // === V2.0 API: Get device properties and power data ===
    const response = await Promise.race([
      tuya.request({
        method: "GET",
        path: `/v2.0/cloud/thing/${deviceId}/shadow/properties`,
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Device properties request timeout")),
          8000
        )
      ),
    ]);

    console.log("=== V2.0 API Response ===");
    console.log("Full response:", JSON.stringify(response, null, 2));

    if (!response.success) {
      throw new Error(
        `Tuya v2.0 API request failed: ${response.msg || "Unknown error"}`
      );
    }

    // Extract device state from v2.0 response structure
    const deviceState = response.result?.state || {};
    const desiredState = response.result?.desired || {};
    const reportedState = response.result?.reported || {};

    console.log("Device state (shadow):", deviceState);
    console.log("Desired state:", desiredState);
    console.log("Reported state:", reportedState);

    // Extract power-related properties from v2.0 structure
    const switchState =
      deviceState.switch_1?.value ||
      deviceState.switch_1 ||
      reportedState.switch_1?.value;
    const currentPower =
      deviceState.cur_power?.value ||
      deviceState.cur_power ||
      reportedState.cur_power?.value;
    const voltage =
      deviceState.cur_voltage?.value ||
      deviceState.cur_voltage ||
      reportedState.cur_voltage?.value;
    const current =
      deviceState.cur_current?.value ||
      deviceState.cur_current ||
      reportedState.cur_current?.value;

    console.log("=== POWER DATA ANALYSIS ===");
    console.log("Switch state:", switchState);
    console.log("Current power (raw):", currentPower);
    console.log("Voltage:", voltage);
    console.log("Current:", current);

    // Determine if device is on
    const isDeviceOn = Boolean(switchState);

    // Process power data (convert to watts)
    let watts = 0;
    if (isDeviceOn && currentPower) {
      // Different devices may use different scaling factors
      // Test with common scaling factors
      if (currentPower > 10000) {
        watts = currentPower / 1000; // If value is in mW
      } else if (currentPower > 1000) {
        watts = currentPower / 10; // If value is in cW (centiwatts)
      } else {
        watts = currentPower; // If value is already in W
      }

      console.log("Processed watts:", watts);
    }

    // If still no power data, try alternative property codes for power monitoring
    if (watts === 0 && isDeviceOn) {
      console.log("Trying alternative power property codes...");

      // Try common alternative power monitoring codes
      const powerCodes = [
        "power",
        "pwr",
        "electric_power",
        "active_power",
        "power_consumption",
      ];

      for (const code of powerCodes) {
        const altPower =
          deviceState[code]?.value ||
          deviceState[code] ||
          reportedState[code]?.value;
        if (altPower && altPower > 0) {
          console.log(`Found power data with code ${code}:`, altPower);
          watts = altPower > 1000 ? altPower / 10 : altPower;
          break;
        }
      }
    }

    // Enhanced debugging for device analysis
    console.log("=== DEVICE ANALYSIS COMPLETE ===");
    console.log("Device is ON:", isDeviceOn);
    console.log("Power draw:", watts, "W");
    console.log("Raw power value:", currentPower);

    // Calculate costs
    const RATE_PER_KWH = process.env.ELECTRICITY_RATE || 9.5;
    const kW = watts / 1000;
    const hourlyRate = kW * RATE_PER_KWH;
    const dailyCost = hourlyRate * 24;

    // Prepare comprehensive response
    const responseData = {
      watts: Math.round(watts * 10) / 10, // Round to 1 decimal place
      device: {
        id: device.id,
        name: device.name,
        location: device.location,
        type: device.type,
        online: true,
        isOn: isDeviceOn,
        rawPowerValue: currentPower,
        v2APIUsed: true,
      },
      timestamp: Date.now(),
      energy: {
        kW: Math.round(kW * 1000) / 1000,
        ratePerKWh: RATE_PER_KWH,
        hourlyCost: Math.round(hourlyRate * 1000) / 1000,
        projectedDailyCost: Math.round(dailyCost * 100) / 100,
      },
      debug: {
        v2API: true,
        deviceState: deviceState,
        switchValue: switchState,
        powerValue: currentPower,
        processingApplied: currentPower ? "yes" : "no",
      },
    };

    console.log("=== FINAL RESPONSE ===");
    console.log(JSON.stringify(responseData, null, 2));

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(responseData),
    };
  } catch (error) {
    console.error("=== V2.0 API ERROR ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    return {
      statusCode: 502,
      body: JSON.stringify({
        error: error.message,
        apiVersion: "v2.0",
        suggestion: "Check device ID and API credentials",
      }),
    };
  }
};
