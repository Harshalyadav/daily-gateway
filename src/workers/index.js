import clearFeaturesCache from './clearFeaturesCache';
import updateAlerts from './updateAlerts';
import updateSettings from './updateSettings';

const workers = [
  clearFeaturesCache,
  updateAlerts,
  updateSettings,
];

export default workers;
