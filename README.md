# BuildingConnected sample applications.
This repository includes programs to do the following:
1. Authenticate with Autodesk Platform Services (APS) APIs
2. Extract Bid Board Opportunities to Azure SQL Server for use with PowerBI

# Authenticating with the BuildingConnected API

`auth.js` is a Node.js script that authenticates your application with the Autodesk API and saves your access token and refresh token in a configuration file `credentials.ini`. You need to run this script before using the `extract_opportunities.js` script.

## Prerequisites

Make sure you have Node.js installed. If not, download and install the latest LTS version from [the official Node.js website](https://nodejs.org/).

## Installation

1. Clone or download the repository containing `auth.js` and related files.
2. Navigate to the project directory in your terminal.
3. Run `npm install` to install the required dependencies.

## Usage

1. Run `node auth.js` in your terminal.
2. If you have not already entered your BuildingConnected API client ID and client secret, you will be prompted to enter them. The script will save these values in `credentials.ini`.
3. The script will start a local server at `http://localhost:8080` and open your default web browser to begin the OAuth2 process.
4. Sign in to your Autodesk account when prompted.
5. After successfully authenticating, you will be redirected to a page displaying your access token. The token will also be saved in `credentials.ini`.

## Notes

- The script will automatically refresh your access token every 50 minutes. You can modify the `tokenRefreshInterval` value to change the refresh interval.
- To use the saved access token in other scripts (e.g., `extract_opportunities.js`), read the token from the `credentials.ini` file.


# BuildingConnected Opportunities Extractor

The script `extract_opportunities.js` fetches opportunities from the BuildingConnected API and stores the data in an Azure SQL Database. Before running this script, please make sure to run `auth.js`.

## Prerequisites

1. You must have Node.js installed on your machine.
2. Run `npm install axios fs ini mssql mysql path` to install the required dependencies.
3. Ensure that you have added your Azure SQL Server credentials to the `azure.ini` file.
4. You must have an APS application, which you can create at aps.autodesk.com/myapps
5. You must have a BuildingConnected account, and your user must be linked to your Autodesk Account (learn more here: https://buildingconnected.zendesk.com/hc/en-us/articles/360047910993-How-to-log-in-to-BuildingConnected-using-your-Autodesk-ID)
6. Your user's office must have a Bid Board Pro subscription.

## Instructions

1. Run `auth.js` to authenticate and generate the required authorization token.
2. Make sure your `azure.ini` file is properly set up with your Azure SQL Server credentials (if you haven't set up an Azure DB yet, learn how to do that here: https://learn.microsoft.com/en-us/azure/azure-sql/database/single-database-create-quickstart?view=azuresql&tabs=azure-portal).
3. Run `node extract_opportunities.js` to start the extraction process.

The script fetches opportunities from the BuildingConnected API, creates tables in your Azure SQL Database, and inserts the data into these tables. By default, the script will fetch all opportunities and create new tables if needed. The script also includes a timer to periodically check for new opportunities and insert them into the existing tables.

## Customization

You can customize the script by modifying the following parameters:

- `updatedAt`: If this parameter is not null, the script will only fetch new opportunities.
- `createTablesIfNeeded`: If set to `true`, the script will delete existing tables in the Azure SQL Database and create new ones.
- `setInterval()`: Modify the last parameter (currently set to `10000`) to change the periodicity of the script for checking new opportunities (in milliseconds).
