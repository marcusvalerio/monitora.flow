import postgres from "postgres";

let _sql: postgres.Sql | null = null;

export function sql(): postgres.Sql {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não definida");
    _sql = postgres(url, { ssl: url.includes("localhost") ? false : "require", max: 3, idle_timeout: 20, onnotice: () => {} });
  }
  return _sql;
}
