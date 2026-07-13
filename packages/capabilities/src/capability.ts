import type { TaskEnvelopeV1 } from "@apex/contracts";

export type CapabilitySideEffect = "none" | "local" | "remote";
export type CapabilityIdempotency = "none" | "supported" | "required";

export interface CapabilityContext {
  readonly envelope: TaskEnvelopeV1;
  readonly attempt: number;
  readonly signal: AbortSignal;
}

export interface Capability<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  readonly sideEffect: CapabilitySideEffect;
  readonly requiredRole: string;
  readonly timeoutMs: number;
  readonly retries: number;
  readonly idempotency: CapabilityIdempotency;
  execute(context: CapabilityContext, input: TInput): Promise<TOutput>;
  reconcile?(context: CapabilityContext, input: TInput): Promise<TOutput>;
}

export type CapabilityErrorCode =
  | "CAPABILITY_DUPLICATE"
  | "CAPABILITY_EXPIRED"
  | "CAPABILITY_GRANT_DENIED"
  | "CAPABILITY_OUTPUT_LIMIT"
  | "CAPABILITY_ROLE_DENIED"
  | "CAPABILITY_SIDE_EFFECT_DENIED"
  | "CAPABILITY_TIMEOUT"
  | "CAPABILITY_UNKNOWN";

export class CapabilityError extends Error {
  constructor(
    public readonly code: CapabilityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CapabilityError";
  }
}

export interface CapabilityRegistryOptions {
  readonly now?: () => Date;
  readonly measureOutputBytes?: (output: unknown) => number;
}

export class CapabilityRegistry {
  readonly #capabilities = new Map<string, Capability>();
  readonly #now: () => Date;
  readonly #measureOutputBytes: (output: unknown) => number;

  constructor(options: CapabilityRegistryOptions = {}) {
    this.#now = options.now ?? (() => new Date());
    this.#measureOutputBytes =
      options.measureOutputBytes ?? ((output) => Buffer.byteLength(JSON.stringify(output), "utf8"));
  }

  register<TInput, TOutput>(capability: Capability<TInput, TOutput>): void {
    if (this.#capabilities.has(capability.id)) {
      throw new CapabilityError("CAPABILITY_DUPLICATE", `Capability '${capability.id}' is already registered`);
    }
    this.#capabilities.set(capability.id, capability as Capability);
  }

  async execute<TOutput>(id: string, envelope: TaskEnvelopeV1, input: unknown): Promise<TOutput> {
    const capability = this.#authorize(id, envelope);
    let lastError: unknown;

    for (let attempt = 1; attempt <= capability.retries + 1; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), capability.timeoutMs);
      try {
        const output = await Promise.race([
          capability.execute({ envelope, attempt, signal: controller.signal }, input),
          new Promise<never>((_resolve, reject) => {
            controller.signal.addEventListener(
              "abort",
              () => reject(new CapabilityError("CAPABILITY_TIMEOUT", `Capability '${id}' timed out`)),
              { once: true },
            );
          }),
        ]);
        const bytes = this.#measureOutputBytes(output);
        if (bytes > envelope.maxOutputBytes) {
          throw new CapabilityError(
            "CAPABILITY_OUTPUT_LIMIT",
            `Capability '${id}' produced ${bytes} bytes; budget is ${envelope.maxOutputBytes}`,
          );
        }
        return output as TOutput;
      } catch (error) {
        lastError = error;
        if (error instanceof CapabilityError || attempt > capability.retries) {
          throw error;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError;
  }

  #authorize(id: string, envelope: TaskEnvelopeV1): Capability {
    const capability = this.#capabilities.get(id);
    if (capability === undefined) {
      throw new CapabilityError("CAPABILITY_UNKNOWN", `Capability '${id}' is not registered`);
    }
    const now = this.#now().getTime();
    if (new Date(envelope.expiresAt).getTime() <= now) {
      throw new CapabilityError("CAPABILITY_EXPIRED", `Task '${envelope.taskId}' has expired`);
    }
    if (envelope.role !== capability.requiredRole) {
      throw new CapabilityError("CAPABILITY_ROLE_DENIED", `Role '${envelope.role}' cannot execute capability '${id}'`);
    }
    const grant = envelope.capabilityGrants.find((candidate) => candidate.capability === id);
    if (grant === undefined) {
      throw new CapabilityError("CAPABILITY_GRANT_DENIED", `No grant exists for capability '${id}'`);
    }
    if (new Date(grant.expiresAt).getTime() <= now) {
      throw new CapabilityError("CAPABILITY_EXPIRED", `Grant for capability '${id}' has expired`);
    }
    if (grant.sideEffect !== capability.sideEffect) {
      throw new CapabilityError(
        "CAPABILITY_SIDE_EFFECT_DENIED",
        `Grant side effect '${grant.sideEffect}' does not match '${capability.sideEffect}'`,
      );
    }
    return capability;
  }
}
