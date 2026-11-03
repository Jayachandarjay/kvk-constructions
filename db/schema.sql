-- Optional Cloudflare D1 schema for storing enquiries.
-- NOT required for email delivery. Apply with:
--   npx wrangler d1 create kvk-enquiries
--   npx wrangler d1 execute kvk-enquiries --file=db/schema.sql --remote
-- then bind the database as "DB" in Pages -> Settings -> Bindings.
CREATE TABLE IF NOT EXISTS enquiries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT NOT NULL,
  company    TEXT,
  message    TEXT NOT NULL,
  ip         TEXT,
  created_at TEXT NOT NULL
);
