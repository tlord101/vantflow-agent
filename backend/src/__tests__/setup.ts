import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { join } from 'path';
import config from '../config';

// Create a separate test database URL
const testDatabaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vantflow_test';

// Set the test database URL
process.env.DATABASE_URL = testDatabaseUrl;

// Create a new Prisma client for testing
export const prisma = new PrismaClient();

beforeAll(async () => {
  // Push the schema to the test database
  execSync('npx prisma db push --skip-generate', {
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
    },
  });

  // Connect to the database
  await prisma.$connect();
});

beforeEach(async () => {
  // Clean up the database before each test
  await prisma.execution.deleteMany();
  await prisma.project.deleteMany();
  await prisma.session.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
});

afterAll(async () => {
  // Disconnect from the database
  await prisma.$disconnect();
});

// Utility function to create a test user
export async function createTestUser(data?: {
  email?: string;
  password?: string;
  name?: string;
  organizationName?: string;
}) {
  const { SecurityUtils } = await import('../utils/security');
  
  const organization = await prisma.organization.create({
    data: {
      name: data?.organizationName || 'Test Organization',
      slug: data?.organizationName?.toLowerCase().replace(/\s+/g, '-') || 'test-organization',
    },
  });

  const hashedPassword = await SecurityUtils.hashPassword(data?.password || 'Test1234!');

  const user = await prisma.user.create({
    data: {
      email: data?.email || 'test@example.com',
      password: hashedPassword,
      name: data?.name || 'Test User',
      organizationId: organization.id,
    },
  });

  return { user, organization };
}

// Utility function to create a test session
export async function createTestSession(userId: string) {
  const { SecurityUtils } = await import('../utils/security');
  
  const token = SecurityUtils.generateToken({ userId });

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt: SecurityUtils.getSessionExpiration(),
    },
  });

  return { session, token };
}
