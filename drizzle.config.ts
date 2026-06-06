import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/main/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    database: 'best12_dev',
    ssl: false,
  },
});
