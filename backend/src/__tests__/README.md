# VantFlow Agent - Test Suite

This directory contains comprehensive test suites for the VantFlow Agent authentication and multi-tenant system.

## Test Coverage

### Authentication Tests (`auth.test.ts`)

The test suite covers all authentication requirements specified in the project:

#### 1. User Registration
- ✅ Valid user registration with organization auto-creation
- ✅ Password validation (min 8 chars, uppercase, lowercase, number, special char)
- ✅ Email validation and uniqueness
- ✅ Rejection of weak passwords
- ✅ Rejection of invalid email formats
- ✅ Prevention of duplicate email addresses
- ✅ Session creation on successful registration
- ✅ Rate limiting enforcement (5 requests per minute)

#### 2. User Login
- ✅ Successful login with valid credentials
- ✅ JWT token generation with organizationId
- ✅ Rejection of invalid credentials
- ✅ Rejection of non-existent users
- ✅ Session creation on successful login

#### 3. User Logout
- ✅ Session deletion on logout
- ✅ Authentication requirement

#### 4. Session Management
- ✅ Current user session retrieval
- ✅ Organization details included in session
- ✅ Authentication requirement
- ✅ Rejection of invalid tokens
- ✅ Rejection of expired sessions

#### 5. JWT Token Validation
- ✅ Valid JWT token generation with 7-day expiration
- ✅ Correct payload structure (userId, organizationId)
- ✅ Rejection of tampered tokens
- ✅ Rejection of malformed tokens

#### 6. Password Security
- ✅ Bcrypt password hashing
- ✅ Password verification
- ✅ Incorrect password rejection
- ✅ Salt rounds configuration (10 rounds)

#### 7. API Key Generation
- ✅ Correct API key format (`vf_` prefix + 64 hex chars)
- ✅ Database storage
- ✅ API key listing
- ✅ API key deletion

#### 8. Session Expiration
- ✅ 7-day session expiration
- ✅ Rejection of expired sessions
- ✅ Acceptance of valid sessions

#### 9. Organization Auto-Creation
- ✅ Organization created with user registration
- ✅ Organization slug generation from name
- ✅ Transaction rollback on organization creation failure

## Setup

### Prerequisites

1. PostgreSQL database for testing
2. Environment variables configured

### Environment Configuration

Create a `.env.test` file in the backend root directory:

```env
# Test Database
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vantflow_test

# JWT
JWT_SECRET=test-secret-key-for-testing-only

# Node Environment
NODE_ENV=test
```

### Install Dependencies

```bash
cd backend
npm install
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

## Test Database Setup

The tests use a separate test database to avoid interfering with development data.

### Automatic Setup

The test suite automatically:
1. Creates the test database schema using Prisma
2. Cleans up data before each test
3. Disconnects after all tests complete

### Manual Database Creation

If needed, create the test database manually:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create test database
CREATE DATABASE vantflow_test;

# Exit
\q
```

## Test Structure

```
backend/src/__tests__/
├── README.md           # This file
├── setup.ts           # Test configuration and utilities
└── auth.test.ts       # Authentication test suite
```

### Test Utilities

The `setup.ts` file provides:

- **Prisma test client**: Separate database connection for tests
- **Database cleanup**: Automatic cleanup before each test
- **Test user creation**: `createTestUser()` helper function
- **Test session creation**: `createTestSession()` helper function

## Test Execution Flow

1. **Before All Tests**: 
   - Push Prisma schema to test database
   - Connect to database

2. **Before Each Test**:
   - Clean up all data (executions, projects, sessions, API keys, users, organizations)

3. **Test Execution**:
   - Create test data as needed
   - Execute API requests via Supertest
   - Verify responses and database state

4. **After All Tests**:
   - Disconnect from database

## Writing New Tests

### Example Test Structure

```typescript
import request from 'supertest';
import { app } from '../index';
import { prisma, createTestUser } from './setup';

describe('Your Feature', () => {
  it('should do something', async () => {
    // Arrange
    const { user } = await createTestUser();
    
    // Act
    const response = await request(app)
      .get('/api/your-endpoint')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    // Assert
    expect(response.body).toHaveProperty('expectedField');
  });
});
```

### Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Use `beforeEach` to clean data
3. **Descriptive Names**: Use clear, descriptive test names
4. **Arrange-Act-Assert**: Follow the AAA pattern
5. **Database Verification**: Verify critical data in database, not just API responses

## Debugging Tests

### Run Single Test File

```bash
npm test -- auth.test.ts
```

### Run Single Test

```bash
npm test -- -t "should register a new user"
```

### Enable Verbose Output

```bash
npm test -- --verbose
```

### Debug with Node Inspector

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then connect Chrome DevTools to `chrome://inspect`

## Common Issues

### Database Connection Errors

- Ensure PostgreSQL is running
- Verify `TEST_DATABASE_URL` in `.env.test`
- Check database exists and is accessible

### Rate Limiting Failures

- Tests run sequentially (`--runInBand`) to avoid rate limit conflicts
- Increase timeout for rate limiting tests: `jest.setTimeout(10000)`

### Type Errors

- Ensure all dependencies are installed: `npm install`
- Regenerate Prisma client: `npx prisma generate`

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vantflow_test
          JWT_SECRET: test-secret
          NODE_ENV: test
```

## Coverage Goals

Target coverage metrics:

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

View coverage report after running:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
