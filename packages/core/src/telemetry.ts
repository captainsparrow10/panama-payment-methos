/**
 * Lightweight wrapper for OpenTelemetry tracing.
 *
 * If `@opentelemetry/api` is installed, creates real spans.
 * If not installed, returns a no-op span (never fails).
 *
 * This keeps OpenTelemetry as a truly optional dependency --
 * no runtime errors if the peer dependency is not installed.
 */

/**
 * Minimal span interface matching OpenTelemetry's Span.
 *
 * This is intentionally a subset of the full OpenTelemetry Span interface,
 * providing only the methods needed for payment instrumentation.
 *
 * @example
 * ```ts
 * const span: PaymentSpan = createSpan('cmf.processPayment');
 * span.setAttribute('orderId', 'ORD-123');
 * span.end();
 * ```
 */
export interface PaymentSpan {
  /** End the span (records duration) */
  end(): void;
  /** Record an error on the span */
  setError(error: Error): void;
  /** Set a key-value attribute on the span */
  setAttribute(key: string, value: string | number | boolean): void;
}

/** @internal No-op span used when OpenTelemetry is not available */
const noopSpan: PaymentSpan = {
  end() {},
  setError() {},
  setAttribute() {},
};

/**
 * Creates an OpenTelemetry span if the API is available.
 *
 * If `@opentelemetry/api` is not installed, returns a no-op span that
 * silently discards all calls. This makes tracing truly opt-in with
 * zero overhead when disabled.
 *
 * @param name - Span name (e.g., 'cmf.processPayment', 'yappy.createOrder')
 * @param attributes - Initial span attributes
 * @returns A span object (real or no-op)
 *
 * @example
 * ```ts
 * const span = createSpan('cybersource.processPayment', { amount: '50.00' });
 * try {
 *   const result = await client.processPayment(data);
 *   span.setAttribute('status', result.status);
 *   return result;
 * } catch (error) {
 *   span.setError(error);
 *   throw error;
 * } finally {
 *   span.end();
 * }
 * ```
 */
export function createSpan(
  name: string,
  attributes?: Record<string, string | number | boolean>,
): PaymentSpan {
  try {
    // Dynamic import to avoid hard dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = require('@opentelemetry/api');
    const tracer = api.trace.getTracer('panama-payments');
    const span = tracer.startSpan(name);

    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
    }

    return {
      end: () => span.end(),
      setError: (error: Error) => {
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);
      },
      setAttribute: (key: string, value: string | number | boolean) =>
        span.setAttribute(key, value),
    };
  } catch {
    // @opentelemetry/api not installed — return no-op
    return noopSpan;
  }
}
