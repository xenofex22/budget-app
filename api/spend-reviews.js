const { requireSession } = require('../lib/server/auth');
const { command, transactionsKey } = require('../lib/server/store');
const { createReviewHandler } = require('../lib/server/spendReviews');

module.exports = createReviewHandler({ requireSession, command, transactionsKey });
