import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import prisma from '../utils/db'; // Import our actual Prisma client instance

// Mock the authentication middleware globally
jest.mock('../middlewares/authMiddleware', () => ({
  authenticateJWT: jest.fn((req, res, next) => {
    req.user = { userId: 1, email: 'test@example.com' };
    next();
  })
}));

// Mock the prisma dependency globally
jest.mock('../utils/db', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

// Export the mocked version so tests can use it to set up assertions/spies
export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
