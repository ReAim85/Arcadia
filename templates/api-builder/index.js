const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// In-memory SQLite database for demo
let db = null;

// Initialize database
function initDatabase() {
  db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('Connected to in-memory SQLite database.');
    }
  });
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', agent: 'api-builder', version: '1.0.0' });
});

app.post('/api/run', (req, res) => {
  const { sql } = req.body;

  if (!sql) {
    return res.status(400).json({ error: 'SQL query is required' });
  }

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({ results: rows });
  });
});

app.post('/api/demo', (req, res) => {
  // Demo: Create a simple table and insert sample data
  const demoSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL
    );

    INSERT OR IGNORE INTO users (name, email) VALUES
      ('John Doe', 'john@example.com'),
      ('Jane Smith', 'jane@example.com'),
      ('Bob Johnson', 'bob@example.com');
  `;

  db.exec(demoSql, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to setup demo data' });
    }

    db.all('SELECT * FROM users', [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch demo data' });
      }

      res.json({
        result: rows,
        demo_config: {
          description: 'API Builder Demo - SQL to REST API converter',
          sample_queries: [
            'SELECT * FROM users',
            'INSERT INTO users (name, email) VALUES (\\'Alice\\', \\'alice@example.com\\')',
            'UPDATE users SET name = \\'Updated Name\\' WHERE id = 1'
          ]
        }
      });
    });
  });
});

// Start server
function startServer() {
  initDatabase();
  app.listen(PORT, () => {
    console.log(`API Builder Agent running on port ${PORT}`);
  });
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };