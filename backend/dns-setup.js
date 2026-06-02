/**
 * dns-setup.js
 * Overrides Node.js DNS resolution to use public resolvers.
 * Prevents 'querySrv ECONNREFUSED' failures caused by ISP-level
 * blocks on MongoDB Atlas SRV records in restricted networks.
 *
 * Must be imported before any network-dependent module.
 */
import dns from 'node:dns';
import logger from './utils/logger.js';

if (process.env.NODE_ENV !== 'production') {
  dns.setServers(['1.1.1.1', '8.8.8.8']); // Cloudflare + Google
  logger.info('DNS', 'Public DNS resolvers active (1.1.1.1, 8.8.8.8)');
}
