
// Import modules
const axios = require('axios');
const fs = require('fs');
const ini = require('ini');
const path = require('path');
const sql = require('mssql');
const mysql = require('mysql');

// Read the configuration file and parse it
const configFile = path.join(__dirname, 'credentials.ini');
const { DEFAULT: { token: auth_token } } = ini.parse(fs.readFileSync(configFile, 'utf-8'));


// Helps us map values from the BuildingConnected API to Azure
function forceVarChar(value, maxLength = 255, placeholder = '?') {
  const truncatedValue = value.substring(0, maxLength);
  const asciiValue = truncatedValue.replace(/[^\x00-\x7F]/g, placeholder);
  return asciiValue;
}

// Helps us map values from the BuildingConnected API to Azure
function parseDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

// This is the base URL to fetch opportunities from BuildingConnected
let url = 'https://developer.api.autodesk.com/construction/buildingconnected/v2/opportunities?limit=100';

// We'll use this function to get the correct URL when we are periodically checking for new opportunities
function getUpdatedOpportunitiesUrl(baseURL, updatedAt) {
  const updatedTimestamp = updatedAt.toISOString();
  return `${baseURL}&filter[updatedAt]=${updatedTimestamp}..`;
}

// The headers you'll need to access your data; the auth_token is stored in credentials.ini
// AUTH.JS MUST BE RUN BEFORE THIS PROGRAM
const headers = {
  'Authorization': `Bearer ${auth_token}`,
  'Content-Type': 'application/json'
};


// Define the azure db credentials
const azureFile = './azure.ini';
const { DEFAULT: { user, password, server, database } } = ini.parse(fs.readFileSync(azureFile, 'utf-8'));

const azure = {
  user,
  password,
  server,
  database,
  options: { encrypt: true }
};

// This will connect to your Azure DB
// Add your credentials to the "azure.ini" file first
async function connectToAzure(azureConfig) {
  try {
    const pool = await sql.connect(azureConfig);
    console.log('Connected to Azure SQL Database...');
    return pool;
  } catch (error) {
    console.log('Error connecting to Azure SQL Database. Make sure you have provided your Azure credentials to Azure.ini');
    process.exit(1)
  }
}

// This will create tables in your Azure DB
async function createTables(pool) {
  try {
    await pool.request().query(`
    DROP TABLE IF EXISTS opportunities;
    `); //done
    await pool.request().query(`
    DROP TABLE IF EXISTS office;
    `); //done
    await pool.request().query(`
    DROP TABLE IF EXISTS client;
    `); //done
    await pool.request().query(`
    DROP TABLE IF EXISTS location;
    `); //done
    await pool.request().query(`
    DROP TABLE IF EXISTS competitors;
    `); //done


    // Create opportunities table
    await pool.request().query(`
      CREATE TABLE opportunities (
        id CHAR(24) ,
        name VARCHAR(255),
        number VARCHAR(255) ,
        client NVarChar(MAX),
        created_at DATETIME,
        updated_at DATETIME,
        default_currency VARCHAR(3),
        source VARCHAR(255),
        request_type VARCHAR(255),
        submission_state VARCHAR(255) ,
        workflow_bucket VARCHAR(255) ,
        parent_id CHAR(24),
        owning_office_id CHAR(24),
        due_at DATETIME,
        job_walk_at DATETIME,
        rfis_due_at DATETIME,
        expected_start_at DATETIME,
        expected_finish_at DATETIME,
        invited_at DATETIME,
        trade_name VARCHAR(255),
        project_size INT,
        project_information TEXT,
        location_id INT,
        trade_specific_instructions TEXT,
        architect VARCHAR(255),
        engineer VARCHAR(255),
        property_owner VARCHAR(255),
        property_tenant VARCHAR(255),
        additional_info TEXT,
        priority VARCHAR(255),
        market_sector VARCHAR(255),
        rom VARCHAR(255),
        win_probability VARCHAR(255),
        follow_up_at VARCHAR(255),
        contract_start_at VARCHAR(255),
        contract_duration VARCHAR(255),
        average_crew_size VARCHAR(255),
        estimating_hours INT,
        fee_percentage DECIMAL(5, 2),
        profit_margin DECIMAL(5, 2),
        final_value DECIMAL(10, 2)

    );
    `); //done
    console.log('opportunities table created');

    // Create client table
    await pool.request().query(`
      CREATE TABLE client (
        id CHAR(24) ,
        name VARCHAR(255) ,
      );
    `); //done
    console.log('client table created');

    // Create office table
    await pool.request().query(`
      CREATE TABLE office (
        id CHAR(24) ,
        location_id INT,
        name VARCHAR(255) 
      );
    `); //done
    console.log('office table created');

    // Create location table
    await pool.request().query(`
      CREATE TABLE location (
        country VARCHAR(2) ,
        state VARCHAR(2) ,
        street_name VARCHAR(255) ,
        street_number VARCHAR(255) ,
        suite VARCHAR(255),
        city VARCHAR(255) ,
        zip VARCHAR(10) ,
        complete VARCHAR(255) ,
        lat DECIMAL(9, 6) ,
        lng DECIMAL(9, 6) 
      );
    `); //done
    console.log('location table created');

    // Create competitors table
    await pool.request().query(`
      CREATE TABLE competitors (
        bidAmount INT ,
        companyId CHAR(24) ,
        name VARCHAR(255) ,
        created_at TIMESTAMP
      );
    `); //done
    console.log('competitors table created');

  } catch (error) {
    console.error('Error creating tables:', error);
  }
} // This is the schema for the azure tables


