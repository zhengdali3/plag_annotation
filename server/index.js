const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3001; // Port for the backend server

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON request bodies

// --- Database Setup ---
const dbPath = path.join(__dirname, 'annotations.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    // Create tables if they don't exist
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          user_id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL
        )
      `, (err) => {
        if (err) console.error("Error creating 'users' table:", err.message);
        else console.log("'users' table ready.");
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS decisions (
          decision_id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          case_filename TEXT NOT NULL,
          decision TEXT NOT NULL CHECK(decision IN ('Plagiarism', 'Not Plagiarism')),
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (user_id),
          UNIQUE(user_id, case_filename) -- Ensure one decision per user per case
        )
      `, (err) => {
        if (err) console.error("Error creating 'decisions' table:", err.message);
        else console.log("'decisions' table ready.");
      });
    });
  }
});

// --- API Endpoints ---

// Basic test route
app.get('/', (req, res) => {
  res.send('Plagiarism Annotation Backend is running!');
});

// User Registration
app.post('/api/register', (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const sql = 'INSERT INTO users (username) VALUES (?)';
  db.run(sql, [username], function(err) { // Use function() to access this.lastID
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      console.error('Error registering user:', err.message);
      return res.status(500).json({ error: 'Failed to register user' });
    }
    console.log(`User registered: ${username} with ID: ${this.lastID}`);
    res.status(201).json({ message: 'User registered successfully', userId: this.lastID, username: username });
  });
});

// User Login (Simple check if user exists)
app.post('/api/login', (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const sql = 'SELECT user_id FROM users WHERE username = ?';
  db.get(sql, [username], (err, row) => {
    if (err) {
      console.error('Error logging in user:', err.message);
      return res.status(500).json({ error: 'Failed to login' });
    }
    if (row) {
      console.log(`User logged in: ${username}`);
      res.status(200).json({ message: 'Login successful', userId: row.user_id, username: username });
    } else {
      res.status(401).json({ error: 'Invalid username' });
    }
  });
});


// --- Case Data Endpoints ---

const dataDirectory = path.join(__dirname, '..', 'data'); // Path to the data directory relative to server/index.js

// List all available case JSON files
app.get('/api/cases', (req, res) => {
  fs.readdir(dataDirectory, (err, files) => {
    if (err) {
      console.error('Error reading data directory:', err);
      // Check if the directory exists
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: `Data directory not found at ${dataDirectory}` });
      }
      return res.status(500).json({ error: 'Failed to list case files' });
    }

    const jsonFiles = files.filter(file => path.extname(file).toLowerCase() === '.json');
    res.status(200).json(jsonFiles);
  });
});

// Get content of a specific case JSON file
app.get('/api/case/:fname', (req, res) => { // Changed :filename to :fname
  const fname = req.params.fname; // Changed filename to fname
  // Basic validation to prevent path traversal
  if (fname.includes('..') || fname.includes('/')) { // Changed filename to fname
      return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = path.join(dataDirectory, fname); // Changed filename to fname

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: `Case file not found: ${fname}` }); // Changed filename to fname
      }
      console.error(`Error reading case file ${fname}:`, err); // Changed filename to fname
      return res.status(500).json({ error: `Failed to read case file: ${fname}` }); // Changed filename to fname
    }

    try {
      const jsonData = JSON.parse(data);
      res.status(200).json(jsonData);
    } catch (parseErr) {
      console.error(`Error parsing JSON file ${fname}:`, parseErr); // Changed filename to fname
      res.status(500).json({ error: `Failed to parse case file: ${fname}` }); // Changed filename to fname
    }
  });
});


// --- Source File Endpoint ---

