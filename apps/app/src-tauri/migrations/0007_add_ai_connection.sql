-- Subscriptions add a choice of AI connection. Every existing install used an
-- API key, so record that explicitly; new connections are opted into later.
INSERT OR IGNORE INTO settings (key, value) VALUES ('ai.connection', 'api_key');
