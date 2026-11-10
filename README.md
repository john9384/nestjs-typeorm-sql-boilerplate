# NestJS TypeORM SQL Boilerplate

A modular NestJS backend template with PostgreSQL, TypeORM, JWT authentication, event-driven notifications, provider-based payments, and Swagger documentation.

## 🚀 Features

- **🏗️ Feature Modules** - Services own workflows; adapters isolate external providers; contracts define integration boundaries
- **🗄️ PostgreSQL & TypeORM** - Robust relational database with migrations support
- **🔐 JWT Authentication** - Secure token-based authentication with Passport.js
- **📚 Swagger Documentation** - Interactive API documentation with Swagger UI
- **🛡️ Global Guards & Interceptors** - Standardized response format and error handling
- **✅ Request Validation** - Automatic validation with class-validator
- **🐳 Docker Support** - Complete containerization with docker-compose
- **🔄 Base Repository Pattern** - Reusable repository base class for all entities
- **📦 Modular Design** - Feature-based module organization
- **🔧 TypeScript** - Typed contracts and validated configuration
- **🔔 Notifications** - SMTP email, Termii SMS, and a persistent in-app inbox via events
- **💳 Payments** - Replaceable provider adapters, Paystack checkout and verification, authenticated webhooks

## 📋 Prerequisites

- **Node.js** v22 or higher
- **PostgreSQL** 15 or higher
- **npm** or **yarn**
- **Docker & Docker Compose** (optional, for containerized deployment)

## 🏗️ Project Structure

```text
src/
├── common/                         # Decorators, guards, filters, pagination, provider HTTP client
├── config/                         # Namespaced configuration and environment validation
│   └── database-options.ts         # Shared runtime/CLI database options
├── database/
│   ├── entities/                   # Shared User, AuthToken, and BaseEntity
│   ├── migrations/                 # Initial schema and feature migrations
│   ├── data-source.ts              # Compiled production migration entry point
│   ├── base.repository.ts
│   └── typeorm.module.ts
├── modules/
│   ├── auth/
│   ├── user/
│   ├── events/                     # Global Nest event emitter registration
│   ├── jobs/                       # Extension point for future workers
│   ├── notifications/
│   │   ├── adapters/               # SMTP, Termii, and in-app implementations
│   │   ├── dto/                    # Validation for event payloads
│   │   ├── entities/               # Persistent inbox entity
│   │   ├── notification.contract.ts
│   │   ├── notifications.listener.ts
│   │   ├── notifications.service.ts
│   │   ├── notifications.controller.ts
│   │   └── notifications.module.ts
│   └── payments/
│       ├── adapters/               # Paystack; add other providers here
│       ├── dto/
│       ├── entities/
│       ├── payment.contract.ts
│       ├── payments.service.ts
│       ├── payments.controller.ts
│       └── payments.module.ts
├── types/
├── app.module.ts
└── main.ts
test/                               # PostgreSQL integration tests
scripts/                            # Migration helpers and existing-schema baselining
```

## 🚀 Quick Start

