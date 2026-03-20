# Payment Flows

Visual diagrams of every CyberSource payment flow supported by this SDK.

---

## 1. 3DS Frictionless Flow

When the card issuer determines that no additional authentication is needed,
the flow completes without user interaction. The enrollment check returns
`AUTHENTICATION_SUCCESSFUL` directly.

```mermaid
sequenceDiagram
    participant Usuario as Usuario (Browser)
    participant Frontend as Frontend (React)
    participant Backend as Backend (Node.js)
    participant CyberSource as CyberSource API
    participant Banco as Banco Emisor

    Usuario->>Frontend: Selecciona tarjeta y hace clic en "Pagar"
    Frontend->>Backend: POST /setup-service (paymentInstrumentId, cybersourceId)
    Backend->>CyberSource: payerAuthSetup (customer, device info)
    CyberSource-->>Backend: accessToken, deviceDataCollectionUrl, referenceId
    Backend-->>Frontend: Setup response

    Frontend->>Frontend: Carga iframe oculto con deviceDataCollectionUrl
    Note over Frontend: Device fingerprinting (datos del navegador)

    Frontend->>Backend: POST /check-enrollment (referenceId, amount, billingAddress)
    Backend->>CyberSource: checkPayerAuthEnrollment (consumer auth, order, device info)
    CyberSource->>Banco: Verificar enrolamiento 3DS
    Banco-->>CyberSource: Autenticado (frictionless) - sin challenge
    CyberSource-->>Backend: status: AUTHENTICATION_SUCCESSFUL, cavv, xid, eciRaw

    Note over Backend: Cache auth data (cavv, xid, eci) para fallback
    Backend-->>Frontend: Enrollment response (frictionless)

    Frontend->>Backend: POST /process-payment (amount, auth3DSResult, billTo)
    Note over Backend: Recupera campos 3DS del cache si faltan
    Backend->>CyberSource: createPayment (authorize + capture)
    CyberSource->>Banco: Autorizar pago con datos 3DS
    Banco-->>CyberSource: Aprobado
    CyberSource-->>Backend: status: AUTHORIZED, paymentId
    Backend-->>Frontend: Payment response
    Frontend->>Usuario: "Pago exitoso"
```

En el flujo frictionless, el banco emisor decide que la transaccion es de bajo riesgo
y no requiere verificacion adicional del usuario. Los datos de autenticacion (cavv, xid, eci)
se obtienen directamente del enrollment check.

---

## 2. 3DS Challenge Flow

When the bank requires additional verification, the user is presented with
a challenge (e.g., OTP, biometric) in an iframe. After completing the challenge,
the authentication result is validated before proceeding to payment.

```mermaid
sequenceDiagram
    participant Usuario as Usuario (Browser)
    participant Frontend as Frontend (React)
    participant Backend as Backend (Node.js)
    participant CyberSource as CyberSource API
    participant Banco as Banco Emisor

    Usuario->>Frontend: Selecciona tarjeta y hace clic en "Pagar"
    Frontend->>Backend: POST /setup-service
    Backend->>CyberSource: payerAuthSetup
    CyberSource-->>Backend: accessToken, deviceDataCollectionUrl, referenceId
    Backend-->>Frontend: Setup response

    Frontend->>Frontend: Device fingerprinting (iframe oculto)

    Frontend->>Backend: POST /check-enrollment (referenceId, amount, billingAddress, returnUrl)
    Backend->>CyberSource: checkPayerAuthEnrollment
    CyberSource->>Banco: Verificar enrolamiento 3DS
    Banco-->>CyberSource: Challenge requerido
    CyberSource-->>Backend: status: PENDING_AUTHENTICATION, stepUpUrl, accessToken (JWT)
    Backend-->>Frontend: Enrollment response (challenge required)

    Frontend->>Frontend: Abre ThreeDSModal (dialog + iframe)
    Frontend->>CyberSource: POST stepUpUrl con JWT (form submit a iframe)
    CyberSource->>Banco: Presentar challenge al usuario
    Banco-->>Usuario: Formulario de verificacion (OTP, biometrico, etc.)
    Usuario->>Banco: Completa el challenge
    Banco-->>CyberSource: Challenge completado
    CyberSource->>Backend: Redirect a returnUrl con resultado
    Backend->>CyberSource: validateAuthenticationResults (authenticationTransactionId)
    CyberSource-->>Backend: status: AUTHENTICATION_SUCCESSFUL, cavv, xid, eciRaw

    Note over Backend: Cache challenge auth data para fallback
    Backend-->>Frontend: HTML con postMessage (status, cavv, xid)
    Frontend->>Frontend: Recibe postMessage, cierra modal

    Frontend->>Backend: POST /process-payment (amount, auth3DSResult, billTo)
    Note over Backend: Recupera campos 3DS del cache si faltan
    Backend->>CyberSource: createPayment (authorize + capture)
    CyberSource->>Banco: Autorizar pago con datos 3DS
    Banco-->>CyberSource: Aprobado
    CyberSource-->>Backend: status: AUTHORIZED
    Backend-->>Frontend: Payment response
    Frontend->>Usuario: "Pago exitoso"
```

El flujo challenge se activa cuando el banco emisor detecta una transaccion de alto riesgo
o requiere verificacion adicional. El usuario debe completar un desafio (codigo OTP, biometria,
etc.) antes de que la autenticacion sea validada.

---

## 3. Tokenizacion de Tarjeta (2 pasos)

