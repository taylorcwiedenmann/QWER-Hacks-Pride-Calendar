require("dotenv").config();
const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_KEYFILE,
  scopes: ["https://www.googleapis.com/auth/calendar"]
});

module.exports = { auth, google };