### Option 1: Local Development

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd nestjs-typorm-sql-boilerplate
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp env.example .env
   ```

   Edit `.env` with your configuration:

   ```env
   NODE_ENV=development
   PORT=3000

   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=nest_sql_template

   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   JWT_EXPIRES_IN=1d
   ```

4. **Start PostgreSQL**

   ```bash
   # macOS
   brew services start postgresql

   # Ubuntu/Debian
   sudo systemctl start postgresql

   # Windows
   # Start PostgreSQL service from Services
   ```

5. **Run database migrations**

   ```bash
   npm run migration:run
   ```

6. **Start the application**

   ```bash
   # Development mode (with hot reload)
   npm run start:dev

   # Production mode
   npm run build
   npm run start:prod
   ```

7. **Access the application**
   - API: http://localhost:3000
   - Swagger Documentation: http://localhost:3000/docs
   - Health Check: http://localhost:3000/health

### Option 2: Docker Development

1. **Clone and setup**

   ```bash
   git clone <repository-url>
   cd nestjs-typorm-sql-boilerplate
   cp env.example .env
   ```

2. **Start with Docker Compose**

   ```bash
   # Development environment
   npm run docker:compose:dev

   # Production environment
   npm run docker:compose
   ```

3. **View logs**

   ```bash
   npm run docker:compose:logs
   ```

4. **Stop services**
   ```bash
   npm run docker:compose:down
   ```

## 📝 Environment Variables

| Variable            | Description              | Default       | Required |
| ------------------- | ------------------------ | ------------- | -------- |
| `NODE_ENV`          | Application environment  | `development` | No       |
| `PORT`              | Application port         | `3000`        | No       |
| `POSTGRES_HOST`     | PostgreSQL host          | `localhost`   | Yes      |
| `POSTGRES_PORT`     | PostgreSQL port          | `5432`        | No       |
| `POSTGRES_USER`     | PostgreSQL username      | -             | Yes      |
| `POSTGRES_PASSWORD` | PostgreSQL password      | -             | Yes      |
| `POSTGRES_DB`       | PostgreSQL database name | -             | Yes      |
| `JWT_SECRET`        | JWT signing secret       | -             | Yes      |
| `JWT_EXPIRES_IN`    | JWT expiration time      | `1d`          | No       |

**Note:** For Docker, set `POSTGRES_HOST=postgres` (service name) instead of `localhost`.

## Notifications

`EventsModule` registers one global event bus and `NotificationsModule` subscribes to `notification.send`. Any current or future Nest service can inject `EventEmitter2` and emit the shared contract without importing notification providers:

```ts
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NOTIFICATION_SEND,
  NotificationChannel,
  type NotificationRequest,
  type NotificationDelivery,
} from './modules/notifications'; // adjust to your service's location

// Inject EventEmitter2 in your service's constructor.
const payload: NotificationRequest = {
  channels: [
    NotificationChannel.EMAIL,
    NotificationChannel.SMS,
    NotificationChannel.IN_APP,
  ],
  recipient: {
    userId: user.id, // required for in_app; existing users only
    email: user.email, // required for email
    phone: '+2348012345678', // required for sms; international format
  },
  title: 'Order confirmed', // email subject and inbox title
  body: 'Your order has been confirmed.', // email text, SMS text, inbox body
  html: '<p>Your order has been confirmed.</p>', // optional email HTML
  data: { orderId: order.id }, // optional inbox metadata
};
const [deliveries] = (await this.events.emitAsync(
  NOTIFICATION_SEND,
  payload,
)) as NotificationDelivery[][];
// [{ channel: 'email', status: 'sent', messageId: '...' }, ...]
```

Use `emitAsync` and inspect each delivery result. All payloads are validated, including internal events; invalid payloads reject before delivery. Each channel is attempted independently, and provider failures return `status: 'failed'` with a sanitized error. `sent` means accepted by SMTP/Termii or stored in the inbox; it does not confirm delivery to the recipient's device. HTML is trusted application content: escape user input when rendering templates.

Enable email with `SMTP_ENABLED=true`, `SMTP_HOST`, and `SMTP_FROM` (an email address). Set `SMTP_USER` and `SMTP_PASSWORD` for authenticated relays. Use `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=true` for STARTTLS; use port 465 and `SMTP_SECURE=true` for implicit TLS. Local mail capture tools can use `SMTP_REQUIRE_TLS=false`.

Enable SMS with `TERMII_ENABLED=true`, `TERMII_API_KEY`, `TERMII_SENDER_ID`, and your account's `TERMII_BASE_URL` (origin only). `TERMII_CHANNEL=dnd` is the default transactional route; activate it in your Termii account. Use `generic` for promotional messages. See the [Termii messaging API](https://developers.termii.com/messaging-api) and [Nodemailer SMTP options](https://nodemailer.com/smtp).

The inbox is available to authenticated users:

| Method | Endpoint                         | Behavior                                                                   |
| ------ | -------------------------------- | -------------------------------------------------------------------------- |
| GET    | `/notifications?page=1&limit=20` | Current user's inbox, newest first; maximum 100 per page                   |
| PATCH  | `/notifications/:id/read`        | Mark own notification read; repeated calls preserve the original read time |

The inbox persists in PostgreSQL and can be polled by clients. To add a channel, implement `NotificationAdapter`, extend `NotificationChannel` and recipient validation, then register it under `NOTIFICATION_ADAPTERS` in `NotificationsModule`.

## Payments

Import `PaymentsModule` into a business module and inject `PaymentsService`. The service resolves a provider through `PaymentAdapter`; business logic uses the normalized contract rather than Paystack's API shapes.

```ts
// In an order/billing service that imports PaymentsModule:
const payment = await this.payments.initialize({
  userId: user.id,
  email: user.email,
  amount: order.totalInKobo, // compute this in trusted backend business logic
  currency: 'NGN',
  metadata: { orderId: order.id },
});
// Persist payment.reference with the order and return payment.authorizationUrl to the client.
```

Amounts are positive safe integers in currency subunits: `10000` means NGN 100.00. Stored `amount` values are PostgreSQL bigint strings. There is deliberately no public endpoint accepting a client-supplied price: connect initialization to your order, invoice, or billing workflow.

Configure `PAYSTACK_SECRET_KEY` with a test/live secret, `PAYMENT_PROVIDER=paystack`, and `PAYMENT_CURRENCY=NGN`. `PAYSTACK_CALLBACK_URL` optionally sets the frontend return URL. A callback redirect is not proof of payment. Configure Paystack's dashboard webhook URL as `https://your-api.example.com/payments/webhooks/paystack`.

