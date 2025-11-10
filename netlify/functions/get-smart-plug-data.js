const { TuyaContext } = require("@tuya/tuya-connector-nodejs");

// Define available devices
const DEVICES = [
  {
    id: process.env.DEVICE_ID_1,
    name: "Coffee Maker",
    location: "Study Room",
    type: "Smart Plug",
  },
  {
    id: process.env.DEVICE_ID_2 || "device_id_2",
    name: "Computer",
    location: "Living Room",
    type: "Smart Plug",
  },
];

exports.handler = async (event, context) => {
  // Check if this is a control command
  if (event.httpMethod === "POST") {
    const command = JSON.parse(event.body);
    if (command.action !== "toggle") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid action" }),
      };
    }
  }

  // In the try block, before getting status
  if (event.httpMethod === "POST") {
    const command = JSON.parse(event.body);
    // Get current status first
    const statusResponse = await tuya.request({
      method: "GET",
      path: `/v1.0/devices/${deviceId}/status`,
    });

    const currentState = statusResponse.result.find(
      (x) => x.code === "switch_1"
    )?.value;
    const newState = !currentState; // Toggle the state

    await tuya.request({
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
    });
  }

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
  });

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

    const response = await tuya.request({
      method: "GET",
      path: `/v1.0/devices/${deviceId}/status`,
    });

    if (!response.success) {
      throw new Error("Tuya API request failed");
    }

    const power = response.result.find((x) => x.code === "cur_power");
    const watts = power ? power.value / 10 : 0;

    // Calculate costs (assuming average electricity rate of $0.12 per kWh)
    const RATE_PER_KWH = process.env.ELECTRICITY_RATE || 0.12; // Get from env or use default
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
