CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE posts (id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, excerpt TEXT NOT NULL, content TEXT NOT NULL, cover TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Música', author TEXT NOT NULL DEFAULT 'Daulinho Lima', status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE comments (id TEXT PRIMARY KEY NOT NULL, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, name TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, fingerprint TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX comments_post_status ON comments(post_id, status);
--> statement-breakpoint
CREATE INDEX comments_fingerprint_date ON comments(fingerprint, created_at);