| Method | Endpoint                       | Behavior                                                       |
| ------ | ------------------------------ | -------------------------------------------------------------- |
| GET    | `/payments/:reference/verify`  | JWT required; verifies only the current user's stored payment  |
| POST   | `/payments/webhooks/:provider` | Public provider callback authenticated by the selected adapter |

Webhook verification uses the original request bytes. Set `PAYSTACK_WEBHOOK_SECRET=whsec_...` for timestamped `Paystack-Signature` verification with a five-minute tolerance and rotation entries. When it is empty, legacy `x-paystack-signature` is verified with `PAYSTACK_SECRET_KEY`. Configuring a signing secret disables legacy fallback. See [Paystack webhooks](https://paystack.com/docs/payments/webhooks/) and the [transaction API](https://paystack.com/docs/api/transaction/).

Successful charges are rechecked through the provider API. Reference, amount, and currency must match the stored intent before changing payment state. A database row lock serializes concurrent verification and webhooks; a successful payment cannot be downgraded, and duplicate callbacks do not emit another success event. Authenticated events for unrelated transactions or unsupported event types are acknowledged and ignored. Timeouts leave payment intents pending because the provider may have accepted the request; reconcile before starting another checkout.

To react to a verified payment, register a listener in your business module:

```ts
import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  PAYMENT_SUCCEEDED,
  type PaymentSucceededEvent,
} from './modules/payments';
import {
  NOTIFICATION_SEND,
  NotificationChannel,
} from './modules/notifications';

@Injectable()
export class PaymentReceiptListener {
  constructor(private readonly events: EventEmitter2) {}

  @OnEvent(PAYMENT_SUCCEEDED, { suppressErrors: false })
  async handlePayment(event: PaymentSucceededEvent) {
    // Register this class in your module's providers.
    return this.events.emitAsync(NOTIFICATION_SEND, {
      channels: [NotificationChannel.IN_APP],
      recipient: { userId: event.userId },
      title: 'Payment received',
      body: `Payment ${event.reference} was confirmed.`,
      data: { paymentId: event.id },
    });
  }
}
```

To add a provider, implement `PaymentAdapter` (`initialize`, `verify`, `parseWebhook`) and register it in the `PAYMENT_ADAPTERS` factory in `PaymentsModule`. Select it using `PAYMENT_PROVIDER` or the internal `initialize({ provider: 'your-provider', ... })` option. Existing payments retain their original provider for verification. Add that provider's configuration and validation alongside the adapter. The module currently handles checkout and verification; refunds, recurring billing, and settlement reconciliation are separate business workflows.

### Event delivery boundaries

The event bus runs within one Nest application process. Emit after application bootstrap, when listeners have registered. Events are not durable, automatically retried, or transported between separately deployed services. A broker consumer can translate external events into `notification.send` using the same contract. For durable delivery, add a queue/outbox and idempotent consumers. `payment.succeeded` runs after database commit; listener failures are logged, and a crash between commit and emission requires reconciliation. Keep financial fulfillment in a durable workflow when extending this template.

## 🔐 Authentication

The application uses JWT (JSON Web Tokens) for authentication. All protected routes require a valid JWT token in the Authorization header.

### Authentication Flow

1. **Signup** - Create a new user account

   ```bash
   POST /auth/signup
   {
     "name": "John Doe",
     "email": "user@example.com",
     "password": "password123"
   }
   ```

2. **Login** - Authenticate and receive access token

   ```bash
   POST /auth/login
   {
     "email": "user@example.com",
     "password": "password123"
   }
   ```

3. **Get Current User** - Retrieve authenticated user information
   ```bash
   GET /auth/me
   Authorization: Bearer <accessToken>
   ```

### Using Protected Routes

Include the JWT token in the Authorization header:

```bash
Authorization: Bearer <your-access-token>
```

### Public Routes

Routes marked with `@Public()` decorator don't require authentication:

- `POST /auth/signup`
- `POST /auth/login`

## 📡 API Response Format

All API responses follow a standardized format:

### Success Response

```json
{
  "success": true,
  "content": {
    // Response data
  },
  "message": "Success",
  "statusCode": 200
}
```

### Error Response

```json
{
  "success": false,
  "content": null,
  "message": "Error message",
  "statusCode": 400
}
```

## 📚 API Endpoints

### Authentication

| Method | Endpoint       | Description                       | Auth Required |
| ------ | -------------- | --------------------------------- | ------------- |
| POST   | `/auth/signup` | Create a new user account         | No            |
| POST   | `/auth/login`  | Authenticate and get access token | No            |
| GET    | `/auth/me`     | Get current authenticated user    | Yes           |

### Users

| Method | Endpoint     | Description       | Auth Required |
| ------ | ------------ | ----------------- | ------------- |
| POST   | `/users`     | Create a new user | Yes           |
| GET    | `/users`     | Get all users     | Yes           |
| GET    | `/users/:id` | Get user by ID    | Yes           |
| PATCH  | `/users/:id` | Update user       | Yes           |

### Health Check

| Method | Endpoint  | Description               | Auth Required |
| ------ | --------- | ------------------------- | ------------- |
| GET    | `/health` | Application health status | No            |

## 🗄️ Database Migrations

Fresh databases use `npm run migration:run` to create the original users/auth-token schema and the notification/payment tables. Both the Nest runtime and CLI discover feature entities and migrations from the same configuration; schema synchronization stays disabled.

If your database already contains the original `users` and `auth_tokens` tables, compare its schema with `InitialSchema1794200000000`, then run:

```bash
npm run migration:baseline # records ONLY the initial migration, without executing its DDL
npm run migration:run      # applies the new feature migration
```

For a compiled production deployment (including the Docker image):

```bash
npm run migration:run:prod
```

### Generate Migration

```bash
# Generate migration from entity changes
npm run migration:generate -- src/database/migrations/MigrationName

# Or use the convenience wrapper
npm run migration:generate:name -- --name MigrationName
```

### Create Empty Migration

```bash
# Create an empty migration file
npm run migration:create -- src/database/migrations/MigrationName

# Or use the convenience wrapper
npm run migration:create:name -- --name MigrationName
```

### Run Migrations

```bash
# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

## 🧪 Testing

Unit tests mock external providers. Integration tests use a disposable migrated PostgreSQL database and mock all external calls. Supply database variables and `JWT_SECRET` to Jest (or configure a dedicated test `.env`), run `npm run migration:run`, then `npm run test:e2e -- --runInBand`. The integration suite creates its own users and removes its records afterward; it checks event delivery, inbox ownership, signatures, amount matching, and concurrent webhook deduplication.

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

## 🐳 Docker Commands

```bash
# Build production image
npm run docker:build

# Run production container
npm run docker:run

# Start development environment
npm run docker:compose:dev

# Start production environment
npm run docker:compose

# Stop all services
npm run docker:compose:down

# View logs
npm run docker:compose:logs
```

## 🏛️ Architecture

### Feature boundaries

Controllers handle transport and authentication. Feature services own workflows and depend on typed contracts. Adapters handle SMTP, SMS, and payment-provider APIs. Feature-owned entities stay inside their modules; shared identity entities and migrations live in `database/`. Exported module services and event contracts are the integration entry points for new features.

`common/http/ProviderHttpClient` bounds provider requests, rejects redirects, and sanitizes errors. Configuration validates settings before startup, while credentials remain optional for unused external channels. The `jobs` module remains available for a future queue implementation.

### Base Repository Pattern

All repositories extend `BaseRepository<T>` which provides:

- `create(data)` - Create new entity
- `findById(id)` - Find by ID
- `findOne(filter)` - Find one by filter
- `findAll(filter?)` - Find all with optional filter
- `update(id, data)` - Update entity
- `delete(id)` - Delete entity

### Base Entity

All entities extend `BaseEntity` which provides:

- `id` - UUID primary key
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

## 🔧 Development

### Code Style

The project uses ESLint and Prettier for code formatting:

```bash
# Format code
npm run format

# Lint code
npm run lint
```

### Adding New Features

1. **Create Domain Entity** - Define business logic in `database/entities/`
2. **Extend BaseEntity** - Inherit from `BaseEntity` for common fields
3. **Create Repository** - Extend `BaseRepository<Entity>` in `modules/*/repository.ts`
4. **Add Service Layer** - Business logic in `modules/*/service.ts`
5. **Create Controller** - API endpoints in `modules/*/controller.ts`
6. **Add DTOs** - Request/response validation in `modules/*/dto.ts`
7. **Update Swagger** - Add API documentation decorators
8. **Write Tests** - Unit and integration tests

### Module Structure Example

```
modules/feature/
├── feature.module.ts        # Module definition
├── feature.controller.ts   # API endpoints
├── feature.service.ts      # Business logic
├── feature.repository.ts   # Data access (extends BaseRepository)
└── feature.dto.ts          # Data transfer objects
```

## 🛡️ Security Features

- **Password Hashing** - Bcrypt with salt rounds
- **JWT Authentication** - Secure token-based auth
- **Request Validation** - Automatic input validation
- **CORS** - Configurable cross-origin resource sharing
- **Global Exception Filters** - Consistent error handling
- **Guards** - Route protection with JWT

## 📖 Swagger Documentation

Interactive API documentation is available at:

- **URL**: http://localhost:3000/docs
- **Features**:
  - Try-it-out functionality
  - Request/response examples
  - Schema definitions
  - Authentication support

## 🔄 Module Dependencies

```
AppModule
├── ConfigModule (global)
├── DatabaseModule
├── AuthModule (registers JwtStrategy)
├── GuardsModule (provides JwtAuthGuard)
├── UserModule (uses GuardsModule)
├── EventsModule
├── NotificationsModule
├── PaymentsModule
└── JobsModule
```

**Note:** `GuardsModule` is separate from `AuthModule` to avoid circular dependencies.

## 🚨 Error Handling

The application uses global exception filters that catch and format all errors:

- **HttpExceptionFilter** - Handles HTTP exceptions
- **AllExceptionsFilter** - Catches all unhandled exceptions
- **TransformResponseInterceptor** - Standardizes success responses

All errors follow the standard response format with appropriate status codes.

## 📦 Available Scripts

| Script                     | Description                       |
| -------------------------- | --------------------------------- |
| `npm run build`            | Build the application             |
| `npm run start`            | Start the application             |
| `npm run start:dev`        | Start in development mode (watch) |
| `npm run start:prod`       | Start in production mode          |
| `npm run lint`             | Run ESLint                        |
| `npm run format`           | Format code with Prettier         |
| `npm run test`             | Run unit tests                    |
| `npm run test:e2e`         | Run E2E tests                     |
| `npm run migration:run`    | Run database migrations           |
| `npm run migration:revert` | Revert last migration             |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Database Connection Issues

- Ensure PostgreSQL is running
- Check `.env` file has correct database credentials
- For Docker: Use `postgres` as host (service name)

### Migration Issues

- Ensure database exists
- Check migration files are in correct directory
- Verify TypeORM configuration

### Authentication Issues

- Verify `JWT_SECRET` is set in `.env`
- Check token expiration settings
- Ensure token is included in Authorization header

## 📞 Support

For issues and questions, please open an issue on the repository.

---

**Built with ❤️ using NestJS, TypeORM, and PostgreSQL**
