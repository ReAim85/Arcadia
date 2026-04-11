const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// In-memory SQLite database for demo
let db = null;

// Initialize database with sample data
function initDatabase() {
  db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('Connected to in-memory SQLite database.');

      // Create sample tables
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          amount DECIMAL(10,2),
          order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        INSERT OR IGNORE INTO users (name, email) VALUES
          ('Alice Smith', 'alice@example.com'),
          ('Bob Johnson', 'bob@example.com'),
          ('Carol Davis', 'carol@example.com');

        INSERT OR IGNORE INTO orders (user_id, amount) VALUES
          (1, 29.99),
          (1, 15.50),
          (2, 99.99),
          (3, 45.00),
          (2, 12.75);
      `);
    }
  });
}

// Simple natural language to SQL conversion (mock implementation)
function nlToSql(query) {
  const lowerQuery = query.toLowerCase().trim();

  // Very basic pattern matching for demo purposes
  if (lowerQuery.includes('count') && lowerQuery.includes('users')) {
    return 'SELECT COUNT(*) as total FROM users';
  }

  if (lowerQuery.includes('average') && lowerQuery.includes('order') && lowerQuery.includes('amount')) {
    return 'SELECT AVG(amount) as average_amount FROM orders';
  }

  if (lowerQuery.includes('total') && lowerQuery.includes('revenue') || lowerQuery.includes('total') && lowerQuery.includes('amount')) {
    return 'SELECT SUM(amount) as total_revenue FROM orders';
  }

  if (lowerQuery.includes('list') && lowerQuery.includes('users') && lowerQuery.includes('email')) {
    return 'SELECT name, email FROM users ORDER BY name';
  }

  if (lowerQuery.includes('show') && lowerQuery.includes('orders') && lowerQuery.includes('last') && lowerQuery.includes('5')) {
    return 'SELECT o.id, u.name, o.amount, o.order_date FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.order_date DESC LIMIT 5';
  }

  // Default fallback
  return 'SELECT * FROM users LIMIT 10';
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', agent: 'data-analyst', version: '1.0.0' });
});

app.post('/api/run', (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Natural language query is required' });
  }

  const sql = nlToSql(query);

  if (!sql) {
    return res.status(400).json({ error: 'Could not understand the query. Try rephrasing.' });
  }

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    res.json({
      input: query,
      generatedSql: sql,
      results: rows,
      rowCount: rows.length
    });
  });
});

app.post('/api/demo', (req, res) => {
  // Demo: Show natural language to SQL conversion
  const demoQuery = "Show me the total revenue from all orders";

  res.json({
    result: {
      input: demoQuery,
      generatedSql: 'SELECT SUM(amount) as total_revenue FROM orders',
      results: [{ total_revenue: 203.23 }],
      rowCount: 1
    },
    demo_config: {
      description: 'Data Analyst Demo - Natural language to SQL conversion with insights',
      sample_queries: [
        'How many users do we have?',
        'What is the average order amount?',
        'Show total revenue from all orders',
        'List all users with their email addresses',
        'Show the last 5 orders with customer names'
      ]
    }
  });
});

// Start server
function startServer() {
  initDatabase();
  app.listen(PORT, () => {
    console.log(`Data Analyst Agent running on port ${PORT}`);
  });
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };