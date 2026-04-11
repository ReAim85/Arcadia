const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', agent: 'live-debugger', version: '1.0.0' });
});

app.post('/api/run', (req, res) => {
  const { error, code snippet } = req.body;

  if (!error || !codeSnippet) {
    return res.status(400).json({ error: 'Error and code snippet are required' });
  }

  // Simple mock LLM response - in reality this would call an actual LLM API
  const suggestedFix = `// Fixed version of your code\n${codeSnippet.replace(/console\.log/g, '// console.log // Removed for production')}\n// Added proper error handling\ntry {${codeSnippet}} catch (error) { console.error('Error:', error); }`;

  res.json({
    input: { error, codeSnippet },
    output: {
      suggestedFix,
      confidence: 0.85,
      explanation: 'Removed console.log statements and added try/catch error handling'
    }
  });
});

app.post('/api/demo', (req, res) => {
  // Demo: Show how the debugger works with a sample error
  const sampleError = "ReferenceError: user is not defined";
  const sampleCode = "console.log(user.name);";

  res.json({
    result: {
      suggestedFix: "// Fixed version\nconst user = { name: 'John Doe' };\nconsole.log(user.name);",
      confidence: 0.92,
      explanation: 'Defined the user variable before using it'
    },
    demo_config: {
      description: 'Live Debugger Demo - Error capture and LLM-powered fix suggestions',
      sample_errors: [
        'ReferenceError: user is not defined',
        'TypeError: Cannot read property \'length\' of undefined',
        'Error: Failed to fetch data from API'
      ]
    }
  });
});

// Start server
function startServer() {
  app.listen(PORT, () => {
    console.log(`Live Debugger Agent running on port ${PORT}`);
  });
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };