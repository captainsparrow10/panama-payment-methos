/**
 * Utility for wrapping `cybersource-rest-client` callback-based API calls
 * into Promise-based functions.
 *
 * The `cybersource-rest-client` SDK uses a Node.js callback pattern:
 * ```
 * instance.someMethod(requestObj, opts, (error, data, response) => { ... })
 * ```
 *
 * This module provides a generic wrapper that converts this pattern into
 * a standard `Promise` that resolves with `{ status, text, data }` or
 * rejects with a `CyberSourceError`.
 *
 * @example
 * ```ts
 * import { promisifySdkCall } from './promisify.js';
 *
 * const result = await promisifySdkCall<InstrumentIdentifierResponse>(
 *   (callback) => instance.postInstrumentIdentifier(requestObj, opts, callback),
 * );
 * console.log(result.data.id);
 * ```
 */

import { CyberSourceError } from '../errors.js';
import type { CyberSourceSDKResponse } from '../types.js';

/**
 * Callback signature used by `cybersource-rest-client` SDK methods.
 *
 * @example
 * ```ts
 * const callback: SdkCallback<MyData> = (error, data, response) => { ... };
 * ```
 */
export type SdkCallback<T> = (
  error: Error | null,
  data: T,
  response: CyberSourceSDKResponse,
) => void;

/**
 * Result shape returned by `promisifySdkCall`.
 *
 * @example
 * ```ts
 * const result: SdkResult<InstrumentIdentifierResponse> = {
 *   status: '201',
 *   text: 'Created',
 *   data: { id: 'II_xyz', ... },
 * };
 * ```
 */
export interface SdkResult<T> {
  /** HTTP status code as string */
  status: string;
  /** Status message */
  text: string;
  /** Parsed response data */
  data: T;
}

/**
 * Wraps a `cybersource-rest-client` callback-based SDK call in a `Promise`.
 *
 * The caller passes a function that receives a callback and invokes the
 * underlying SDK method with it. The wrapper resolves or rejects the
 * returned Promise based on the callback arguments.
 *
 * @param executor - A function that receives a callback and invokes the SDK method
 * @returns A promise that resolves with the parsed API response
 * @throws {CyberSourceError} When the SDK returns an error or no data
 *
 * @example
 * ```ts
 * import cybersourceRestApi from 'cybersource-rest-client';
 * import { promisifySdkCall } from './promisify.js';
 *
 * const configObject = new Configuration();
 * const apiClient = new cybersourceRestApi.ApiClient();
 * const instance = new cybersourceRestApi.InstrumentIdentifierApi(configObject, apiClient);
 *
 * const result = await promisifySdkCall<InstrumentIdentifierResponse>((cb) =>
 *   instance.postInstrumentIdentifier(requestObj, opts, cb),
 * );
 *
 * console.log(result.data.id);
 * ```
 */
export function promisifySdkCall<T>(
  executor: (callback: SdkCallback<T>) => void,
): Promise<SdkResult<T>> {
  return new Promise<SdkResult<T>>((resolve, reject) => {
    executor((error: Error | null, data: T, response: CyberSourceSDKResponse) => {
      const status = response?.status || 'UNKNOWN_ERROR';
      const text =
        (response as unknown as Record<string, unknown>)?.statusMessage as string ??
        response?.text ??
        'Unknown response';

      if (error) {
        reject(
          new CyberSourceError(
            error.message || 'CyberSource SDK call failed',
            undefined,
            status,
            false,
            Number(status) || undefined,
          ),
        );
        return;
      }

      if (data) {
        resolve({ status, text, data });
        return;
      }

      reject(
        new CyberSourceError(
          'No data received from CyberSource',
          undefined,
          status,
          false,
        ),
      );
    });
  });
}
