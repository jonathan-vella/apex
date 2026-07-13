import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";
import { redactStructuredSecrets } from "./secret-redaction.js";

export type ProcessErrorCode =
  "PROCESS_EXIT_NONZERO" | "PROCESS_OUTPUT_LIMIT" | "PROCESS_SPAWN_ERROR" | "PROCESS_TIMEOUT";

export class ProcessRunnerError extends Error {
  constructor(
    public readonly code: ProcessErrorCode,
    message: string,
    public readonly result?: ProcessResult,
  ) {
    super(message);
    this.name = "ProcessRunnerError";
  }
}

export interface ProcessRequest {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
}

export interface ProcessResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly outputTruncated: boolean;
}

export interface ProcessRunnerLike {
  run(request: ProcessRequest): Promise<ProcessResult>;
}

const REDACTED = "[REDACTED]";

export function redactProcessOutput(value: string): string {
  try {
    return JSON.stringify(redactStructuredSecrets(JSON.parse(value) as unknown));
  } catch {
    return value
      .replace(/\bBearer\s+[^\s]+/gi, `Bearer ${REDACTED}`)
      .replace(
        /\b(password|passwd|secret|token|api[_-]?key|client[_-]?secret|connectionString|credential)\s*[:=]\s*([^\s,;]+)/gi,
        `$1=${REDACTED}`,
      )
      .replace(/((?:AccountKey|SharedAccessSignature|ClientSecret)\s*=)[^;\r\n]+/gi, `$1${REDACTED}`)
      .replace(/([?&](?:sig|token|key|secret)=)[^&\s]+/gi, `$1${REDACTED}`);
  }
}

export class ProcessRunner implements ProcessRunnerLike {
  async run(request: ProcessRequest): Promise<ProcessResult> {
    if (!Array.isArray(request.args)) {
      throw new TypeError("Process arguments must be an explicit array");
    }

    const options: SpawnOptionsWithoutStdio = {
      shell: false,
      windowsHide: true,
      ...(request.cwd === undefined ? {} : { cwd: request.cwd }),
      ...(request.env === undefined ? {} : { env: request.env }),
    };

    return await new Promise<ProcessResult>((resolve, reject) => {
      const child = spawn(request.executable, [...request.args], options);
      let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      let outputTruncated = false;
      let timedOut = false;

      const append = (current: Buffer<ArrayBufferLike>, chunk: Buffer<ArrayBufferLike>): Buffer<ArrayBufferLike> => {
        const remaining = request.maxOutputBytes - stdout.length - stderr.length;
        if (remaining <= 0) {
          outputTruncated = true;
          child.kill("SIGKILL");
          return current;
        }
        if (chunk.length > remaining) {
          outputTruncated = true;
          child.kill("SIGKILL");
          return Buffer.concat([current, chunk.subarray(0, remaining)]);
        }
        return Buffer.concat([current, chunk]);
      };

      child.stdout.on("data", (chunk: Buffer) => {
        stdout = append(stdout, chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = append(stderr, chunk);
      });

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, request.timeoutMs);

      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(new ProcessRunnerError("PROCESS_SPAWN_ERROR", error.message));
      });
      child.once("close", (exitCode, signal) => {
        clearTimeout(timeout);
        const result: ProcessResult = {
          exitCode,
          signal,
          stdout: redactProcessOutput(stdout.toString("utf8")),
          stderr: redactProcessOutput(stderr.toString("utf8")),
          timedOut,
          outputTruncated,
        };
        if (timedOut) {
          reject(new ProcessRunnerError("PROCESS_TIMEOUT", `Process '${request.executable}' timed out`, result));
        } else if (outputTruncated) {
          reject(
            new ProcessRunnerError(
              "PROCESS_OUTPUT_LIMIT",
              `Process '${request.executable}' exceeded its output limit`,
              result,
            ),
          );
        } else if (exitCode !== 0) {
          reject(
            new ProcessRunnerError(
              "PROCESS_EXIT_NONZERO",
              `Process '${request.executable}' exited with code ${String(exitCode)}`,
              result,
            ),
          );
        } else {
          resolve(result);
        }
      });
    });
  }
}
