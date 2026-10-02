import { readFileSync } from "node:fs";
import { sql } from "../src/lib/db";

const db = sql();
await db.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
console.log("esquema aplicado");
await db.end();
