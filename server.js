// server.js

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Salesforce credentials from .env
const {
  PORT = 3000,
  SF_CLIENT_ID,
  SF_CLIENT_SECRET,
  SF_USERNAME,
  SF_PASSWORD,
  SF_SECURITY_TOKEN,
  SF_LOGIN_URL = 'https://login.salesforce.com',
} = process.env;

// Function to authenticate with Salesforce and get access token
const getSalesforceAccessToken = async () => {
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', SF_CLIENT_ID);
  params.append('client_secret', SF_CLIENT_SECRET);
  params.append('username', SF_USERNAME);
  params.append('password', SF_PASSWORD + SF_SECURITY_TOKEN);

  try {
    const response = await axios.post(`${SF_LOGIN_URL}/services/oauth2/token`, params);
    return {
      accessToken: response.data.access_token,
      instanceUrl: response.data.instance_url,
    };
  } catch (error) {
    console.error('Error obtaining access token:', error.response ? error.response.data : error.message);
    throw error;
  }
};

// /search Endpoint
app.post('/search', async (req, res) => {
  const { keyword } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required' });
  }

  try {
    const { accessToken, instanceUrl } = await getSalesforceAccessToken();

    // Sanitize the keyword to prevent SOQL injection
    const sanitizedKeyword = keyword.replace(/'/g, "\\'");

    // Construct SOQL query
    const soql = `SELECT Id, Name, Phone, Website, Industry, Description FROM Account WHERE Name LIKE '%${sanitizedKeyword}%' LIMIT 10`;
    const queryUrl = `${instanceUrl}/services/data/v57.0/query/?q=${encodeURIComponent(soql)}`;

    // Perform the query
    const response = await axios.get(queryUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Return the records
    res.json(response.data.records);
  } catch (error) {
    console.error('Error querying Salesforce:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Error querying Salesforce' });
  }
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
