import request from 'supertest';
import { app } from '../index';
import { prisma, createTestUser, createTestSession } from './setup';
import { SecurityUtils } from '../utils/security';

describe('Authentication Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User',
        organizationName: 'New Organization',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        email: userData.email,
        name: userData.name,
      });
      expect(response.body.user).not.toHaveProperty('password');

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: userData.email },
        include: { organization: true },
      });

      expect(user).toBeTruthy();
      expect(user?.organization.name).toBe(userData.organizationName);
    });

    it('should create organization automatically on registration', async () => {
      const userData = {
        email: 'orgtest@example.com',
        password: 'SecurePass123!',
        name: 'Org Test User',
        organizationName: 'Auto Created Org',
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Verify organization was created
      const organization = await prisma.organization.findFirst({
        where: { name: userData.organizationName },
      });

      expect(organization).toBeTruthy();
      expect(organization?.slug).toBe('auto-created-org');
    });

    it('should reject weak passwords', async () => {
      const userData = {
        email: 'weakpass@example.com',
        password: 'weak',
        name: 'Weak Pass User',
        organizationName: 'Weak Org',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Password must be at least 8 characters');
    });

    it('should reject invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        name: 'Invalid Email User',
        organizationName: 'Invalid Org',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject duplicate email addresses', async () => {
      await createTestUser({ email: 'duplicate@example.com' });

      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        name: 'Duplicate User',
        organizationName: 'Duplicate Org',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });

    it('should create a session on successful registration', async () => {
      const userData = {
        email: 'session@example.com',
        password: 'SecurePass123!',
        name: 'Session User',
        organizationName: 'Session Org',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Verify session was created
      const session = await prisma.session.findFirst({
        where: { token: response.body.token },
      });

      expect(session).toBeTruthy();
      expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should respect rate limiting (5 requests per minute)', async () => {
      const requests = [];
      
      // Make 6 requests rapidly
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/api/auth/register')
            .send({
              email: `ratelimit${i}@example.com`,
              password: 'SecurePass123!',
              name: 'Rate Limit Test',
              organizationName: 'Rate Limit Org',
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // At least one should be rate limited (429)
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    }, 10000);
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const { user } = await createTestUser({
        email: 'login@example.com',
        password: 'Test1234!',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Test1234!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(user.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should include organizationId in JWT token', async () => {
      const { user, organization } = await createTestUser({
        email: 'org@example.com',
        password: 'Test1234!',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'org@example.com',
          password: 'Test1234!',
        })
        .expect(200);

      // Verify token contains organizationId
      const decoded = SecurityUtils.verifyToken(response.body.token);
      expect(decoded.organizationId).toBe(organization.id);
    });

    it('should reject invalid credentials', async () => {
      await createTestUser({
        email: 'invalid@example.com',
        password: 'Test1234!',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'WrongPassword!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject non-existent users', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test1234!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should create a new session on login', async () => {
      await createTestUser({
        email: 'newsession@example.com',
        password: 'Test1234!',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'newsession@example.com',
          password: 'Test1234!',
        })
        .expect(200);

      // Verify session was created
      const session = await prisma.session.findFirst({
        where: { token: response.body.token },
      });

      expect(session).toBeTruthy();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout and delete session', async () => {
      const { user } = await createTestUser();
      const { token } = await createTestSession(user.id);

      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify session was deleted
      const session = await prisma.session.findFirst({
        where: { token },
      });

      expect(session).toBeNull();
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/auth/logout')
        .expect(401);
    });
  });

  describe('GET /api/auth/session', () => {
    it('should return current user session', async () => {
      const { user, organization } = await createTestUser({
        email: 'session@example.com',
        name: 'Session User',
      });
      const { token } = await createTestSession(user.id);

      const response = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: user.email,
        name: user.name,
      });
      expect(response.body.user.organization.id).toBe(organization.id);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/auth/session')
        .expect(401);
    });

    it('should reject invalid tokens', async () => {
      await request(app)
        .get('/api/auth/session')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject expired sessions', async () => {
      const { user } = await createTestUser();
      const token = SecurityUtils.generateToken({ userId: user.id });

      // Create an expired session
      await prisma.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  describe('JWT Token Validation', () => {
    it('should generate valid JWT tokens with 7-day expiration', async () => {
      const userId = 'test-user-id';
      const organizationId = 'test-org-id';

      const token = SecurityUtils.generateToken({ userId, organizationId });
      const decoded = SecurityUtils.verifyToken(token);

      expect(decoded.userId).toBe(userId);
      expect(decoded.organizationId).toBe(organizationId);

      // Check expiration is approximately 7 days
      const expirationTime = decoded.exp * 1000;
      const expectedExpiration = Date.now() + (7 * 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(expirationTime - expectedExpiration);

      // Allow 1 minute difference for test execution time
      expect(timeDiff).toBeLessThan(60 * 1000);
    });

    it('should reject tampered tokens', async () => {
      const token = SecurityUtils.generateToken({ userId: 'test-user-id' });
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => {
        SecurityUtils.verifyToken(tamperedToken);
      }).toThrow();
    });

    it('should reject malformed tokens', async () => {
      expect(() => {
        SecurityUtils.verifyToken('not-a-valid-jwt');
      }).toThrow();
    });
  });

  describe('Password Security', () => {
    it('should hash passwords with bcrypt', async () => {
      const password = 'Test1234!';
      const hashedPassword = await SecurityUtils.hashPassword(password);

      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
      expect(hashedPassword).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });

    it('should verify correct passwords', async () => {
      const password = 'Test1234!';
      const hashedPassword = await SecurityUtils.hashPassword(password);

      const isValid = await SecurityUtils.comparePassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      const password = 'Test1234!';
      const hashedPassword = await SecurityUtils.hashPassword(password);

      const isValid = await SecurityUtils.comparePassword('WrongPassword!', hashedPassword);
      expect(isValid).toBe(false);
    });

    it('should use salt rounds of 10', async () => {
      const password = 'Test1234!';
      const hashedPassword = await SecurityUtils.hashPassword(password);

      // bcrypt hash format: $2a$10$... where 10 is the cost factor
      const costFactor = hashedPassword.split('$')[2];
      expect(costFactor).toBe('10');
    });
  });

  describe('API Key Generation', () => {
    it('should generate API keys with correct format', async () => {
      const { user } = await createTestUser();
      const { token } = await createTestSession(user.id);

      const response = await request(app)
        .post('/api/users/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test API Key' })
        .expect(201);

      expect(response.body.key).toMatch(/^vf_[a-f0-9]{64}$/);
      expect(response.body.name).toBe('Test API Key');
    });

    it('should store API keys in database', async () => {
      const { user } = await createTestUser();
      const { token } = await createTestSession(user.id);

      const response = await request(app)
        .post('/api/users/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'DB Test Key' })
        .expect(201);

      // Verify API key was created
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: response.body.id },
      });

      expect(apiKey).toBeTruthy();
      expect(apiKey?.userId).toBe(user.id);
      expect(apiKey?.name).toBe('DB Test Key');
    });

    it('should list user API keys', async () => {
      const { user } = await createTestUser();
      const { token } = await createTestSession(user.id);

      // Create two API keys
      await request(app)
        .post('/api/users/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Key 1' });

      await request(app)
        .post('/api/users/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Key 2' });

      const response = await request(app)
        .get('/api/users/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.length).toBe(2);
      expect(response.body[0]).not.toHaveProperty('key'); // Key should not be returned
    });

    it('should delete API keys', async () => {
      const { user } = await createTestUser();
      const { token } = await createTestSession(user.id);

      const createResponse = await request(app)
        .post('/api/users/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Delete Test Key' });

      await request(app)
        .delete(`/api/users/api-keys/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify API key was deleted
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: createResponse.body.id },
      });

      expect(apiKey).toBeNull();
    });
  });

  describe('Session Expiration', () => {
    it('should set session expiration to 7 days', async () => {
      const expiresAt = SecurityUtils.getSessionExpiration();
      const expectedExpiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(expiresAt.getTime() - expectedExpiration.getTime());

      // Allow 1 second difference for test execution time
      expect(timeDiff).toBeLessThan(1000);
    });

    it('should reject requests with expired sessions', async () => {
      const { user } = await createTestUser();
      const token = SecurityUtils.generateToken({ userId: user.id });

      // Create an expired session
      await prisma.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should allow requests with valid sessions', async () => {
      const { user } = await createTestUser();
      const token = SecurityUtils.generateToken({ userId: user.id });

      // Create a valid session (expires in 7 days)
      await prisma.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt: SecurityUtils.getSessionExpiration(),
        },
      });

      await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('Organization Auto-Creation', () => {
    it('should create organization with user registration', async () => {
      const userData = {
        email: 'autoorg@example.com',
        password: 'SecurePass123!',
        name: 'Auto Org User',
        organizationName: 'Auto Organization',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Verify user has organization
      const user = await prisma.user.findUnique({
        where: { id: response.body.user.id },
        include: { organization: true },
      });

      expect(user?.organization).toBeTruthy();
      expect(user?.organization.name).toBe(userData.organizationName);
    });

    it('should generate organization slug from name', async () => {
      const userData = {
        email: 'slug@example.com',
        password: 'SecurePass123!',
        name: 'Slug User',
        organizationName: 'My Cool Organization',
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const organization = await prisma.organization.findFirst({
        where: { name: userData.organizationName },
      });

      expect(organization?.slug).toBe('my-cool-organization');
    });

    it('should rollback user creation if organization fails', async () => {
      // This test verifies the transaction behavior
      const userData = {
        email: 'rollback@example.com',
        password: 'SecurePass123!',
        name: 'Rollback User',
        organizationName: 'Test Org',
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Try to register again with same org name (should fail)
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...userData,
          email: 'rollback2@example.com',
        })
        .expect(400);

      // Verify second user was not created
      const user = await prisma.user.findUnique({
        where: { email: 'rollback2@example.com' },
      });

      expect(user).toBeNull();
    });
  });
});
