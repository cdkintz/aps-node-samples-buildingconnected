# aps-node-samples-buildingconnected
BuildingConnected sample apps

# BuildingConnected Opportunities Extractor

This script, `extract_opportunities.js`, fetches opportunities from the BuildingConnected API and stores the data in an Azure SQL Database. Before running this script, please make sure to run `auth.js`.

## Prerequisites

1. You must have Node.js installed on your machine.
2. Run `npm install axios fs ini mssql mysql path` to install the required dependencies.
3. Ensure that you have added your Azure SQL Server credentials to the `azure.ini` file.
4. You must have an APS application, which you can create at aps.autodesk.com/myapps
5. You must have a BuildingConnected account, and your user must be linked to your Autodesk Account (learn more here: https://buildingconnected.zendesk.com/hc/en-us/articles/360047910993-How-to-log-in-to-BuildingConnected-using-your-Autodesk-ID)

## Instructions

1. Run `auth.js` to authenticate and generate the required authorization token.
2. Make sure your `azure.ini` file is properly set up with your Azure SQL Server credentials.
3. Run `node extract_opportunities.js` to start the extraction process.

The script fetches opportunities from the BuildingConnected API, creates tables in your Azure SQL Database, and inserts the data into these tables. By default, the script will fetch all opportunities and create new tables if needed. The script also includes a timer to periodically check for new opportunities and insert them into the existing tables.

## Customization

You can customize the script by modifying the following parameters:

- `updatedAt`: If this parameter is not null, the script will only fetch new opportunities.
- `createTablesIfNeeded`: If set to `true`, the script will delete existing tables in the Azure SQL Database and create new ones.
- `setInterval()`: Modify the last parameter (currently set to `10000`) to change the periodicity of the script for checking new opportunities (in milliseconds).

## Important Notes

- Make sure to run `auth.js` before running this script.
- Add your Azure SQL Server credentials to the `azure.ini` file before running this script.