Card tokenization converts raw card data into reusable tokens stored in
CyberSource's Token Management Service (TMS). This is a 2-step process.

```mermaid
sequenceDiagram
    participant Usuario as Usuario
    participant Frontend as Frontend
    participant Backend as Backend
    participant CyberSource as CyberSource TMS

    Usuario->>Frontend: Ingresa datos de tarjeta (PAN, CVV, exp)
    Frontend->>Backend: POST /cards/tokenize (cardNumber, securityCode, exp, billTo)

    Note over Backend: Paso 1 - Crear Instrument Identifier
    Backend->>CyberSource: postInstrumentIdentifier (cardNumber, securityCode, type: "enrollable card")
    CyberSource-->>Backend: instrumentIdentifierId, truncatedNumber (xxxx1111)

    Note over Backend: Paso 2 - Crear Payment Instrument
    Backend->>CyberSource: postCustomerPaymentInstrument (instrumentIdentifierId, exp, billTo, customerId)
    CyberSource-->>Backend: paymentInstrumentId, state: ACTIVE

    Backend-->>Frontend: { paymentInstrumentId, last4, cardType }
    Frontend->>Usuario: "Tarjeta agregada exitosamente"

    Note over Backend: El paymentInstrumentId se almacena en la BD<br/>para usar en futuros pagos con 3DS
```

**Paso 1 (Instrument Identifier):** Tokeniza el numero de tarjeta y CVV. El token
resultante es un identificador reutilizable que representa la tarjeta sin almacenar
datos sensibles en tu servidor.

**Paso 2 (Payment Instrument):** Asocia el instrument identifier con un cliente de
CyberSource, datos de expiracion y direccion de facturacion. El payment instrument
resultante es lo que se usa para 3DS y pagos.

---

## 4. Flujo de Reembolso

Refunds can be processed for any previously captured payment.

```mermaid
sequenceDiagram
    participant Admin as Admin / Sistema
    participant Backend as Backend
    participant CyberSource as CyberSource API
    participant Banco as Banco Emisor

    Admin->>Backend: POST /payments/:id/refund (amount, currency, codeReference)
    Backend->>Backend: Validar paymentId existe
    Backend->>CyberSource: refundPayment (paymentId, amount, currency, codeReference)
    CyberSource->>Banco: Procesar reembolso
    Banco-->>CyberSource: Reembolso aprobado
    CyberSource-->>Backend: status: REFUNDED, refundId
    Backend-->>Admin: { status: "success", data: refundResponse }

    Note over Banco: El reembolso puede tardar 5-10 dias<br/>habiles en reflejarse en la cuenta del cliente
```

Los reembolsos parciales son posibles -- simplemente especifica un monto menor
al total original. Cada reembolso genera un nuevo transaction ID.

---

## 5. State Machine `useThreeDS`

The `useThreeDS` hook manages the 3DS flow as a finite state machine.
Each state transition is triggered by the completion of the corresponding
API call or user action.

```mermaid
stateDiagram-v2
    [*] --> idle

    idle --> setup : startAuth()
    setup --> fingerprint : Setup exitoso
    fingerprint --> enroll : Fingerprint completo
    enroll --> ready : Frictionless (AUTHENTICATION_SUCCESSFUL)
    enroll --> challenge : Challenge requerido (PENDING_AUTHENTICATION)
    challenge --> validate : completeChallenge()
    validate --> ready : Validacion exitosa
    ready --> done : Pago procesado

    setup --> error : Error en setup
    enroll --> error : Error en enrollment
    challenge --> error : Challenge fallido
    validate --> error : Validacion fallida

    error --> idle : reset()
    done --> idle : reset()
    ready --> idle : reset()

    note right of idle
        Estado inicial. Esperando que
        el usuario inicie el proceso.
    end note

    note right of setup
        Configurando autenticacion
        del pagador con CyberSource.
    end note

    note right of fingerprint
        Recopilando datos del dispositivo
        via iframe oculto.
    end note

    note right of enroll
        Verificando si la tarjeta
        esta enrolada en 3DS.
    end note

    note right of challenge
        Usuario completando challenge
        (OTP, biometrico) en iframe.
    end note

    note right of validate
        Validando resultado de la
        autenticacion con CyberSource.
    end note

    note right of ready
        Autenticacion exitosa.
        Listo para procesar pago.
    end note

    note right of done
        Pago procesado exitosamente.
    end note

    note right of error
        Error en alguno de los pasos.
        El usuario puede reiniciar.
    end note
```

### Transiciones del State Machine

| Estado actual | Evento | Siguiente estado | Descripcion |
|--------------|--------|-----------------|-------------|
| `idle` | `startAuth()` | `setup` | Inicia el flujo 3DS |
| `setup` | Setup exitoso | `fingerprint` | Setup completado, inicia fingerprinting |
| `fingerprint` | Fingerprint completo | `enroll` | Datos del dispositivo recopilados |
| `enroll` | `AUTHENTICATION_SUCCESSFUL` | `ready` | Frictionless -- sin challenge |
| `enroll` | `PENDING_AUTHENTICATION` | `challenge` | Challenge requerido |
| `challenge` | `completeChallenge()` | `validate` | Usuario completo el challenge |
| `validate` | Validacion exitosa | `ready` | Autenticacion validada |
| `ready` | Pago procesado | `done` | Flujo completo |
| cualquiera | Error | `error` | Error en cualquier paso |
| `error` / `done` | `reset()` | `idle` | Reiniciar el flujo |
