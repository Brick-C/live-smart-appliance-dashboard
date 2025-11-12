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
    id: process.env.DEVICE_ID_2 || "device_id_2",
    name: "Computer",
    location: "Smart Plug",
    type: "Smart Plug",
  },
];

exports.handler = async (event, context) => {
  // Initialize Tuya client first
  const ACCESS_ID = process.env.TUYA_ACCESS_ID;
  const ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET;

  if (!ACCESS_ID || !ACCESS_SECRET) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing Tuya API credentials" }),
    };
  }

  const tuya = new TuyaContext({
    baseUrl: "https://openapi.tuyaeu.com", // Use your project's datacenter
    accessKey: ACCESS_ID,
    secretKey: ACCESS_SECRET,
    timeout: 10000, // 10 second timeout
  });

  // Check if this is a control command
  if (event.httpMethod === "POST") {
    try {
      const command = JSON.parse(event.body);
      if (command.action !== "toggle") {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid action" }),
        };
      }

      const deviceId = event.queryStringParameters?.deviceId || DEVICES[0].id;

      // Get current status first with timeout
      const statusResponse = await Promise.race([
        tuya.request({
          method: "GET",
          path: `/v1.0/devices/${deviceId}/status`,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Status request timeout")), 8000)
        ),
      ]);

      const currentState = statusResponse.result.find(
        (x) => x.code === "switch_1"
      )?.value;
      const newState = !currentState; // Toggle the state

      // Send toggle command with timeout
      await Promise.race([
        tuya.request({
          method: "POST",
          path: `/v1.0/devices/${deviceId}/commands`,
          body: {
            commands: [
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

      console.log("Using Tuya region:", "https://openapi.tuyaeu.com");
      console.log("ACCESS_ID present:", !!ACCESS_ID);
      console.log("ACCESS_SECRET present:", !!ACCESS_SECRET);

      console.log("Tuya API Response:", response);

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ success: true, state: newState }),
      };
    } catch (error) {
      console.error("Toggle error:", error);
      return {
        statusCode: 503,
        body: JSON.stringify({
          error: "Failed to toggle device",
          details: error.message,
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

    const response = await Promise.race([
      tuya.request({
        method: "GET",
        path: `/v1.0/devices/${deviceId}/status`,
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Device status request timeout")),
          8000
        )
      ),
    ]);

    if (!response.success) {
      throw new Error("Tuya API request failed");
    }

    // Check if device is turned on
    const switchStatus = response.result.find((x) => x.code === "switch_1");
    const isDeviceOn = switchStatus ? switchStatus.value : false;

    // Only get power if device is on
    const power = response.result.find((x) => x.code === "cur_power");
    const watts = isDeviceOn && power ? power.value / 10 : 0;

    // Calculate costs (Bangladesh electricity rate: 9.5 BDT/kWh - typical with surcharges)
    const RATE_PER_KWH = process.env.ELECTRICITY_RATE || 9.5; // Get from env or use default
    const kW = watts / 1000;
    const hourlyRate = kW * RATE_PER_KWH;
    const dailyCost = hourlyRate * 24; // Projected daily cost at current rate

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        watts,
        device: {
          id: device.id,
          name: device.name,
          location: device.location,
          type: device.type,
        },
        timestamp: Date.now(),
        energy: {
          kW,
          ratePerKWh: RATE_PER_KWH,
          hourlyCost: hourlyRate,
          projectedDailyCost: dailyCost,
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
