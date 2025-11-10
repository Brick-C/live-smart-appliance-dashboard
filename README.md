Smart Appliance Energy Monitor

This project provides a live dashboard to monitor the power consumption of a smart appliance connected via a Tuya smart plug with power monitoring capabilities. It uses a secure Netlify serverless function to interact with the Tuya Cloud API, keeping your secrets safe.

🚀 Setup and Installation

Follow these steps to get your local development environment ready.

1. Prerequisites

You must have Node.js and npm installed.

2. Install Dependencies

Navigate to your project's root directory and install the necessary Node.js packages.

# Install the official Tuya Node.js connector
npm install @tuya/tuya-connector-nodejs

# Install dotenv for local environment variable management
npm install dotenv


Note: The serverless function code uses the simpler tuya-connector-sdk library, which should also be installed via a package.json file for Netlify deployment, as mentioned previously. If running locally, @tuya/tuya-connector-nodejs is the modern choice, but ensure your serverless code is consistent with the library you deploy.

3. Configure Environment Variables

For the application to securely connect to the Tuya Cloud API, you need to set up three environment variables.

Create a file named .env in the root of your project directory.

Populate the file with your credentials from the Tuya IoT Platform. Leave the values empty in the example below, but fill them in with your actual secrets.

TUYA_ACCESS_ID="YOUR_TUYA_ACCESS_KEY_GOES_HERE"
TUYA_ACCESS_SECRET="YOUR_TUYA_SECRET_KEY_GOES_HERE"

# The unique ID of your smart plug device obtained from the Tuya IoT Platform
DEVICE_ID_1="YOUR_SMART_PLUG_DEVICE_ID_GOES_HERE"


⚠️ Security Warning:
The .env file contains sensitive data. You MUST add it to your .gitignore file to prevent accidentally committing your secrets to your public GitHub repository.

-- Inside the .gitignore file
node_modules
.env

☁️ Deployment Notes (Netlify)

When deploying to Netlify, you must set these same three variables (TUYA_ACCESS_ID, TUYA_ACCESS_SECRET, and DEVICE_ID_1) in the Build & deploy > Environment variables section of your Netlify site settings. The serverless function will read them securely from there.
