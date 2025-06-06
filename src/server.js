// Import required modules
import express from 'express';
const app = express();
const port = 3001;

// Middleware to parse JSON bodies
app.use(express.json());

// Use ES module import syntax
import axios from 'axios';

// New route for AI signal alerts
app.post('/api/ai-signal', async (req, res) => {
  try {
    const { pair, direction, lotSize } = req.body;
    // Call AI model or external API to generate signal
const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
  params: { symbol: pair }
});
const currentPrice = parseFloat(response.data.price);
const signal = direction === 'buy' && currentPrice > lotSize ? 'strong_buy' : 'strong_sell';
res.json({ signal, price: currentPrice });
  } catch (error) {
    console.error('Error generating AI signal:', error);
    res.status(500).json({ error: 'Failed to generate AI signal' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
