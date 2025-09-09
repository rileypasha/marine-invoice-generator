/**
 * Middleware to fix cookie issues with custom domains
 * CloudFlare and custom domains can cause cookie problems
 */

const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const cookieFix = (req, res, next) => {
  // Log the request details for debugging
  const requestInfo = {
    hostname: req.hostname,
    protocol: req.protocol,
    secure: req.secure,
    originalUrl: req.originalUrl,
    headers: {
      host: req.headers.host,
      origin: req.headers.origin,
      cookie: req.headers.cookie ? 'present' : 'absent'
    }
  };

  // Override the session cookie settings for specific domains
  if (req.hostname === 'mginvoices.com' || req.hostname === 'www.mginvoices.com') {
    // For custom domain, ensure cookies are set correctly
    if (req.session) {
      req.session.cookie.secure = false; // Force non-secure for CloudFlare
      req.session.cookie.httpOnly = true;
      req.session.cookie.sameSite = 'lax';
      
      // Force session to be saved
      req.session.touch();
      
      logger.info({
        event: 'COOKIE_FIX_APPLIED',
        hostname: req.hostname,
        sessionId: req.sessionID,
        cookieSettings: req.session.cookie
      });
    }
  }

  // Add CORS headers for custom domain
  if (req.hostname === 'mginvoices.com' || req.hostname === 'www.mginvoices.com') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', `https://${req.hostname}`);
  }

  next();
};

module.exports = cookieFix;