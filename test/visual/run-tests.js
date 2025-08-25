const { spawn } = require('child_process');
const path = require('path');

// Start the application server
const server = spawn('npm', ['start'], {
  cwd: path.resolve(__dirname, '../..'),
  stdio: 'pipe'
});

let serverReady = false;

server.stdout.on('data', (data) => {
  console.log(`Server: ${data}`);
  if (data.toString().includes('Electron') || data.toString().includes('ready')) {
    serverReady = true;
  }
});

server.stderr.on('data', (data) => {
  console.error(`Server Error: ${data}`);
});

// For this app, we'll use the test server instead
const testServer = spawn('node', ['test-server.js'], {
  cwd: path.resolve(__dirname, '../..'),
  stdio: 'pipe'
});

testServer.stdout.on('data', (data) => {
  console.log(`Test Server: ${data}`);
});

// Wait for server to start
setTimeout(() => {
  // Run Puppeteer tests
  const tests = spawn('npx', ['jest', '--config=test/visual/jest.config.js'], {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'inherit'
  });
  
  tests.on('close', (code) => {
    console.log(`Tests exited with code ${code}`);
    server.kill();
    testServer.kill();
    process.exit(code);
  });
}, 5000);