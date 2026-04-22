/**
 * Shared Validation Reporter
 *
 * Provides consistent error/warn/ok reporting and summary output
 * across all validation scripts. Reduces ~150 lines of duplicated
 * reporter boilerplate across 15+ validators.
 *
 * @example
 *   import { Reporter } from "./_lib/reporter.mjs";
 *   const r = new Reporter("Agent Frontmatter Validator");
 *   r.error("file.md", "Missing required field");
 *   r.warn("file.md", "Deprecated pattern");
 *   r.ok("file.md", "Valid");
 *   r.summary();          // prints summary
 *   r.exitOnError();      // process.exit(1) if errors > 0
 */

export class Reporter {
  /** @param {string} title - Validator display name */
  constructor(title) {
    this.title = title;
    this.errors = 0;
    this.warnings = 0;
    this.checked = 0;
  }

  header() {
    console.log(`\n🔍 ${this.title}\n`);
  }

  /** Count an item as checked */
  tick() {
    this.checked++;
  }

  error(location, msg) {
    if (msg === undefined) {
      console.error(`  ❌ ${location}`);
    } else {
      console.error(`  ❌ ${location}: ${msg}`);
    }
    this.errors++;
  }

  /** GitHub Actions annotation format */
  errorAnnotation(file, msg) {
    console.log(`::error file=${file}::${msg}`);
    this.errors++;
  }

  warn(location, msg) {
    if (msg === undefined) {
      console.warn(`  ⚠️  ${location}`);
    } else {
      console.warn(`  ⚠️  ${location}: ${msg}`);
    }
    this.warnings++;
  }

  warnAnnotation(file, msg) {
    console.log(`::warning file=${file}::${msg}`);
    this.warnings++;
  }

  ok(location, msg) {
    if (msg === undefined) {
      console.log(`  ✅ ${location}`);
    } else {
      console.log(`  ✅ ${location}: ${msg}`);
    }
  }

  /** Print check/description as pass or fail based on condition */
  check(description, condition, severity = "error") {
    this.checked++;
    if (condition) {
      this.ok(description);
    } else if (severity === "warn") {
      this.warn(description);
    } else {
      this.error(description);
    }
  }

  separator() {
    console.log(`\n${"─".repeat(50)}`);
  }

  summary(label) {
    this.separator();
    const parts = [];
    if (this.checked > 0) parts.push(`Checked: ${this.checked}`);
    parts.push(`Errors: ${this.errors}`);
    parts.push(`Warnings: ${this.warnings}`);
    console.log(parts.join(" | "));
  }

  /** Print final pass/fail and exit with appropriate code */
  exitOnError(passMsg, failMsg) {
    if (this.errors > 0) {
      console.log(`\n❌ ${failMsg || `${this.errors} error(s) found`}`);
      process.exit(1);
    }
    if (this.warnings > 0) {
      console.log(`\n⚠️  Passed with ${this.warnings} warning(s)`);
    } else {
      console.log(`\n✅ ${passMsg || `${this.title} passed`}`);
    }
  }
}
