/**
 * Shared Ajv (draft 2020-12) validator helpers.
 *
 * Consolidates the `new Ajv2020({ allErrors: true, strict: false })` +
 * `addFormats(ajv)` construction and the read-schema-then-compile
 * `loadValidator` that were re-implemented inline across many validators.
 * Behavior is identical to the inline versions they replace:
 *
 *   - `createAjv`     — a configured Ajv 2020 instance with `allErrors`,
 *                       non-strict mode, and `ajv-formats` registered.
 *   - `loadValidator` — reads a JSON Schema from `schemaPath` and returns
 *                       the compiled validate function.
 *
 * Callers that need a single shared instance compiling many schemas (e.g.
 * `validate-json-schemas.mjs`) use `createAjv()` directly; callers that
 * compile one fixed schema use `loadValidator(schemaPath)`.
 *
 * @example
 *   import { loadValidator } from "./_lib/ajv-validator.mjs";
 *   const validate = loadValidator(SCHEMA_PATH);
 *   if (!validate(data)) console.error(validate.errors);
 */

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readJson } from "./json.mjs";

/** A configured Ajv 2020 instance (allErrors, non-strict, ajv-formats). */
export function createAjv(options = {}) {
  const ajv = new Ajv2020({ allErrors: true, strict: false, ...options });
  addFormats(ajv);
  return ajv;
}

/** Read a JSON Schema from `schemaPath` and return the compiled validator. */
export function loadValidator(schemaPath) {
  return createAjv().compile(readJson(schemaPath));
}
