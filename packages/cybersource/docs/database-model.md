# Database Model

Recommended database schema for storing CyberSource-related data in your application.

## Overview

The SDK itself does not persist data -- it is stateless. Your application must store
customer and payment instrument IDs returned by CyberSource to use them in future
payment flows.

## Tables

### `customers`

Your existing customer table needs a `cybersource_id` column.

```sql
ALTER TABLE customers
  ADD COLUMN cybersource_id VARCHAR(255) UNIQUE;
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Your internal customer ID |
| `email` | VARCHAR | Customer email |
| `cybersource_id` | VARCHAR | CyberSource TMS customer ID (returned by `createCustomer`) |
| `created_at` | TIMESTAMP | When the customer was created |

### `payment_instruments`

Stores tokenized card references. **Never store raw card data.**

```sql
CREATE TABLE payment_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  cybersource_payment_instrument_id VARCHAR(255) NOT NULL UNIQUE,
  cybersource_instrument_identifier_id VARCHAR(255) NOT NULL,
  card_type VARCHAR(10) NOT NULL,        -- '001' (Visa), '002' (MC), etc.
  last_four VARCHAR(4) NOT NULL,         -- Last 4 digits from truncated number
  expiration_month VARCHAR(2) NOT NULL,  -- 'MM'
  expiration_year VARCHAR(4) NOT NULL,   -- 'YYYY'
  card_name VARCHAR(255),               -- User-defined label (e.g., "Mi Visa")
  theme INTEGER DEFAULT 0,             -- UI theme/color ID
  is_default BOOLEAN DEFAULT false,
  state VARCHAR(20) DEFAULT 'ACTIVE',  -- 'ACTIVE', 'CLOSED'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payment_instruments_customer ON payment_instruments(customer_id);
```

| Column | Type | Description |
|--------|------|-------------|
| `cybersource_payment_instrument_id` | VARCHAR | Token ID from `createPaymentInstrument` |
| `cybersource_instrument_identifier_id` | VARCHAR | Token ID from `createInstrumentIdentifier` |
| `card_type` | VARCHAR | CyberSource card type code |
| `last_four` | VARCHAR | Last 4 digits (from `card.number`) |
| `expiration_month` | VARCHAR | Card expiration month |
| `expiration_year` | VARCHAR | Card expiration year |

### `payment_transactions`

Stores payment transaction history.

```sql
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  payment_instrument_id UUID REFERENCES payment_instruments(id),
  cybersource_transaction_id VARCHAR(255) UNIQUE,
  type VARCHAR(20) NOT NULL,           -- 'payment', 'refund', 'void'
  status VARCHAR(30) NOT NULL,         -- 'AUTHORIZED', 'DECLINED', 'VOIDED', 'REFUNDED'
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  processor_approval_code VARCHAR(20),
  processor_response_code VARCHAR(20),
  error_reason VARCHAR(255),
  error_message TEXT,
  source VARCHAR(10) DEFAULT 'web',    -- 'web' or 'app'
  reference_code VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_order ON payment_transactions(order_id);
CREATE INDEX idx_transactions_customer ON payment_transactions(customer_id);
CREATE INDEX idx_transactions_cybersource ON payment_transactions(cybersource_transaction_id);
```

## Sequelize Models (Example)

### PaymentInstrument Model

```ts
import { DataTypes, Model, Sequelize } from 'sequelize';

export class PaymentInstrumentClass extends Model {
  declare id: string;
  declare customerId: string;
  declare cybersourcePaymentInstrumentId: string;
  declare cybersourceInstrumentIdentifierId: string;
  declare cardType: string;
  declare lastFour: string;
  declare expirationMonth: string;
  declare expirationYear: string;
  declare cardName: string | null;
  declare isDefault: boolean;
  declare state: string;
}

export function initPaymentInstrument(sequelize: Sequelize) {
  PaymentInstrumentClass.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      customerId: { type: DataTypes.UUID, allowNull: false },
      cybersourcePaymentInstrumentId: { type: DataTypes.STRING, allowNull: false, unique: true },
      cybersourceInstrumentIdentifierId: { type: DataTypes.STRING, allowNull: false },
      cardType: { type: DataTypes.STRING(10), allowNull: false },
      lastFour: { type: DataTypes.STRING(4), allowNull: false },
      expirationMonth: { type: DataTypes.STRING(2), allowNull: false },
      expirationYear: { type: DataTypes.STRING(4), allowNull: false },
      cardName: { type: DataTypes.STRING },
      isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
      state: { type: DataTypes.STRING(20), defaultValue: 'ACTIVE' },
    },
    { sequelize, modelName: 'PaymentInstrument', tableName: 'payment_instruments' },
  );
  return PaymentInstrumentClass;
}
```

## Data Flow

```
User enters card data
        |
        v
createInstrumentIdentifier()  ->  Store: instrument_identifier_id, last_four
        |
        v
createPaymentInstrument()     ->  Store: payment_instrument_id, card_type, exp
        |
        v
setupAuthentication()         ->  No storage needed
        |
        v
checkEnrollment()             ->  No storage needed (cached server-side)
        |
        v
processPayment()              ->  Store: transaction_id, status, amount
```

## What NOT to Store

- Raw card numbers (PAN)
- Security codes (CVV/CVC)
- Full 3DS authentication data (cavv, xid) -- these are single-use
- CyberSource API keys or shared secrets
