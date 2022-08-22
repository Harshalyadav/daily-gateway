const workers = [
  { topic: 'alerts-updated', subscription: 'alerts-updated-redis' },
  { topic: 'settings-updated', subscription: 'settings-updated-redis' },
  { topic: 'user-updated', subscription: 'user-updated-mailing' },
  { topic: 'user-deleted', subscription: 'user-deleted-mailing' },
  { topic: 'user-reputation-updated', subscription: 'update-reputation' },
  {
    topic: 'user-registered',
    subscription: 'user-registered-referral-contest',
  },
  {
    topic: 'new-eligible-participant',
    subscription: 'new-eligible-participant-notification',
  },
  {
    topic: 'new-eligible-participant',
    subscription: 'new-eligible-participant-boost-chances',
  },
  {
    topic: 'gateway.changes',
    subscription: 'gateway-cdc',
    args: { enableMessageOrdering: true },
  },
  { topic: 'features-reset', subscription: 'clear-features-cache' },
];

module.exports = workers;
