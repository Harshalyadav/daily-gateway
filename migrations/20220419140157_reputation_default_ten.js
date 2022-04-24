exports.up = async (knex) => knex.schema.table('users', (table) => {
  table.integer('reputation').default(10).alter();
});

exports.down = async (knex) => knex.schema.table('users', (table) => {
  table.integer('reputation').default(1).alter();
});
