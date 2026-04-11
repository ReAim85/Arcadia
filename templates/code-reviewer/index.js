const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', agent: 'code-reviewer', version: '1.0.0' });
});

app.post('/api/run', (req, res) => {
  const { prUrl } = req.body;

  if (!prUrl) {
    return res.status(400).json({ error: 'PR URL is required' });
  }

  // Mock analysis - in reality this would fetch the PR and analyze the code
  const review = {
    summary: 'Code review completed',
    filesChanged: 5,
    additions: 124,
    deletions: 32,
    issues: [
      {
        id: 1,
        severity: 'high',
        category: 'security',
        description: 'Potential SQL injection in user login query',
        file: 'src/auth/login.js',
        line: 45,
        suggestion: 'Use parameterized queries instead of string concatenation'
      },
      {
        id: 2,
        severity: 'medium',
        category: 'performance',
        description: 'Nested loop detected in data processing function',
        file: 'src/utils/data-processor.js',
        line: 78,
        suggestion: 'Consider using a hash map or set for O(1) lookups'
      },
      {
        id: 3,
        severity: 'low',
        category: 'style',
        description: 'Missing JSDoc comment for public function',
        file: 'src/api/users.js',
        line: 12,
        suggestion: 'Add JSDoc comment describing parameters and return value'
      }
    ],
    score: 7.5 // Out of 10
  };

  res.json({
    input: { prUrl },
    output: review
  });
});

app.post('/api/demo', (req, res) => {
  // Demo: Show a sample code review
  const samplePrUrl = 'https://github.com/user/repo/pull/123';

  res.json({
    result: {
      summary: 'Demo code review completed',
      filesChanged: 3,
      additions: 45,
      deletions: 12,
      issues: [
        {
          id: 1,
          severity: 'high',
          category: 'security',
          description: 'Hardcoded API key in source code',
          file: 'src/config.js',
          line: 8,
          suggestion: 'Move API key to environment variables'
        },
        {
          id: 2,
          severity: 'medium',
          category: 'performance',
          description: 'Unnecessary re-render in React component',
          file: 'src/components/UserProfile.jsx',
          line: 34,
          suggestion: 'Use React.memo or useCallback to prevent unnecessary re-renders'
        }
      ],
      score: 8.2
    },
    demo_config: {
      description: 'Code Reviewer Demo - Structured PR analysis with severity ratings',
      sample_pr_urls: [
        'https://github.com/facebook/react/pull/12345',
        'https://github.com/vercel/next.js/pull/67890',
        'https://github.com/nodejs/node/pull/54321'
      ]
    }
  });
});

// Start server
function startServer() {
  app.listen(PORT, () => {
    console.log(`Code Reviewer Agent running on port ${PORT}`);
  });
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };