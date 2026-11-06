const categories = require('../spendCategories.json');

// Reviews belong to transaction IDs, never to the merchant-classification rules.
function createReviewHandler({ requireSession, command, transactionsKey }) {
  return async function handler(req, res) {
    const username = requireSession(req, res);
    if (!username) return;
    res.setHeader('Cache-Control', 'no-store');
    const key = `${transactionsKey(username)}:category-reviews`;
    try {
      if (req.method === 'GET') {
        const values = (await command('HGETALL', key)) || [];
        const reviews = Object.create(null);
        for (let i = 0; i < values.length; i += 2) {
          try { reviews[values[i]] = JSON.parse(values[i + 1]); } catch { /* Ignore malformed entries. */ }
        }
        return res.status(200).json({ reviews });
      }
      if (req.method !== 'PATCH' && req.method !== 'DELETE') {
        res.setHeader('Allow', 'GET, PATCH, DELETE');
        return res.status(405).json({ error: 'Method not allowed' });
      }
      const id = req.body?.id;
      if (typeof id !== 'string' || !id.trim() || id.length > 80) return res.status(400).json({ error: 'Invalid transaction ID' });
      const category = req.body?.category;
      const subcategory = typeof req.body?.subcategory === 'string' ? req.body.subcategory.trim() : '';
      if (req.method === 'PATCH' && (!categories.includes(category) || !subcategory || subcategory.length > 80 || /[\r\n\t]/.test(subcategory))) {
        return res.status(400).json({ error: 'Choose a category and enter a detail of up to 80 characters.' });
      }
      const transactions = (await command('LRANGE', transactionsKey(username), '0', '-1')) || [];
      const transaction = transactions.map(row => {
        try { return typeof row === 'string' ? JSON.parse(row) : row; } catch { return null; }
      }).find(row => row?.id === id);
      if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
      if (transaction.classification !== 'daily_spend') return res.status(409).json({ error: 'Only Daily Spend transactions can be reviewed here.' });
      if (req.method === 'DELETE') {
        await command('HDEL', key, id);
        return res.status(200).json({ ok: true });
      }
      const review = { category, subcategory, reviewedAt: new Date().toISOString() };
      // One atomic hash field update avoids rewriting the transaction list or
      // overwriting reviews saved concurrently for other transactions.
      await command('HSET', key, id, JSON.stringify(review));
      return res.status(200).json({ ok: true, review });
    } catch (error) {
      console.error('expense category review', error);
      return res.status(500).json({ error: 'Could not save or load category reviews. Please try again.' });
    }
  };
}

module.exports = { createReviewHandler };
