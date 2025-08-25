const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'src')));
app.use('/styles', express.static(path.join(__dirname, 'src/styles')));
app.use('/js', express.static(path.join(__dirname, 'src/js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Serve the standalone HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/standalone.html'));
});

app.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
});