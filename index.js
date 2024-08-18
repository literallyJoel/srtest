// Import the necessary modules
const express = require("express");
const bodyParser = require("body-parser");
const logger = require("./helpers/logging");
const { setup } = require("./helpers/database");
const checkoutRouter = require("./routes/checkout");
// Initialise the express app
const app = express();

//Run the database setup
setup();

// Tell the app to use the JSON body parser middleware
app.use(bodyParser.json());

//Add the checkout route
app.use("/checkout", checkoutRouter);

//Error handling middleware for all endpoints
app.use((err, req, res, next) => {
  // Log the error
  logger.error(err);
  // Send a generic error response - security through obscurity
  res.status(500).json({ error: "Internal server error" });
});

// Start the server and listen on the specified port
if (process.env.NODE_ENV !== "test") {
  //If we're testing we want to run the server within the test environment so we can close it properly at the end
  app.listen(process.env.PORT ?? 8080, () => {
    console.log("Server started on port", process.env.PORT ?? 8080);
  });
}

//Exported for testing
module.exports = { app };
