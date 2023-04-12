// Initial set up
const express = require('express');
const fs = require('fs');
const path = require('path');
let fetch;
import('node-fetch').then(({ default: importedFetch }) => {
  fetch = importedFetch;
}).catch((error) => {
  console.error('Error importing the node-fetch module:', error);
});
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
    try {
      const importedFetch = await import('node-fetch');
      fetch = importedFetch.default;
    } catch (error) {
      console.error('Error importing the node-fetch module:', error);
      return;
    }
  
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
  
    const data = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
      client_id: client_id,
      client_secret: client_secret
    });
  
    // Call aps authentication API
    try {
      const response = await axios.get(token_url, {
        headers: headers,
        data: data.toString(),
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error: ${response.status} - ${errorText}`);
      }
      
      // Define the token
      const token = await response.json();
  
      // Update the token values in the config object
      config.DEFAULT.token = token.access_token;
      config.DEFAULT.refresh_token = token.refresh_token;
  
      // Write the updated config object to the file
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
const authorization_url = 'https://developer.api.autodesk.com/authentication/v1/authorize';
const token_url = 'https://developer.api.autodesk.com/authentication/v1/gettoken';

let token = null;
let auth_code = null;

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
  const data = {
    grant_type: 'authorization_code',
    code: auth_code,
    client_id: client_id,
    client_secret: client_secret,
    redirect_uri: redirect_uri,
  };

  // Get access tokens
  try {
    const response = await axios.post(token_url, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    token = response.data;

    // Save Tokens to config file
    config.DEFAULT.token = token.access_token;
    config.DEFAULT.refresh_token = token.refresh_token;
    fs.writeFileSync(configFile, ini.stringify(config));

    // Log token
    console.log('Here is your token: ' + config.DEFAULT.token);
    console.log(config.DEFAULT.token);
    // Render webpage with success token
    res.render('success', { authToken: config.DEFAULT.token });
  } catch (err) {
    console.error('Error:', err);
  }
});  
