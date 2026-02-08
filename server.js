//render uses express to send frontend data to client
//render uses socket to communicate real time data between client and its server
//render sends/retrives data from mongodb using mongoose

//imports dotenv and calls config method
//sends data to proccess.env object
require("dotenv").config();

//import express object
const express = require("express");


//constructs app as express object
const app = express();
app.use(express.static("public"));
app.get("/ping", (req, res) => res.send("ok"));



//start the server
//get port from process.env
const PORT = process.env.PORT || 3000;
//start recieving data from that port to our server
app.listen(PORT, function() {
  console.log(`Server running on port ${PORT}`);
});




