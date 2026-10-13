export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  db: {
    type: process.env.DB_TYPE ?? 'sqlite',
    sqlitePath: process.env.DB_SQLITE_PATH ?? 'data/dev.sqlite',
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USER ?? 'root',
    password: YOUR_PASSWORD ?? 'root',
    database: process.env.DB_NAME ?? 'openvideo2026'
  },
  redis: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10)
  }
});