// This function will insert data into Azure from opportunities
async function insertData(pool, opportunity) {
  try {
    // Insert data into opportunities table
      const result = await pool.request()
      .input('id', sql.NVarChar(24), opportunity.id)
      .input('name', sql.VarChar(255), forceVarChar(opportunity.name))
      .input('number', sql.NVarChar(255), opportunity.number)
      .input('client', sql.NVarChar(24), opportunity.client.company.id)
      .input('created_at', sql.DateTime2, opportunity.createdAt)
      .input('updated_at', sql.DateTime2, parseDate(opportunity.updatedAt))
      .input('default_currency', sql.NVarChar(3), opportunity.defaultCurrency)
      .input('source', sql.NVarChar(255), opportunity.source)
      .input('request_type', sql.NVarChar(255), opportunity.requestType)
      .input('submission_state', sql.NVarChar(255), opportunity.submissionState)
      .input('workflow_bucket', sql.NVarChar(255), opportunity.workflowBucket)
      .input('parent_id', sql.Char(24), opportunity.parentId)
      .input('owning_office_id', sql.Char(24), opportunity.owningOfficeId)
      .input('due_at', sql.DateTime2, opportunity.dueAt)
      .input('job_walk_at', sql.DateTime2, opportunity.jobWalkAt)
      .input('rfis_due_at', sql.DateTime2, opportunity.rfisDueAt)
      .input('expected_start_at', sql.DateTime2, opportunity.expectedStartAt)
      .input('expected_finish_at', sql.DateTime2, opportunity.expectedFinishAt)
      .input('invited_at', sql.DateTime2, opportunity.invitedAt)
      .input('trade_name', sql.NVarChar(255), opportunity.tradeName)
      .input('project_size', sql.Int, opportunity.projectSize)
      .input('project_information', sql.NVarChar(sql.MAX), opportunity.projectInformation)
      .input('location_id', sql.Int, opportunity.locationId)
      .input('trade_specific_instructions', sql.NVarChar(sql.MAX), opportunity.tradeSpecificInstructions)
      .input('architect', sql.NVarChar(255), opportunity.architect)
      .input('engineer', sql.NVarChar(255), opportunity.engineer)
      .input('property_owner', sql.NVarChar(255), opportunity.propertyOwner)
      .input('property_tenant', sql.NVarChar(255), opportunity.propertyTenant)
      .input('additional_info', sql.NVarChar(sql.MAX), opportunity.additionalInfo)
      .input('priority', sql.NVarChar(255), opportunity.priority)
      .input('market_sector', sql.NVarChar(255), opportunity.marketSector)
      .query(`
      MERGE opportunities AS target
      USING (SELECT @id AS id, @updated_at AS updated_at) AS source
      ON target.id = source.id
      WHEN MATCHED AND DATEDIFF(SECOND, target.updated_at, source.updated_at) > 0 THEN
        UPDATE SET
          name = @name,
          number = @number,
          client = @client,
          created_at = @created_at,
          updated_at = @updated_at,
          default_currency = @default_currency,
          source = @source,
          request_type = @request_type,
          submission_state = @submission_state,
          workflow_bucket = @workflow_bucket,
          parent_id = @parent_id,
          owning_office_id = @owning_office_id,
          due_at = @due_at,
          job_walk_at = @job_walk_at,
          rfis_due_at = @rfis_due_at,
          expected_start_at = @expected_start_at,
          expected_finish_at = @expected_finish_at,
          invited_at = @invited_at,
          trade_name = @trade_name,
          project_size = @project_size,
          project_information = @project_information,
          location_id = @location_id,
          trade_specific_instructions = @trade_specific_instructions,
          architect = @architect,
          engineer = @engineer,
          property_owner = @property_owner,
          property_tenant = @property_tenant,
          additional_info = @additional_info,
          priority = @priority,
          market_sector = @market_sector
        WHEN NOT MATCHED THEN
          INSERT (id, name, number, client, created_at, updated_at, default_currency, source, request_type, submission_state, workflow_bucket, parent_id, owning_office_id, due_at, job_walk_at, rfis_due_at, expected_start_at, expected_finish_at, invited_at, trade_name, project_size, project_information, location_id, trade_specific_instructions, architect, engineer, property_owner, property_tenant, additional_info, priority, market_sector)
          VALUES (@id, @name, @number, @client, @created_at, @updated_at, @default_currency, @source, @request_type, @submission_state, @workflow_bucket, @parent_id, @owning_office_id, @due_at, @job_walk_at, @rfis_due_at, @expected_start_at, @expected_finish_at, @invited_at, @trade_name, @project_size, @project_information, @location_id, @trade_specific_instructions, @architect, @engineer, @property_owner, @property_tenant, @additional_info, @priority, @market_sector)
        OUTPUT $action AS action, inserted.id, inserted.name, inserted.updated_at;
`);
if (result.recordset.length > 0) {
  console.log('New or updated row:', result.recordset);
}
else {
  console.log('Opportunity already up to date --' + opportunity.name);
}
  } catch (error) {
    console.error('Error inserting data:', error);
  }
} // You will want to set up your tables to match your needs; consider making tables with duplicates that you can extract from later


