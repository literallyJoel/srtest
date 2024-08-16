// Import the necessary modules
const Database = require("better-sqlite3");
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const logger = require("./logging");

// Initialise the express app
const app = express();

// Initialise the SQLite database
const db = new Database(path.join(__dirname, "db.sqlite"));

/**
 * Sets up the database tables and inserts initial data if it doesn't exist.
 *
 * This function creates the `product` and `offers` tables in the SQLite database,
 * and populates them with test data. If the tables or data already exist, it ensures
 * no duplicates are added.
 */
function setup() {
  try {
    // Create the product table
    db.exec(
      "CREATE TABLE IF NOT EXISTS product (item_code TEXT PRIMARY KEY NOT NULL, unit_price INTEGER NOT NULL)"
    );

    // Create the offers table
    db.exec(
      "CREATE TABLE IF NOT EXISTS offers (item_code TEXT NOT NULL, discount_quantity INTEGER NOT NULL, discount_price INTEGER NOT NULL, PRIMARY KEY (item_code, discount_quantity))"
    );

    // Insert initial data into the product table
    db.exec(
      "INSERT INTO product (item_code, unit_price) VALUES ('A', 50), ('B', 35), ('C', 25), ('D', 12) ON CONFLICT(item_code) DO NOTHING;"
    );

    // Insert initial data into the offers table
    db.exec(
      "INSERT INTO offers (item_code, discount_quantity, discount_price) VALUES ('A', 3, 140), ('B', 2, 60) ON CONFLICT(item_code, discount_quantity) DO UPDATE SET discount_price = excluded.discount_price;"
    );
  } catch (e) {
    logger.error(e, "func: setup");
    process.exit(1);
  }
}

// Run the setup function to initialize the database
setup();

// Tell the app to use the JSON body parser middleware
app.use(bodyParser.json());

/**
 * Retrieves details of the items from the database based on the provided item codes.
 *
 * @param {string[]} itemCodes - An array of item codes to look up in the database.
 * @returns {Object[]} An array of objects containing item details, including any applicable discounts.
 */
function getItemDetails(itemCodes) {
  // Convert the array of item codes into a comma-separated string of placeholders
  const placeholders = itemCodes.map(() => "?").join(",");

  // Retrieve item details from the database
  return db
    .prepare(
      `SELECT product.*, offers.discount_quantity, offers.discount_price 
       FROM product 
       LEFT JOIN offers ON product.item_code = offers.item_code 
       WHERE product.item_code IN (${placeholders})`
    )
    .all(itemCodes);
}

/**
 * Calculates the total price for a given quantity of items, applying any applicable discounts.
 *
 * @param {number} quantity - The number of items to be purchased.
 * @param {number} price - The unit price of the item.
 * @param {number} discountQuantity - The quantity needed to qualify for a discount.
 * @param {number} discountPrice - The total price for the items if the discount applies.
 * @returns {number} The total price after applying any discounts.
 */
function calculateDiscountedTotal(
  quantity,
  price,
  discountQuantity,
  discountPrice
) {
  // If no discount applies, return the total price without discount
  if (!discountQuantity || !discountPrice) {
    return quantity * price;
  }

  // Initialize the total price
  let totalPrice = 0;

  // Calculate the total price with the discount applied
  if (quantity >= discountQuantity) {
    const numberToDiscount = Math.floor(quantity / discountQuantity);
    totalPrice = numberToDiscount * discountPrice;
  }

  // Add the price of items that do not qualify for the discount
  const fullPriced = quantity % discountQuantity;
  return totalPrice + fullPriced * price;
}

/**
 * Validates the request body to ensure it contains the correct structure.
 *
 * @param {Object|Object[]} body - The request body, either a single object or an array of objects.
 * @returns {Object[]|false} An array of valid item objects, or `false` if validation fails.
 */
function validateBody(body) {
  // If the body is not an array, validate it as a single object
  if (!Array.isArray(body)) {
    if (!body.code || !body.quantity || typeof body.quantity !== "number") {
      return false;
    }
    return [{ code: body.code, quantity: body.quantity }];
  } else {
    // If the body is an array, validate each item in the array
    let isValid = true;
    body.forEach((item) => {
      if (!item.code || !item.quantity || typeof item.quantity !== "number") {
        isValid = false;
      }
    });

    // Return the array if valid, otherwise return false
    return isValid ? body : false;
  }
}

/**
 * POST endpoint that calculates the total price and subtotals of items based on their quantity and any applicable discounts.
 *
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {Function} next - The next middleware function.
 */
app.post("/", async (req, res, next) => {
  try {
    // Validate the request body and return 400 if invalid
    const requested = validateBody(req.body);

    if (!requested) {
      res.status(400).json({
        error:
          "Invalid request body. Expected [{code: string, quantity: number}] or {code: string, quantity: number}",
      });
      return;
    }

    // Get the item details from the database
    const dbItemDetails = getItemDetails(requested.map((item) => item.code));

    // Ensure there are no unknown items and return 400 if there are
    if (dbItemDetails.length !== requested.length) {
      res.status(400).json({
        error: "Unknown item code included",
      });
      return;
    }

    // Create a map of item codes to requested quantities
    const requestedQuantities = new Map(
      requested.map((item) => [item.code, item.quantity])
    );

    // Combine database details with requested quantities
    const itemDetails = dbItemDetails.map((item) => ({
      ...item,
      requestedQuantity: requestedQuantities.get(item.item_code) || 0,
    }));

    // Calculate the total value for each item after discounts are applied
    const calculatedPrices = itemDetails.map((item) => ({
      code: item.item_code,
      quantity: item.requestedQuantity,
      subtotal: calculateDiscountedTotal(
        item.requestedQuantity,
        item.unit_price,
        item.discount_quantity,
        item.discount_price
      ),
    }));

    // Calculate the total value of all items
    const total = calculatedPrices.reduce((total, item) => {
      return total + item.subtotal;
    }, 0);

    // Return the total value and the subtotals
    res.json({ subtotals: calculatedPrices, total });
  } catch (e) {
    next(e);
  }
});

/**
 * Error-handling middleware that logs errors and sends a generic error response.
 *
 * @param {Error} err - The error object.
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {Function} next - The next middleware function.
 */
app.use((err, req, res, next) => {
  // Log the error
  logger.error(err);
  // Send a generic error response - security through obscurity
  res.status(500).json({ error: "Internal server error" });
});

// Start the server and listen on the specified port
if (process.env.NODE_ENV !== "test") {
  //If we're testing we want to run the server within the test environment
  app.listen(process.env.PORT ?? 8080, () => {
    console.log("Server started on port", process.env.PORT ?? 8080);
  });
}

module.exports = app;
