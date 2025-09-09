const express = require('express');
const router = express.Router();

// Test various cookie setting methods
router.get('/test-cookies', (req, res) => {
  const timestamp = Date.now();
  
  // Method 1: Express res.cookie
  res.cookie('test1', `express_${timestamp}`, {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    maxAge: 3600000,
    path: '/'
  });
  
  // Method 2: Express res.cookie with minimal options
  res.cookie('test2', `minimal_${timestamp}`, {
    maxAge: 3600000
  });
  
  // Method 3: Direct header
  const cookieValue = `test3=direct_${timestamp}; Max-Age=3600; Path=/; SameSite=Lax`;
  res.setHeader('Set-Cookie', cookieValue);
  
  // Method 4: Multiple cookies via array
  const cookies = [
    `test4=array1_${timestamp}; Max-Age=3600; Path=/`,
    `test5=array2_${timestamp}; Max-Age=3600; Path=/`
  ];
  res.append('Set-Cookie', cookies);
  
  res.json({
    message: 'Multiple cookie setting methods attempted',
    timestamp,
    headers: {
      'set-cookie': res.getHeaders()['set-cookie']
    },
    requestInfo: {
      protocol: req.protocol,
      secure: req.secure,
      hostname: req.hostname,
      headers: req.headers
    }
  });
});

// Test reading cookies
router.get('/read-cookies', (req, res) => {
  res.json({
    cookies: req.cookies || {},
    cookieHeader: req.headers.cookie || 'No cookie header',
    sessionID: req.sessionID,
    hasSession: !!req.session,
    sessionUser: req.session?.user || null
  });
});

// Test setting a simple cookie with minimal configuration
router.get('/simple-cookie', (req, res) => {
  // Most basic cookie possible
  res.setHeader('Set-Cookie', 'simple=test');
  res.send('Cookie set with minimal configuration');
});

// Test CloudFlare bypass headers
router.get('/cf-bypass', (req, res) => {
  // Try to bypass CloudFlare caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Set a test cookie
  res.cookie('cfbypass', 'test_' + Date.now(), {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    maxAge: 3600000
  });
  
  res.json({
    message: 'CloudFlare bypass headers set',
    responseHeaders: res.getHeaders()
  });
});

module.exports = router;