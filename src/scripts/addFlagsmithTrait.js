/* eslint-disable no-console */

import { readFile } from 'fs/promises';
import flagsmith from '../flagsmith';

const run = async (filename) => {
  const csv = await readFile(filename, { encoding: 'utf8' });
  const userIds = csv.split('\n');
  for (let i = 0; i < userIds.length; i += 1) {
    const userId = userIds[i].trim();
    console.log(`${i}/${userIds.length}`);
    // eslint-disable-next-line no-await-in-loop
    await flagsmith.setTrait(userId, 'companion_beta', 'true');
  }
};

run(process.argv[process.argv.length - 1])
  .then(console.log)
  .then(() => process.exit())
  .catch(console.error);

/* eslint-enable no-console */