// Define the structure of the json we expect from /opportunities
const result = {
  id: null,
  name: null,
  number: null,
  client: {
    company: {
      id: null,
      name: null
    },
    lead: {
      id: null,
      email: null,
      firstName: null,
      lastName: null,
      phoneNumber: null
    },
    office: {
      id: null,
      name: null,
      location: {
        country: null,
        state: null,
        streetName: null,
        streetNumber: null,
        suite: null,
        city: null,
        zip: null,
        complete: null,
        coords: {
          lat: null,
          lng: null
        }
      }
    }
  },
  competitors: [
    {
      bidAmount: null,
      companyId: null,
      isWinner: null,
      name: null
    }
  ],
  customTags: [],
  createdAt: null,
  updatedAt: null,
  defaultCurrency: null,
  source: null,
  isNdaRequired: null,
  projectIsPublic: null,
  outcome: {
    state: null,
    updatedAt: null,
    updatedBy: null
  },
  requestType: null,
  submissionState: null,
  workflowBucket: null,
  isParent: null,
  parentId: null,
  groupChildren: [],
  bid: {
    id: null,
    submittedAt: null,
    total: null,
    revision: null,
    type: null
  },
  members: [
    {
      viewedAt: null,
      userId: null,
      type: null
    }
  ],
  dueAt: null,
  jobWalkAt: null,
  rfisDueAt: null,
  expectedStartAt: null,
  expectedFinishAt: null,
  invitedAt: null,
  tradeName: null,
  projectSize: null,
  projectInformation: null,
  location: {
    country: null,
    state: null,
    streetName: null,
    streetNumber: null,
    suite: null,
    city: null,
    zip: null,
    complete: null,
    coords: {
      lat: null,
      lng: null
    }
  },
  tradeSpecificInstructions: null,
  architect: null,
  engineer: null,
  propertyOwner: null,
  propertyTenant: null,
  declineReasons: [],
  additionalInfo: null,
  priority: null,
  marketSector: null,
  rom: null,
  winProbability: null,
  followUpAt: null,
  contractStartAt: null,
  contractDuration: null,
  averageCrewSize: null,
  estimatingHours: null,
  feePercentage: null,
  profitMargin: null,
  finalValue: null,
  isArchived: null,
  owningOfficeId: null
}; 

