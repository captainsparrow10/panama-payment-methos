# Database Model

Suggested database schema for storing Yappy payment orders. This is a reference implementation -- adapt it to your ORM and database.

## Yappy Orders Table

| Column | Type | Description | Required |
|--------|------|-------------|----------|
| `id` | UUID / Serial | Primary key | Yes |
| `orderId` | VARCHAR(15) | Yappy order ID (15-char alphanumeric, unique) | Yes |
| `transactionId` | VARCHAR(255) | Yappy transaction ID from API response | Yes |
| `customerId` | VARCHAR(255) | Your internal customer identifier | Yes |
| `aliasYappy` | VARCHAR(8) | Customer's Yappy phone number | No |
| `status` | ENUM | `'pending' \| 'paid' \| 'failed' \| 'cancelled' \| 'expired'` | Yes |
| `total` | DECIMAL(10,2) | Payment amount | Yes |
| `checkoutData` | JSONB | Serialized checkout/cart data for order creation | No |
| `orderData` | JSONB | Created order data (populated on payment success) | No |
| `errorMessage` | TEXT | Error description for failed/cancelled/expired | No |
| `expiresAt` | TIMESTAMP | When the Yappy order expires (createdAt + 5min) | Yes |
| `webhookReceivedAt` | TIMESTAMP | When the IPN webhook was received | No |
| `createdAt` | TIMESTAMP | Row creation timestamp | Yes |
| `updatedAt` | TIMESTAMP | Last update timestamp | Yes |

### Indexes

- `UNIQUE INDEX` on `orderId` (Yappy requires unique order IDs)
- `INDEX` on `customerId` (for customer order lookups)
- `INDEX` on `status` (for filtering pending orders)
- `INDEX` on `transactionId` (for webhook matching)

## SQL Migration

### PostgreSQL

```sql
CREATE TYPE yappy_order_status AS ENUM ('pending', 'paid', 'failed', 'cancelled', 'expired');

CREATE TABLE yappy_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id VARCHAR(15) NOT NULL UNIQUE,
  transaction_id VARCHAR(255) NOT NULL,
  customer_id VARCHAR(255) NOT NULL,
  alias_yappy VARCHAR(8),
  status yappy_order_status NOT NULL DEFAULT 'pending',
  total DECIMAL(10, 2) NOT NULL,
  checkout_data JSONB,
  order_data JSONB,
  error_message TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  webhook_received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_yappy_orders_customer ON yappy_orders(customer_id);
CREATE INDEX idx_yappy_orders_status ON yappy_orders(status);
CREATE INDEX idx_yappy_orders_transaction ON yappy_orders(transaction_id);
```

### Sequelize Model

```typescript
import { DataTypes, Model, Sequelize } from 'sequelize';

export class YappyOrder extends Model {
  declare id: string;
  declare orderId: string;
  declare transactionId: string;
  declare customerId: string;
  declare aliasYappy: string | null;
  declare status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';
  declare total: number;
  declare checkoutData: Record<string, unknown> | null;
  declare orderData: Record<string, unknown> | null;
  declare errorMessage: string | null;
  declare expiresAt: Date;
  declare webhookReceivedAt: Date | null;
}

export function initYappyOrder(sequelize: Sequelize) {
  YappyOrder.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      orderId: { type: DataTypes.STRING(15), allowNull: false, unique: true },
      transactionId: { type: DataTypes.STRING(255), allowNull: false },
      customerId: { type: DataTypes.STRING(255), allowNull: false },
      aliasYappy: { type: DataTypes.STRING(8), allowNull: true },
      status: {
        type: DataTypes.ENUM('pending', 'paid', 'failed', 'cancelled', 'expired'),
        allowNull: false,
        defaultValue: 'pending',
      },
      total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      checkoutData: { type: DataTypes.JSONB, allowNull: true },
      orderData: { type: DataTypes.JSONB, allowNull: true },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      webhookReceivedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'YappyOrder',
      tableName: 'yappy_orders',
      timestamps: true,
    },
  );

  return YappyOrder;
}
```

### Prisma Schema

```prisma
enum YappyOrderStatus {
  pending
  paid
  failed
  cancelled
  expired
}

model YappyOrder {
  id                String            @id @default(uuid())
  orderId           String            @unique @db.VarChar(15)
  transactionId     String            @db.VarChar(255)
  customerId        String            @db.VarChar(255)
  aliasYappy        String?           @db.VarChar(8)
  status            YappyOrderStatus  @default(pending)
  total             Decimal           @db.Decimal(10, 2)
  checkoutData      Json?
  orderData         Json?
  errorMessage      String?
  expiresAt         DateTime
  webhookReceivedAt DateTime?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([customerId])
  @@index([status])
  @@index([transactionId])
  @@map("yappy_orders")
}
```

## Lifecycle

1. **Checkout initiated**: Create row with `status: 'pending'`, `expiresAt: now + 5min`
2. **Webhook received (status=E)**: Update `status: 'paid'`, store `orderData`, set `webhookReceivedAt`
3. **Webhook received (status=R/C/X)**: Update `status` accordingly, store `errorMessage`
4. **Polling timeout**: If `expiresAt` has passed and no webhook received, update `status: 'expired'`
5. **User cancellation**: Update `status: 'cancelled'`

## Cleanup

Consider a cron job to clean up stale pending orders:

```sql
-- Mark expired pending orders (run every minute)
UPDATE yappy_orders
SET status = 'expired', error_message = 'Expirado automaticamente'
WHERE status = 'pending' AND expires_at < NOW();
```
