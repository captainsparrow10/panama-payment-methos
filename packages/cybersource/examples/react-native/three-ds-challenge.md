# React Native 3DS Challenge

React Native does not support native `<dialog>` or `<iframe>` elements.
To handle the 3DS challenge flow in a mobile app, use a **WebView**.

## Approach

1. When `checkEnrollment` returns `PENDING_AUTHENTICATION`, open a
   React Native `WebView` that loads the `stepUpUrl` with the JWT.
2. Inject JavaScript to auto-submit the hidden form.
3. Listen for navigation changes or `onMessage` to detect completion.

## Example with `react-native-webview`

```tsx
import React, { useRef } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

interface ThreeDSChallengeProps {
  visible: boolean;
  challengeUrl: string;
  challengeJwt: string;
  onComplete: (result: { status: string; cavv?: string; xid?: string }) => void;
  onCancel: () => void;
}

export function ThreeDSChallenge({
  visible,
  challengeUrl,
  challengeJwt,
  onComplete,
  onCancel,
}: ThreeDSChallengeProps) {
  const webViewRef = useRef<WebView>(null);

  // HTML that auto-submits the JWT to the challenge URL
  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>3DS Challenge</title></head>
      <body>
        <form id="challengeForm" method="POST" action="${challengeUrl}">
          <input type="hidden" name="JWT" value="${challengeJwt}" />
        </form>
        <script>
          document.getElementById('challengeForm').submit();

          // Listen for the callback page that sends results via postMessage
          window.addEventListener('message', function(event) {
            window.ReactNativeWebView.postMessage(JSON.stringify(event.data));
          });
        </script>
      </body>
    </html>
  `;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'closeIframe' || data.status) {
        onComplete({
          status: data.status,
          cavv: data.cavv,
          xid: data.xid,
        });
      }
    } catch {
      // Not a JSON message, ignore
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ html }}
          originWhitelist={['*']}
          javaScriptEnabled
          onMessage={handleMessage}
          style={styles.webview}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
```

## Usage

```tsx
function CheckoutScreen() {
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeUrl, setChallengeUrl] = useState('');
  const [challengeJwt, setChallengeJwt] = useState('');

  // After checkEnrollment returns PENDING_AUTHENTICATION:
  const handleEnrollmentResult = (enrollment) => {
    if (enrollment.status === 'PENDING_AUTHENTICATION') {
      const auth = enrollment.consumerAuthenticationInformation;
      setChallengeUrl(auth.stepUpUrl || auth.acsUrl);
      setChallengeJwt(auth.accessToken);
      setShowChallenge(true);
    }
  };

  return (
    <ThreeDSChallenge
      visible={showChallenge}
      challengeUrl={challengeUrl}
      challengeJwt={challengeJwt}
      onComplete={(result) => {
        setShowChallenge(false);
        // Call validateAuthentication with the authenticationTransactionId
      }}
      onCancel={() => setShowChallenge(false)}
    />
  );
}
```

## Key Differences from Web

| Aspect | Web | React Native |
|--------|-----|-------------|
| Challenge container | `<dialog>` + `<iframe>` | `<Modal>` + `<WebView>` |
| Form submission | Auto-submit via `form.submit()` | Injected HTML with auto-submit |
| Challenge result | `window.postMessage` | `window.ReactNativeWebView.postMessage` |
| Callback detection | `window.addEventListener('message')` | `onMessage` prop on WebView |

## Backend Callback Page

The backend `validateToken` endpoint must return HTML that sends a `postMessage`
to the parent. For React Native, this works because the WebView listens for
messages via the injected `window.addEventListener('message')` script.

The existing backend callback page already does this:

```html
<script>
  window.parent.postMessage({
    action: "closeIframe",
    status: "AUTHENTICATION_SUCCESSFUL",
    cavv: "...",
    xid: "...",
    ...
  }, "*");
</script>
```
