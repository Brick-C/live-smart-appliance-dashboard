const { TuyaContext } = require("@tuya/tuya-connector-nodejs");

// Load environment variables in development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Device configuration with capability detection
const DEVICES = [
  {
    id: process.env.DEVICE_ID_1,
    name: "Deep Freezer",
    location: "Smart Plug",
    type: "Smart Plug",
    powerMonitoring: true, // Has cur_power, cur_current, cur_voltage
  },
  {
    id: process.env.DEVICE_ID_2,
    name: "Computer",
    location: "Smart Plug",
    type: "Smart Plug",
    powerMonitoring: false, // Switch-only device
  },
];

exports.handler = async (event, context) => {
  // Initialize Tuya client
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

      const deviceId =
        command.deviceId ||
        event.queryStringParameters?.deviceId ||
        DEVICES[0].id;
      console.log("Using deviceId:", deviceId);

      const device = DEVICES.find((d) => d.id === deviceId);
      if (!device) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Device not found" }),
        };
      }

      // Toggle device using v2.0 Shadow Properties API
      console.log(`Toggling device ${device.name}...`);

      // Try shadow properties first
      let toggleResult;
      try {
        toggleResult = await tuya.request({
          path: `/v2.0/cloud/thing/${deviceId}/shadow/properties/issue`,
          method: "POST",
          body: {
            properties: [
              {
                code: "switch_1",
                value: true, // Always turn ON - this ensures device powers on
              },
            ],
          },
          timeout: 8000,
        });

        console.log("Toggle result:", toggleResult);

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            device: device.name,
            toggleResult: toggleResult.result || toggleResult,
            method: "Shadow Properties v2.0",
          }),
        };
      } catch (toggleError) {
        console.log("Shadow toggle failed, trying direct command...");

        // Fallback: Try direct device command
        const directResult = await tuya.request({
          path: `/v2.0/cloud/thing/${deviceId}/shadow/actions`,
          method: "POST",
          body: {
            code: "switch_1",
            value: true,
          },
        });

        console.log("Direct toggle result:", directResult);

        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            device: device.name,
            toggleResult: directResult.result || directResult,
            method: "Direct Command v2.0",
          }),
        };
      }
    } catch (error) {
      console.error("Toggle error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Toggle failed",
          details: error.message,
        }),
      };
    }
  }

  // Handle device status (GET)
  try {
    const deviceId = event.queryStringParameters?.deviceId || DEVICES[0].id;
    console.log("Fetching device status for:", deviceId);

    const device = DEVICES.find((d) => d.id === deviceId);
    if (!device) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Device not found" }),
      };
    }

    console.log(`=== FINAL SOLUTION ANALYSIS ===`);
    console.log(`Device: ${device.name} (${deviceId})`);
    console.log(`Power Monitoring: ${device.powerMonitoring}`);

    // Fetch device status using v2.0 Shadow Properties
    console.log("Fetching shadow properties...");
    const shadowResponse = await tuya.request({
      path: `/v2.0/cloud/thing/${deviceId}/shadow/properties`,
      method: "GET",
      timeout: 8000,
    });

    console.log(
      "Shadow response received:",
      shadowResponse.success ? "SUCCESS" : "FAILED"
    );

    let deviceData = {
      watts: 0,
      isDeviceOn: false,
      rawPowerValue: null,
      powerPropertyCode: null,
      switchState: null,
      device: {
        id: deviceId,
        name: device.name,
        location: device.location,
        type: device.type,
        online: true,
        isOn: false,
        powerMonitoring: device.powerMonitoring,
        v2APIUsed: true,
      },
      timestamp: Date.now(),
      energy: {
        kW: 0,
        ratePerKWh: 9.5,
        hourlyCost: 0,
        projectedDailyCost: 0,
      },
    };

    if (
      shadowResponse.success &&
      shadowResponse.result &&
      shadowResponse.result.properties
    ) {
      const properties = shadowResponse.result.properties;
      console.log(`Found ${properties.length} properties`);

      // Find switch state
      const switchProperty = properties.find((p) => p.code === "switch_1");
      if (switchProperty) {
        deviceData.isDeviceOn = switchProperty.value === true;
        deviceData.device.isOn = switchProperty.value === true;
        deviceData.switchState = switchProperty.value;
        console.log(`Switch state: ${switchProperty.value}`);
      }

      // Extract power data ONLY if device supports power monitoring
      if (device.powerMonitoring) {
        console.log(
          "🔋 Device supports power monitoring - extracting power data..."
        );

        // Enhanced power property extraction
        const powerProperties = {
          cur_power: "Current Power (W)",
          cur_current: "Current Current (mA)",
          cur_voltage: "Current Voltage (0.1V)",
          add_ele: "Total Electricity (kWh)",
          power: "Power (W)",
          electricity: "Electricity (kWh)",
          voltage: "Voltage (V)",
          current: "Current (A)",
        };

        for (const [propCode, description] of Object.entries(powerProperties)) {
          const property = properties.find((p) => p.code === propCode);
          if (
            property &&
            property.value !== null &&
            property.value !== undefined
          ) {
            let finalValue = property.value;
            let watts = 0;

            if (propCode === "cur_voltage") {
              // Convert from 0.1V format to volts
              finalValue = property.value / 10;
              console.log(`📊 ${description}: ${finalValue}V`);
            } else if (propCode === "cur_current") {
              // Convert from mA to A
              finalValue = property.value / 1000;
              console.log(`📊 ${description}: ${finalValue}A`);
            } else if (propCode === "add_ele") {
              // Convert to kWh
              finalValue = property.value / 100; // Assuming 0.01kWh units
              console.log(`📊 ${description}: ${finalValue}kWh`);
            } else if (propCode === "cur_power") {
              // Power is in Watts already
              watts = property.value;
              console.log(`📊 ${description}: ${watts}W`);
            } else {
              console.log(`📊 ${description}: ${finalValue}`);
            }

            if (propCode === "cur_power" && watts !== 0) {
              deviceData.watts = watts;
              deviceData.rawPowerValue = watts;
              deviceData.powerPropertyCode = propCode;
            }
          }
        }

        // Calculate energy data if we have power readings
        if (deviceData.watts > 0) {
          const kW = deviceData.watts / 1000;
          const hourlyCost = kW * 9.5;
          const projectedDailyCost = hourlyCost * 24;

          deviceData.energy = {
            kW: kW,
            ratePerKWh: 9.5,
            hourlyCost: hourlyCost,
            projectedDailyCost: projectedDailyCost,
          };

          console.log(
            `💰 Energy calculation: ${kW}kW × 9.5 BDT/kWh = ${hourlyCost} BDT/hour`
          );
        }
      } else {
        console.log("🚫 Device does NOT support power monitoring");
        console.log(
          "Available properties:",
          properties.map((p) => p.code).join(", ")
        );
      }
    }

    console.log("=== FINAL DEVICE DATA ===");
    console.log(`Power: ${deviceData.watts}W`);
    console.log(`Device ON: ${deviceData.isDeviceOn}`);
    console.log(`Power Monitoring: ${device.powerMonitoring}`);

    return {
      statusCode: 200,
      body: JSON.stringify(deviceData, null, 2),
    };
  } catch (error) {
    console.error("Error fetching device status:", error);

    // Fallback to basic response if API fails
    const fallbackData = {
      watts: 0,
      device: {
        id: event.queryStringParameters?.deviceId || DEVICES[0].id,
        name: "Unknown Device",
        online: false,
        error: true,
      },
      error: error.message,
    };

    return {
      statusCode: 500,
      body: JSON.stringify(fallbackData, null, 2),
    };
  }
};
