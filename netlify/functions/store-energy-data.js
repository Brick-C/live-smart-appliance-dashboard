const { MongoClient } = require("mongodb");

// Get these from your Netlify environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "energy_monitor";

exports.handler = async (event, context) => {
  // Only allow POST and GET methods
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  let client;
  try {
    // Connect to MongoDB
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);
    const readings = db.collection("energy_readings");

    if (event.httpMethod === "POST") {
      // Store new reading
      const data = JSON.parse(event.body);
      const reading = {
        deviceId: data.deviceId,
        watts: data.watts,
        timestamp: new Date(),
        kWh: data.kWh,
        cost: data.cost,
      };

      await readings.insertOne(reading);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Reading stored successfully" }),
      };
    } else {
      // GET request - retrieve historical data
      const { deviceId, startTime, endTime } =
        event.queryStringParameters || {};

      let query = {};
      if (deviceId) {
        query.deviceId = deviceId;
      }
      if (startTime) {
        query.timestamp = { $gte: new Date(startTime) };
      }
      if (endTime) {
        query.timestamp = { ...query.timestamp, $lte: new Date(endTime) };
      }

      const historicalData = await readings
        .find(query)
        .sort({ timestamp: -1 })
        .limit(1000)
        .toArray();

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(historicalData),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to process request" }),
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
};
