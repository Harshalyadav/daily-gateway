const workers = [
  { topic: 'alerts-updated', subscription: 'alerts-updated-redis' },
  { topic: 'settings-updated', subscription: 'settings-updated-redis' },
  { topic: 'features-reset', subscription: 'clear-features-cache' },
];

module.exports = workers;
