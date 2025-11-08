/**
 * This is your Netlify Serverless Function.
 * It runs on a server, NOT in the user's browser.
 * This is where you securely use your API keys.
 */

// In a real project, you would install a Tuya library:
const { TuyaContext } = require("@tuya/tuya-connector-nodejs");

// --- SIMULATION LOGIC (MOVED FROM index.html) ---
// This is just a placeholder. Replace this with your real Tuya API call.
// function getSimulatedData() {
//   let timeOfDay = new Date().getHours();
//   let randomFluctuation = Math.random() * 50 - 25;
//   let baseWatts;

//   if (timeOfDay >= 7 && timeOfDay <= 9) {
//     baseWatts = 1200 + randomFluctuation;
//   } else if (timeOfDay >= 17 && timeOfDay <= 19) {
//     baseWatts = 300 + randomFluctuation;
//   } else if (Math.random() < 0.2) {
//     baseWatts = 800 + randomFluctuation;
//   } else {
//     baseWatts = 5 + Math.random() * 10;
//   }

//   baseWatts = Math.max(0, baseWatts);

//   return {
//     watts: Math.round(baseWatts),
//     device: "Coffee Maker (Tuya API)", // Updated device name
//     timestamp: Date.now(),
//   };
// }
// // --- END SIMULATION LOGIC ---

exports.handler = async (event, context) => {
  const ACCESS_ID = process.env.TUYA_ACCESS_ID;
  const ACCESS_SECRET = process.env.TUYA_ACCESS_SECRET;

  if (!ACCESS_ID || !ACCESS_SECRET) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing Tuya API credentials" }),
    };
  }

  const tuya = new TuyaContext({
    baseUrl: "https://openapi.tuyaeu.com", // ✅ Use your project's datacenter
    accessKey: ACCESS_ID,
    secretKey: ACCESS_SECRET,
  });

  try {
    const deviceId = "eu17625368864792sOs9"; // your device ID
    const response = await tuya.request({
      method: "GET",
      path: `/v1.0/devices/${deviceId}/status`,
    });

    if (!response.success) {
      throw new Error("Tuya API request failed");
    }

    const power = response.result.find((x) => x.code === "cur_power");
    const watts = power ? power.value / 10 : 0;

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        watts,
        device: "Real Coffee Maker",
        timestamp: Date.now(),
      }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
