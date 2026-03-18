import request from 'supertest';
import app from '../app';
import { prismaMock } from './setup';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Auth Controller Integration Tests', () => {
    
    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            prismaMock.user.findUnique.mockResolvedValue(null);
            const newUser = { id: 1, email: 'test@example.com', password: 'hashed_password', createdAt: new Date() };
            prismaMock.user.create.mockResolvedValue(newUser);
            
            jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashed_password'));
            jest.spyOn(jwt, 'sign').mockImplementation(() => 'mock_token');

            const response = await request(app)
                .post('/api/auth/register')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBe('mock_token');
        });

        it('should return 400 if email/password missing', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({ email: 'test@example.com' });

            expect(response.status).toBe(400);
        });

        it('should return 409 if user already exists', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ id: 1, email: 'test@example.com' } as any);
            
            const response = await request(app)
                .post('/api/auth/register')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(response.status).toBe(409);
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login successfully with correct credentials', async () => {
            const user = { id: 1, email: 'test@example.com', password: 'hashed_password' };
            prismaMock.user.findUnique.mockResolvedValue(user as any);
            
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
            jest.spyOn(jwt, 'sign').mockImplementation(() => 'mock_token');

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(response.status).toBe(200);
            expect(response.body.data.token).toBe('mock_token');
        });

        it('should return 401 for incorrect password', async () => {
            const user = { id: 1, email: 'test@example.com', password: 'hashed_password' };
            prismaMock.user.findUnique.mockResolvedValue(user as any);
            
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrong_password' });

            expect(response.status).toBe(401);
        });

        it('should return 401 if user not found', async () => {
            prismaMock.user.findUnique.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'notfound@example.com', password: 'password123' });

            expect(response.status).toBe(401);
        });
    });
});
