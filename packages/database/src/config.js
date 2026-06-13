module.exports = {
  databaseUrl: process.env.DATABASE_URL,
  migrationsTable: 'pgmigrations',
  dir: 'src/migrations',
  ssl: true,
  'reject-unauthorized': false,
};
