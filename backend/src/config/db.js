const mongoose = require('mongoose');

let storageConnection = null;

/**
 * Sanitizes error messages to prevent database credentials and connection strings from being logged.
 */
function sanitizeErrorMessage(message) {
  if (typeof message !== 'string') return '';
  return message.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, 'mongodb://[REDACTED_URI]');
}

/**
 * Returns the storage database connection using STORAGE_MONGO_URI.
 * Connects separately from the primary authentication database.
 */
const getStorageConnection = () => {
  if (storageConnection && storageConnection.readyState !== 0) {
    return storageConnection;
  }

  const storageUri =
    process.env.NODE_ENV === 'test' && process.env.TEST_STORAGE_MONGO_URI
      ? process.env.TEST_STORAGE_MONGO_URI
      : process.env.STORAGE_MONGO_URI || process.env.STORAGE_MONGODB_URI;

  if (!storageUri) {
    throw new Error('STORAGE_MONGO_URI environment variable is missing.');
  }

  storageConnection = mongoose.createConnection(storageUri);

  storageConnection.on('error', (error) => {
    console.error(`Storage Database connection error: ${sanitizeErrorMessage(error.message)}`);
  });

  storageConnection.on('connected', () => {
    console.log('Storage Database connected successfully');
  });

  return storageConnection;
};

/**
 * Connects the primary authentication database and initializes the storage database connection.
 */
const connectDB = async () => {
  try {
    const mongoUri =
      process.env.NODE_ENV === 'test' && process.env.TEST_MONGO_URI
        ? process.env.TEST_MONGO_URI
        : process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is missing.');
    }
    await mongoose.connect(mongoUri);
    console.log('Database connected successfully');
  } catch (error) {
    console.error(`Database connection error: ${sanitizeErrorMessage(error.message)}`);
    process.exit(1);
  }

  try {
    getStorageConnection();
  } catch (error) {
    console.error(`Storage Database connection error: ${sanitizeErrorMessage(error.message)}`);
    process.exit(1);
  }
};

/**
 * Closes all active connections (useful for test suites and graceful shutdown)
 */
const closeConnections = async () => {
  if (storageConnection) {
    await storageConnection.close();
    storageConnection = null;
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};

connectDB.connectDB = connectDB;
connectDB.getStorageConnection = getStorageConnection;
connectDB.closeConnections = closeConnections;

module.exports = connectDB;
