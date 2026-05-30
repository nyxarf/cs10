// backend/dns-setup.js
import dns from 'node:dns';

/**
 * Global DNS Override for Local Development
 * Resolves 'querySrv ECONNREFUSED' errors caused by regional ISP blocks on MongoDB Atlas.
 */
if (process.env.NODE_ENV !== 'production') {
  console.log('Applying local DNS override for MongoDB SRV resolution...');
  dns.setServers([
    "1.1.1.1", // Cloudflare
    "8.8.8.8"  // Google
  ]);
}