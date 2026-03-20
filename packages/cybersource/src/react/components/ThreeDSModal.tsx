/**
 * Unstyled 3DS challenge modal component.
 *
 * Uses a native `<dialog>` element to display the CyberSource 3DS challenge
 * iframe. Contains a hidden form that auto-submits the JWT to the challenge
 * URL, and listens for `postMessage` events from the CyberSource iframe to
 * detect when the user completes (or cancels) the challenge.
 *
 * **Unstyled by design** -- apply your own CSS via the `className` prop or
 * target the `[data-cybersource-modal]` attribute.
 *
 * @example
 * ```tsx
 * import { ThreeDSModal } from '@panama-payments/cybersource/react';
 *
 * function CheckoutPage() {
 *   const [showChallenge, setShowChallenge] = useState(false);
 *
 *   return (
 *     <>
 *       {showChallenge && (
 *         <ThreeDSModal
 *           challengeUrl="https://0merchantacsstag.cardinalcommerce.com/..."
 *           challengeJwt="eyJhbGciOiJIUzI1NiIs..."
 *           onComplete={(result) => {
 *             console.log('Challenge complete:', result.status);
 *             setShowChallenge(false);
 *           }}
 *           onCancel={() => setShowChallenge(false)}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Result data from the 3DS challenge completion.
 *
 * These values come from the `postMessage` sent by the CyberSource
 * callback page (which the backend renders after `validateToken`).
 *
 * @example
 * ```ts
 * const result: ThreeDSChallengeResult = {
 *   action: 'closeIframe',
 *   status: 'AUTHENTICATION_SUCCESSFUL',
 *   cavv: 'AAACBllleHchZTBWIGV4MAAAAAAA',
 *   xid: 'CAACCVVUlwCXUyhQNlSXAAAAAAA=',
 *   eciRaw: '05',
 *   directoryServerTransactionId: 'ds-txn-123',
 *   specificationVersion: '2.1.0',
 * };
 * ```
 */
export interface ThreeDSChallengeResult {
  /** Action from postMessage (expected: 'closeIframe') */
  action?: string;
  /** Authentication status */
  status: string;
  /** CAVV value */
  cavv?: string;
  /** XID value */
  xid?: string;
  /** Raw ECI value */
  eciRaw?: string;
  /** Directory Server Transaction ID */
  directoryServerTransactionId?: string;
  /** 3DS specification version */
  specificationVersion?: string;
}

/**
 * Props for the ThreeDSModal component.
 *
 * @example
 * ```tsx
 * <ThreeDSModal
 *   challengeUrl="https://..."
 *   challengeJwt="eyJ..."
 *   onComplete={(result) => console.log(result)}
 *   onCancel={() => console.log('Cancelled')}
 *   className="my-modal"
 *   iframeWidth={400}
 *   iframeHeight={600}
 * />
 * ```
 */
export interface ThreeDSModalProps {
  /** The challenge step-up URL (from enrollment response) */
  challengeUrl: string;
  /** The JWT / access token for the challenge (from enrollment response) */
  challengeJwt: string;
  /** Called when the challenge completes successfully (from postMessage) */
  onComplete: (result: ThreeDSChallengeResult) => void;
  /** Called when the user cancels the challenge (optional) */
  onCancel?: () => void;
  /** CSS class name for the dialog element */
  className?: string;
  /** Width of the challenge iframe in pixels (default: 400) */
  iframeWidth?: number;
  /** Height of the challenge iframe in pixels (default: 600) */
  iframeHeight?: number;
}

/**
 * Unstyled 3DS challenge modal using native `<dialog>`.
 *
 * Renders a modal dialog with a hidden form that auto-submits the JWT
 * to the CyberSource challenge URL in an iframe. Listens for `postMessage`
 * from the iframe to detect challenge completion.
 *
 * The consumer is responsible for all styling. The component exposes a
 * `[data-cybersource-modal]` attribute for CSS targeting.
 *
 * @param props - Modal configuration
 *
 * @example
 * ```tsx
 * import { ThreeDSModal } from '@panama-payments/cybersource/react';
 *
 * <ThreeDSModal
 *   challengeUrl={threeDS.challengeUrl!}
 *   challengeJwt={threeDS.challengeJwt!}
 *   onComplete={(result) => {
 *     if (result.status === 'AUTHENTICATION_SUCCESSFUL') {
 *       threeDS.completeChallenge(enrollmentData.consumerAuthenticationInformation.authenticationTransactionId);
 *     }
 *   }}
 *   onCancel={() => threeDS.reset()}
 *   className="cybersource-challenge-dialog"
 * />
 * ```
 */
export function ThreeDSModal({
  challengeUrl,
  challengeJwt,
  onComplete,
  onCancel,
  className,
  iframeWidth = 400,
  iframeHeight = 600,
}: ThreeDSModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const iframeName = 'cybersource-3ds-challenge';

  // Open dialog and submit form on mount
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    // Auto-submit the form to load the challenge in the iframe
    const timer = setTimeout(() => {
      formRef.current?.submit();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Listen for postMessage from the challenge iframe
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const data = event.data;

      // CyberSource sends { action: 'closeIframe', status, cavv, xid, ... }
      if (data && (data.action === 'closeIframe' || data.status)) {
        onComplete({
          action: data.action,
          status: data.status,
          cavv: data.cavv,
          xid: data.xid,
          eciRaw: data.eciRaw,
          directoryServerTransactionId: data.directoryServerTransactionId,
          specificationVersion: data.specificationVersion,
        });
      }
    },
    [onComplete],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Handle dialog close (ESC key or backdrop click)
  const handleClose = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  return (
    <dialog
      ref={dialogRef}
      className={className}
      data-cybersource-modal=""
      onClose={handleClose}
    >
      {/* Hidden form that auto-submits JWT to the challenge iframe */}
      <form
        ref={formRef}
        method="POST"
        action={challengeUrl}
        target={iframeName}
        style={{ display: 'none' }}
      >
        <input type="hidden" name="JWT" value={challengeJwt} />
      </form>

      {/* Challenge iframe */}
      <iframe
        name={iframeName}
        title="3D Secure Challenge"
        width={iframeWidth}
        height={iframeHeight}
        style={{ border: 'none' }}
      />

      {/* Cancel button -- unstyled, consumer customizes via CSS */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          data-cybersource-cancel=""
        >
          Cancel
        </button>
      )}
    </dialog>
  );
}
