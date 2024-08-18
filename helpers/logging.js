const path = require("path");
const winston = require("winston");

const _logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, "..", "logs", "error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "..", "logs", "combined.log"),
    }),
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

//We have an abstraction layer for logging to make it easier if we want to augment the logging or switch to a different library
const logger = {
  error: (error) => {
    _logger.error(error.message, { stack: error.stack });
  },
  info: (message) => {
    _logger.info(message);
  },
};

module.exports = logger;
