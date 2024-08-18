const express = require("express");
const { db } = require("../helpers/database");
const router = express.Router();

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
 * POST endpoint that calculates the total price and subtotals of items based on their quantity and any applicable discounts.
 *
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {Function} next - The next middleware function.
 */
router.post("/", (req, res, next) => {
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

module.exports = router;
