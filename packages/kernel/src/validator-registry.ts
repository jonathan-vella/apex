import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { sha256Json } from "./canonical.js";

export type ValidatorKind = "pure" | "freshness" | "authorization";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  cached: boolean;
}

export type ValidatorHandler = (value: unknown) => ValidationIssue[];

interface RegisteredValidator {
  handler: ValidatorHandler;
  kind: ValidatorKind;
}

export class ValidatorRegistry {
  private readonly validators = new Map<string, RegisteredValidator>();
  private readonly cache = new Map<string, Omit<ValidationResult, "cached">>();

  register(name: string, schema: TSchema, kind: ValidatorKind = "pure"): void {
    this.registerHandler(
      name,
      (value) =>
        [...Value.Errors(schema, value)].map((error) => ({
          path: error.path,
          message: error.message,
        })),
      kind,
    );
  }

  registerHandler(name: string, handler: ValidatorHandler, kind: ValidatorKind = "pure"): void {
    if (this.validators.has(name)) {
      throw new Error(`Validator ${name} is already registered`);
    }
    this.validators.set(name, { handler, kind });
  }

  has(name: string): boolean {
    return this.validators.has(name);
  }

  validate(name: string, value: unknown): ValidationResult {
    const validator = this.validators.get(name);
    if (validator === undefined) {
      throw new Error(`Unknown validator ${name}`);
    }
    const cacheKey = validator.kind === "pure" ? `${name}:${sha256Json(value)}` : undefined;
    const cached = cacheKey === undefined ? undefined : this.cache.get(cacheKey);
    if (cached !== undefined) {
      return { ...cached, issues: [...cached.issues], cached: true };
    }
    const issues = validator.handler(value);
    const result = { valid: issues.length === 0, issues };
    if (cacheKey !== undefined) {
      this.cache.set(cacheKey, { ...result, issues: [...issues] });
    }
    return { ...result, issues: [...issues], cached: false };
  }

  clearCache(): void {
    this.cache.clear();
  }
}