// This is the main function; it will fetch opportunities from the BC API
// If updatedAt is null, it will fetch all opportunities
// IF updatedAt is not null, it will only fetch new opportunities
// If CreateTablesIfNeeded is True, it will delete the existing tables in Azure and replace them with new ones
async function fetchOpportunities(url, updatedAt = null, createTablesIfNeeded = true) {
  try {
    const results = []; // array to hold the results
    if (updatedAt) {
      url = getUpdatedOpportunitiesUrl(url, updatedAt);
    }
    let paginationCounter = 0;
    // Connect to Azure SQL Database
    const pool = await connectToAzure(azure);
    // Create the tables
    
    if (createTablesIfNeeded) {
      await createTables(pool);
    }

    while (true) {
      const response = await axios.get(url, { headers });
      if (response.status === 200) {
        const opportunities = response.data.results;

        for (const opportunity of opportunities) {
          // Store the desired fields in an object
          const result = {
            id: opportunity.id,
            name: opportunity.name.substring(0, 255),
            number: opportunity.number,
            client: {
              company: {
                id: opportunity.client?.company?.id,
                name: opportunity.client?.company?.name,
              },
              lead: {
                id: opportunity.client?.lead?.id,
                email: opportunity.client?.lead?.email,
                firstName: opportunity.client?.lead?.firstName,
                lastName: opportunity.client?.lead?.lastName,
                phoneNumber: opportunity.client?.lead?.phoneNumber,
              },
              office: {
                id: opportunity.client?.office?.id,
                name: opportunity.client?.office?.name,
                location: {
                  country: opportunity.client?.office?.location?.country,
                  state: opportunity.client?.office?.location?.state,
                  streetName: opportunity.client?.office?.location?.streetName,
                  streetNumber: opportunity.client?.office?.location?.streetNumber,
                  suite: opportunity.client?.office?.location?.suite,
                  city: opportunity.client?.office?.location?.city,
                  zip: opportunity.client?.office?.location?.zip,
                  complete: opportunity.client?.office?.location?.complete,
                  coords: {
                    lat: opportunity.client?.office?.location?.coords?.lat,
                    lng: opportunity.client?.office?.location?.coords?.lng,
                  },
                },
              },
            },
            competitors: opportunity.competitors,
            customTags: opportunity.customTags,
            createdAt: opportunity.createdAt,
            updatedAt: opportunity.updatedAt,
            defaultCurrency: opportunity.defaultCurrency,
            source: opportunity.source,
            isNdaRequired: opportunity.isNdaRequired,
            projectIsPublic: opportunity.projectIsPublic,
            outcome: opportunity.outcome,
            requestType: opportunity.requestType,
            submissionState: opportunity.submissionState,
            workflowBucket: opportunity.workflowBucket,
            isParent: opportunity.isParent,
            parentId: opportunity.parentId,
            groupChildren: opportunity.groupChildren,
            bid: opportunity.bid,
            members: opportunity.members,
            dueAt: opportunity.dueAt,
            jobWalkAt: opportunity.jobWalkAt,
            rfisDueAt: opportunity.rfisDueAt,
            expectedStartAt: opportunity.expectedStartAt,
            expectedFinishAt: opportunity.expectedFinishAt,
            invitedAt: opportunity.invitedAt,
            tradeName: opportunity.tradeName,
            projectSize: opportunity.projectSize,
            projectInformation: opportunity.projectInformation,
            location: opportunity.location,
            tradeSpecificInstructions: opportunity.tradeSpecificInstructions,
            architect: opportunity.architect,
            engineer: opportunity.engineer,
            propertyOwner: opportunity.propertyOwner,
            propertyTenant: opportunity.propertyTenant,
            declineReasons: opportunity.declineReasons,
            additionalInfo: opportunity.additionalInfo,
            priority: opportunity.priority,
            marketSector: opportunity.marketSector,
            rom: opportunity.rom,
            winProbability: opportunity.winProbability,
            followUpAt: opportunity.followUpAt,
            contractStartAt: opportunity.contractStartAt,
            contractDuration: opportunity.contractDuration,
            averageCrewSize: opportunity.averageCrewSize,
            estimatingHours: opportunity.estimatingHours,
            feePercentage: opportunity.feePercentage,
            profitMargin: opportunity.profitMargin,
            finalValue: opportunity.finalValue,
            isArchived: opportunity.isArchived,
            owningOfficeId: opportunity.owningOfficeId
          };
          
          results.push(result);
          if (opportunity && opportunity.id) {
            await insertData(pool, result);
          } else {
            console.error('Invalid opportunity object:', result);
          }
        }
        //count page
        paginationCounter++;
        console.log('Total opportunities retrieved in page:', results.length);
         // Check if there are more pages of opportunities and if pagination limit is reached
        const nextUrl = response.data.pagination.nextUrl;
        if (nextUrl === undefined || nextUrl === null) {
          break;
        }

        // Update the API endpoint URL to the next page
        url = 'https://developer.api.autodesk.com' + nextUrl;
      } else {
        console.log('Error:', response.data);
        break;
      }
    }
  }
  catch (error) {
    if (error.response.status == 401 || error.response.status == 403) {
      console.log('Looks like you need to run auth.js. Do that and try again.');
      process.exit(1)
    }
    else {
      console.error('An error occurred:', error);
    }
  }
}

// Runs the main function
fetchOpportunities(url);

// Sets a timer to periodically fetch for new opportunities
setInterval(() => {
  const updatedAt = new Date();
  updatedAt.setHours(updatedAt.getHours() - 1); // this checks for opportunities since the last time fetchOpportunities was run minus one hour
  fetchOpportunities(url, updatedAt, createTablesIfNeeded = false);
}, 10000); // You will want to modify this periodicity to match what you want; this is 10 seconds
