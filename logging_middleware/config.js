'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
  email: process.env.CLIENT_EMAIL,
  name: process.env.CLIENT_NAME,
  rollNo: process.env.REG_NO || process.env.ROLL_NO,
  accessCode: process.env.ACCESS_CODE,
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  port: parseInt(process.env.PORT) || 3000,
};

module.exports = config;
