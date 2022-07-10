/* eslint-disable no-console */

import flagsmith from '../flagsmith';

const run = async (userId) => flagsmith.getIdentityFlags(userId);

run(process.argv[process.argv.length - 1])
  .then(console.log)
  .then(() => process.exit())
  .catch(console.error);

/* eslint-enable no-console */
