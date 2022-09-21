import clearFeaturesCache from './clearFeaturesCache';
import updateAlerts from './updateAlerts';
import updateSettings from './updateSettings';
import deleteUser from './deleteUser';

const workers = [
  clearFeaturesCache,
  deleteUser,
  updateAlerts,
  updateSettings,
];

export default workers;
