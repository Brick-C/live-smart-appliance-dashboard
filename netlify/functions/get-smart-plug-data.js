/**
 * This is your Netlify Serverless Function.
 * It runs on a server, NOT in the user's browser.
 * This is where you securely use your API keys.
 */

// In a real project, you would install a Tuya library:
// npm install tuya-connector-sdk
// const { TuyaContext } = require('tuya-connector-sdk');

// --- SIMULATION LOGIC (MOVED FROM index.html) ---
// This is just a placeholder. Replace this with your real Tuya API call.
function getSimulatedData() {
  let timeOfDay = new Date().getHours();
  let randomFluctuation = Math.random() * 50 - 25;
  let baseWatts;

  if (timeOfDay >= 7 && timeOfDay <= 9) {
    baseWatts = 1200 + randomFluctuation;
  } else if (timeOfDay >= 17 && timeOfDay <= 19) {
    baseWatts = 300 + randomFluctuation;
  } else if (Math.random() < 0.2) {
    baseWatts = 800 + randomFluctuation;
  } else {
    baseWatts = 5 + Math.random() * 10;
  }

  baseWatts = Math.max(0, baseWatts);

  return {
    watts: Math.round(baseWatts),
    device: "Coffee Maker (Tuya API)", // Updated device name
    timestamp: Date.now(),
  };
}
// --- END SIMULATION LOGIC ---

exports.handler = async (event, context) => {
  // 1. GET YOUR SECURE CREDENTIALS
  // These are loaded from Netlify's "Environment Variables" settings, NOT hardcoded.
  const ACCESS_ID = process.env.TUYA_ACCESS_ID;
  const ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET;

  // Check if secrets are set in Netlify
  if (!ACCESS_ID || !ACCESS_SECRET) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "API credentials are not set in environment variables.",
      }),
    };
  }

  // 2. --- REAL TUYA API LOGIC WOULD GO HERE ---
  //
  // This part is complex and requires the official Tuya SDK.
  // You would initialize the Tuya context and make your API calls.
  //
  // EXAMPLE with tuya-connector-sdk (conceptual):
  //
  // const context = new TuyaContext({
  //   baseUrl: 'https://openapi.tuyacn.com', // or other datacenter
  //   accessKey: ACCESS_ID,
  //   secretKey: ACCESS_SECRET,
  // });
  //
  // try {
  //   // Get the status of a specific device
  //   const deviceId = 'YOUR_SMART_PLUG_DEVICE_ID';
  //   const { result } = await context.request({
  //     method: 'GET',
  //     path: `/v1.0/devices/${deviceId}/status`,
  //   });
  //
  //   // Find the 'power' or 'current' status code from the result array
  //   // This depends on your specific plug model
  //   const powerStatus = result.find(s => s.code === 'cur_power'); // e.g., 'cur_power'
  //   const watts = powerStatus ? powerStatus.value / 10 : 0; // Tuya power is often in deciwatts
  //
  //   const realData = {
  //       watts: watts,
  //       device: 'Real Coffee Maker',
  //       timestamp: Date.now()
  //   };
  //
  //   return {
  //       statusCode: 200,
  //       headers: { "Access-Control-Allow-Origin": "*" }, // Allow browser access
  //       body: JSON.stringify(realData)
  //   };
  //
  // } catch (error) {
  //   return { statusCode: 502, body: JSON.stringify({ error: error.message }) };
  // }

  // 3. --- RETURNING SIMULATED DATA FOR NOW ---
  // (Delete this section once your real Tuya logic is working)

  const simulatedData = getSimulatedData();

  return {
    statusCode: 200,
    // Add CORS header to allow the browser to call this function
    headers: {
      "Access-Control-Allow-Origin": "*", // Allows any origin
      "Content-Type": "application/json",
    },
    body: JSON.stringify(simulatedData),
  };
};
