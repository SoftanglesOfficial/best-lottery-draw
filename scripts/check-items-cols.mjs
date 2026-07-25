import pg from 'pg';
const c = new pg.Client({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
});
await c.connect();
const cols = await c.query(
  `select column_name from information_schema.columns where table_schema='public' and table_name='items' order by 1`,
);
console.log(cols.rows.map((r) => r.column_name));
await c.end();
