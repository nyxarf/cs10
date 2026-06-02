import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectMongoDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    logger.success('Database', `MongoDB connected — host: ${conn.connection.host}`);
  } catch (error) {
    logger.error('Database', `Connection failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectMongoDB;
