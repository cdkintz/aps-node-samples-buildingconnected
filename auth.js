// Initial set up
const express = require('express');
const fs = require('fs');
const path = require('path');
let fetch;
const opn = require('opn'); // Change this line
const readline = require('readline');
const ini = require('ini');
const url = require('url');
const readlineSync = require('readline-sync');
const app = express();
const port = process.env.PORT || 8080;
const axios = require('axios');
const headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };

// Set up success webpage
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Set up connection with credential configuration file
let configFile = path.join(__dirname, 'credentials.ini');
let config = ini.parse(fs.readFileSync(configFile, 'utf-8'));


// Define client id and secret
let client_id = config.DEFAULT.client_id;
let client_secret = config.DEFAULT.client_secret;


// If client id not already saved, request it in the console
if (!client_id) {
  client_id = readlineSync.question("Go to aps.autodesk.com/myapps to get your Client ID, and then add it here: ");
  config.DEFAULT.client_id = client_id;
  fs.writeFileSync(configFile, ini.stringify(config));
}

// If client secret not already saved, request it in the console
if (!client_secret) {
  client_secret = readlineSync.question("Enter your BuildingConnected API client secret: ", { hideEchoBack: true });
  config.DEFAULT.client_secret = client_secret;
  fs.writeFileSync(configFile, ini.stringify(config));
}

// Start server to handle API calls
// By default, this will also schedule the token refresh interval
async function startServer() {
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
      opn(`http://localhost:${port}`);
    });
  
    // Set periodicity of token refresh
    const tokenRefreshInterval = 1000 * 50 * 10; //refresh token, this case every 50 minutes
    setInterval(refreshToken, tokenRefreshInterval);
  }
  
startServer();  

// Define the function that will refresh the token in credentials.ini
// Set the periodicity in startServer under tokenRefreshInterval
async function refreshToken() {
  const config = ini.parse(fs.readFileSync('credentials.ini', 'utf-8'));
  const refresh_token = config.DEFAULT.refresh_token;

  const client_id = config.DEFAULT.client_id;
  const client_secret = config.DEFAULT.client_secret;

  const data = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh_token,
  });

  const base64Credentials = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${base64Credentials}`,
  };

  try {
    const response = await axios.post(token_url, data.toString(), { headers: headers });

    if (response.status !== 200) {
      throw new Error(`HTTP error: ${response.status} - ${response.statusText}`);
    }

    const token = response.data;

    config.DEFAULT.token = token.access_token;
    config.DEFAULT.refresh_token = token.refresh_token;

    const config_path = path.join(__dirname, 'credentials.ini');
    fs.writeFileSync(config_path, ini.stringify(config));

    console.log('Access token refreshed:', token.access_token);
  } catch (error) {
    console.error('Error refreshing token:', error);
  }
}

// Releavant apis and scopes
// See https://aps.autodesk.com/en/docs/oauth/v2/tutorials/get-3-legged-token/ for documentation
const redirect_uri = 'http://localhost:8080/callback';
const scope = 'data:read';
const authorization_url = 'https://developer.api.autodesk.com/authentication/v2/authorize';
const token_url = 'https://developer.api.autodesk.com/authentication/v2/token';

let token = null;
let auth_code = null;

// Trigger refresh
refreshToken();

//Fetch auth code
// API https://aps.autodesk.com/en/docs/oauth/v2/reference/http/authorize-GET/
// See tutorial https://aps.autodesk.com/en/docs/oauth/v2/tutorials/get-3-legged-token/
app.get('/', (req, res) => {
  const auth_url = `${authorization_url}?response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}&scope=${scope}`;
  res.redirect(auth_url);
});

// Operation to call API to get access tokens
app.get('/callback', async (req, res) => {
  auth_code = req.query.code;
  const data = new URLSearchParams({
    grant_type: 'authorization_code',
    code: auth_code,
    redirect_uri: redirect_uri,
  });

  const base64Credentials = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${base64Credentials}`,
  };

  // Get access tokens
  try {
    const response = await axios.post(token_url, data.toString(), { headers: headers });

    token = response.data;

    // Save Tokens to config file
    config.DEFAULT.token = token.access_token;
    config.DEFAULT.refresh_token = token.refresh_token;
    fs.writeFileSync(configFile, ini.stringify(config));

    // Log token
    console.log('Here is your token: ' + config.DEFAULT.token);

    // Render webpage with success token
    res.render('success', { authToken: config.DEFAULT.token });
  } catch (error) {
    // Handle the error
    console.error('Error getting access tokens:', error);
    res.status(500).send('Error getting access tokens');
  }
});