// Middleware to handle file requests for paths starting with /api/file/
const fileHandlerMiddleware = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] fileHandlerMiddleware entered for path: ${req.path}`); // ADDED LOG
  // Extract the path after '/api/file/'
  const baseRoute = '/api/file/';
  // Check if the path starts correctly and has content after the base
  if (!req.path.startsWith(baseRoute) || req.path.length <= baseRoute.length) {
    // If the path is just '/api/file/' or doesn't match, pass to next middleware/route
    return next();
  }
  const requestedPath = req.path.substring(baseRoute.length);

  if (!requestedPath) {
    return res.status(400).json({ error: 'File path is required' });
  }

  // Construct the absolute path relative to the project root directory (one level up from __dirname)
  const projectRoot = path.resolve(__dirname, '..');
  const absoluteFilePath = path.resolve(projectRoot, requestedPath);

  // Security Check: Ensure the resolved path is still within the project root directory
  if (!absoluteFilePath.startsWith(projectRoot)) {
    console.warn(`Potential path traversal attempt blocked: ${requestedPath} resolved to ${absoluteFilePath}`);
    return res.status(403).json({ error: 'Access denied: Invalid file path' });
  }

  // Log the attempt
  console.log(`Attempting to read file. Requested path: "${requestedPath}", Resolved absolute path: "${absoluteFilePath}"`);

  // Check if the file exists and read it
  fs.readFile(absoluteFilePath, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error(`Source file not found: ${absoluteFilePath}`);
        return res.status(404).json({ error: `Source file not found: ${requestedPath}` });
      }
      console.error(`Error reading source file ${absoluteFilePath}:`, err);
      return res.status(500).json({ error: `Failed to read source file: ${requestedPath}` });
    }
    // Send the file content as plain text
    res.type('text/plain').send(data);
  });
};

// Attach the middleware for paths starting with /api/file/ using app.use()
// app.use('/api/file/', fileHandlerMiddleware); // Temporarily commented out for debugging startup


// --- Decision Endpoints ---

// Get all decisions for a specific user
app.get('/api/decisions/:uname', (req, res) => { // Changed :username to :uname
  const { uname } = req.params; // Changed username to uname

  // First, get the user_id for the username
  const getUserSql = 'SELECT user_id FROM users WHERE username = ?';
  db.get(getUserSql, [uname], (err, userRow) => { // Changed username to uname
    if (err) {
      console.error('Error finding user for decisions:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve decisions' });
    }
    if (!userRow) {
      return res.status(404).json({ error: `User not found: ${uname}` }); // Changed username to uname
    }

    const userId = userRow.user_id;
    // Then, get all decisions for that user_id
    const getDecisionsSql = 'SELECT case_filename, decision, timestamp FROM decisions WHERE user_id = ?';
    db.all(getDecisionsSql, [userId], (err, decisionRows) => {
      if (err) {
        console.error('Error retrieving decisions:', err.message);
        return res.status(500).json({ error: 'Failed to retrieve decisions' });
      }
      // Return decisions keyed by filename for easier frontend lookup
      const decisionsMap = decisionRows.reduce((acc, row) => {
        acc[row.case_filename] = { decision: row.decision, timestamp: row.timestamp };
        return acc;
      }, {});
      res.status(200).json(decisionsMap);
    });
  });
});

// Submit a decision for a case by a user
app.post('/api/decisions/:uname/:fname', (req, res) => { // Changed :username/:filename to :uname/:fname
  const { uname, fname } = req.params; // Changed username, filename to uname, fname
  const { decision } = req.body; // Expecting 'Plagiarism' or 'Not Plagiarism'

  if (!decision || !['Plagiarism', 'Not Plagiarism'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision value provided' });
  }
  // Basic validation to prevent path traversal in filename
  if (fname.includes('..') || fname.includes('/')) { // Changed filename to fname
      return res.status(400).json({ error: 'Invalid filename' });
  }

  // Get user_id
  const getUserSql = 'SELECT user_id FROM users WHERE username = ?';
  db.get(getUserSql, [uname], (err, userRow) => { // Changed username to uname
    if (err) {
      console.error('Error finding user for decision submission:', err.message);
      return res.status(500).json({ error: 'Failed to submit decision' });
    }
    if (!userRow) {
      return res.status(404).json({ error: `User not found: ${uname}` }); // Changed username to uname
    }

    const userId = userRow.user_id;
    const insertDecisionSql = `
      INSERT INTO decisions (user_id, case_filename, decision)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, case_filename) DO UPDATE SET
      decision = excluded.decision,
      timestamp = CURRENT_TIMESTAMP
    `; // Use INSERT ... ON CONFLICT to handle updates

    db.run(insertDecisionSql, [userId, fname, decision], function(err) { // Changed filename to fname
      if (err) {
        console.error('Error submitting decision:', err.message);
        return res.status(500).json({ error: 'Failed to submit decision' });
      }
      console.log(`Decision recorded/updated for user ${uname} (${userId}), case ${fname}: ${decision}`); // Changed username, filename to uname, fname
      res.status(200).json({ message: 'Decision submitted successfully' });
    });
  });
});


// --- Start Server ---
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});
