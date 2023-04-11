const express = require('express');
const fs = require('fs');
const path = require('path');
let fetch;
import('node-fetch').then(({ default: importedFetch }) => {
  fetch = importedFetch;
}).catch((error) => {
  console.error('Error importing the node-fetch module:', error);
});
const request = require('request');
const opn = require('opn'); // Change this line
const readline = require('readline');
const ini = require('ini');
const url = require('url');
const readlineSync = require('readline-sync');
const app = express();
const port = process.env.PORT || 8080;
const headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

let configFile = path.join(__dirname, 'credentials.ini');
let config = ini.parse(fs.readFileSync(configFile, 'utf-8'));

let client_id = config.DEFAULT.client_id;
let client_secret = config.DEFAULT.client_secret;

if (!client_id) {
  client_id = readlineSync.question("Enter your BuildingConnected API client ID: ");
  config.DEFAULT.client_id = client_id;
  fs.writeFileSync(configFile, ini.stringify(config));
}

if (!client_secret) {
  client_secret = readlineSync.question("Enter your BuildingConnected API client secret: ");
  config.DEFAULT.client_secret = client_secret;
  fs.writeFileSync(configFile, ini.stringify(config));
}
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
  
    const tokenRefreshInterval = 1000 * 50 * 10; //refresh token every 50 minutes
    setInterval(refreshToken, tokenRefreshInterval);
  }
  
  startServer();  

// Refresh token refresh
async function refreshToken() {
    const config = ini.parse(fs.readFileSync('credentials.ini', 'utf-8'));
    const refresh_token = config.DEFAULT.refresh_token;
  
    const data = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
      client_id: client_id,
      client_secret: client_secret
    });
  
    try {
      const response = await fetch(token_url, {
        method: 'POST',
        headers: headers,
        body: data.toString()
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error: ${response.status} - ${errorText}`);
      }
  
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

const redirect_uri = 'http://localhost:8080/callback';
const scope = 'data:read';
const authorization_url = 'https://developer.api.autodesk.com/authentication/v1/authorize';
const token_url = 'https://developer.api.autodesk.com/authentication/v1/gettoken';

let token = null;
let auth_code = null;

function askQuestion(query) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  
    return new Promise((resolve) =>
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
      })
    );
  }  

app.get('/', (req, res) => {
  const auth_url = `${authorization_url}?response_type=code&client_id=${client_id}&redirect_uri=${redirect_uri}&scope=${scope}`;
  res.redirect(auth_url);
});

app.get('/callback', (req, res) => {
    auth_code = req.query.code;
    const data = {
      grant_type: 'authorization_code',
      code: auth_code,
      client_id: client_id,
      client_secret: client_secret,
      redirect_uri: redirect_uri,
    };
  
    request.post({ url: token_url, form: data }, (err, httpResponse, body) => {
      if (err) {
        console.error('Error:', err);
        return;
      }
      token = JSON.parse(body);
  
      config.DEFAULT.token = token.access_token;
      config.DEFAULT.refresh_token = token.refresh_token;
      fs.writeFileSync(configFile, ini.stringify(config));
  
      console.log('Here is your token: ' + config.DEFAULT.token);
      console.log(config.DEFAULT.token);
      res.render('success', { authToken: config.DEFAULT.token }); // add this line to render success.ejs with authToken set to token.access_token
    });
  });  
