// Fixed on purpose: the global setup and every test file need to agree on the
// same connection details without relying on process.env propagation across
// vitest's worker pool, so this is a plain shared constant instead.
export const TEST_DB_PORT = 54329;
export const TEST_DB_NAME = "focus_test";
export const TEST_DB_URL = `postgresql://postgres:password@127.0.0.1:${TEST_DB_PORT}/${TEST_DB_NAME}`;
