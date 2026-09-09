import assert from "node:assert/strict";
import test from "node:test";

import { normalizeApiBaseUrl } from "../dist/utils.js";

test("normalizeApiBaseUrl adds https when scheme missing", () => {
  assert.equal(
    normalizeApiBaseUrl("api.example.com"),
    "https://api.example.com",
  );
});

test("normalizeApiBaseUrl strips trailing slashes", () => {
  assert.equal(
    normalizeApiBaseUrl("https://api.example.com/"),
    "https://api.example.com",
  );
});
