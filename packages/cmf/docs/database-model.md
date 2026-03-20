# Database Model

This document describes the recommended database schema for storing CMF-related data in your application.

## CMFInfo Table

Stores the association between your application's customer and their CMF account. This avoids requiring the customer to re-enter their CMF credentials on every purchase.

### Schema

```sql
CREATE TABLE cmf_info (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL UNIQUE,           -- FK to your customers table
    cmf_customer_id VARCHAR(255) NOT NULL,           -- CMF internal UUID
    email           VARCHAR(255),                     -- CMF-registered email
    phone           VARCHAR(50),                      -- CMF-registered phone
    customer_product_id VARCHAR(255),                 -- Last used product UUID
    account_number  VARCHAR(500),                     -- Encrypted account number
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_customer FOREIGN KEY (customer_id)
        REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_cmf_info_customer_id ON cmf_info(customer_id);
CREATE INDEX idx_cmf_info_cmf_customer_id ON cmf_info(cmf_customer_id);
```

### Sequelize Model

```ts
import { DataTypes, Model, Sequelize } from 'sequelize';

export class CMFInfoModel extends Model {
  declare id: string;
  declare customerId: string;
  declare cmfCustomerId: string;
  declare email: string | null;
  declare phone: string | null;
  declare customerProductId: string | null;
  declare accountNumber: string | null;
}

export function initCMFInfo(sequelize: Sequelize) {
  CMFInfoModel.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      customerId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        field: 'customer_id',
      },
      cmfCustomerId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'cmf_customer_id',
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      customerProductId: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'customer_product_id',
      },
      accountNumber: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'account_number',
      },
    },
    {
      sequelize,
      tableName: 'cmf_info',
      timestamps: true,
      underscored: true,
    },
  );

  return CMFInfoModel;
}
```

## CMF Transaction Log (Recommended)

For audit and reconciliation purposes, log every CMF transaction:

```sql
CREATE TABLE cmf_transactions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id       UUID NOT NULL,
    order_id          VARCHAR(255) NOT NULL,
    receipt_number    VARCHAR(50) NOT NULL UNIQUE,
    transaction_type  VARCHAR(20) NOT NULL CHECK (transaction_type IN ('quota', 'normal')),
    amount            DECIMAL(10,2) NOT NULL,
    cmf_unique_code   VARCHAR(255),              -- CMF transaction code
    plan_term         INTEGER,                   -- Loan term (null for normal)
    monthly_quota     DECIMAL(10,2),             -- Monthly amount (null for normal)
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',
    cmf_response      JSONB,                     -- Full CMF API response
    verified          BOOLEAN DEFAULT FALSE,
    verified_at       TIMESTAMP,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cmf_txn_customer FOREIGN KEY (customer_id)
        REFERENCES customers(id)
);

CREATE INDEX idx_cmf_txn_receipt ON cmf_transactions(receipt_number);
CREATE INDEX idx_cmf_txn_customer ON cmf_transactions(customer_id);
CREATE INDEX idx_cmf_txn_order ON cmf_transactions(order_id);
```

## Recommended Flow

1. **On OTP verification**: upsert `cmf_info` with the customer's CMF account details
2. **On payment processing**: insert into `cmf_transactions` with status `pending`
3. **On payment success**: update `cmf_transactions` status to `completed`, store `cmf_response`
4. **On payment failure**: update `cmf_transactions` status to `failed`
5. **On verification**: set `verified = true` and `verified_at`
