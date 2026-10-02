import { coletar } from "../src/lib/coletor";
import { sql } from "../src/lib/db";

console.log(JSON.stringify(await coletar(), null, 2));
await sql().end();
