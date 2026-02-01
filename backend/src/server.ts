import app from './app';

// For local development only
const PORT = process.env.PORT || 8001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📖 API endpoints:`);
  console.log(`   GET /api/health - Health check`);
  console.log(`   GET /api/cards - List cards`);
  console.log(`   GET /api/cards/search?q=... - Search cards`);
  console.log(`   GET /api/cards/:id - Get card by ID`);
});
