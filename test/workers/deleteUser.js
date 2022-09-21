import { expect } from 'chai';
import knexCleaner from 'knex-cleaner';
import db, { migrate, toCamelCase } from '../../src/db';
import user from '../../src/models/user';
import fixture from '../fixtures/users';
import providerFixture from '../fixtures/providers';
import provider from '../../src/models/provider';
import worker from '../../src/workers/deleteUser';
import { expectSuccessfulBackground } from '../helpers';

describe('clear users', () => {
  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    return migrate();
  });

  it('should delete user and provider', async () => {
    await user.add(
      fixture[0].id,
      fixture[0].name,
      fixture[0].email,
      fixture[0].image,
    );
    await provider.add(
      providerFixture[0].userId,
      providerFixture[0].provider,
      providerFixture[0].providerId,
    );

    await expectSuccessfulBackground(
      worker,
      {
        id: fixture[0].id,
      },
    );
    const users = await db.select('*').from('users').then((res) => res.map(toCamelCase));
    expect(users.length).to.equal(0);

    const providers = await db.select('*').from('providers').then((res) => res.map(toCamelCase));
    expect(providers.length).to.equal(0);
  });
});
