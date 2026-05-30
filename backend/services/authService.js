import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/appError.js';

/**
 * Service handling all user registration, authentication, and JWT lifecycle.
 */
class AuthService {
  /**
   * Registers a new user.
   *
   * @param {Object} userData - Registration inputs
   * @param {string} userData.name - User full name
   * @param {string} userData.email - User email address
   * @param {string} userData.password - User password (min 6 characters)
   * @param {string} userData.role - User role ('asker' or 'answerer')
   * @returns {Promise<{token: string, user: Object}>} JWT and sanitized User object
   */
  async register({ name, email, password, role }) {
    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required.', 400);
    }

    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters.', 400);
    }

    const emailClean = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: emailClean });
    if (existingUser) {
      throw new AppError('An account with this email already exists.', 409);
    }

    const password_hash = await bcrypt.hash(password, 12);
    const allowedRoles = ['asker', 'answerer', 'both'];
    const userRole = allowedRoles.includes(role) ? role : 'asker';

    const user = await User.create({
      name: name.trim(),
      email: emailClean,
      password_hash,
      role: userRole,
    });

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        xp: user.xp,
      },
    };
  }

  /**
   * Log in user and return signed token.
   *
   * @param {Object} credentials - Login inputs
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @returns {Promise<{token: string, user: Object}>} JWT and sanitized User object
   */
  async login({ email, password }) {
    if (!email || !password) {
      throw new AppError('Email and password are required.', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      throw new AppError('Invalid email or password.', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401);
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        xp: user.xp,
        answers_count: user.answers_count,
        questions_count: user.questions_count,
      },
    };
  }
}

export default new AuthService();
