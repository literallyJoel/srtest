const Database = require("better-sqlite3");
const path = require("path");
// Initialise the SQLite database
const db = new Database(path.join(__dirname, "..", "db.sqlite"));

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

module.exports = { db, setup };
