import jwt from 'jsonwebtoken';

export const generateMockToken = (userId: number = 1, email: string = 'test@example.com') => {
    return jwt.sign({ userId, email }, process.env.JWT_SECRET || 'test_secret', { expiresIn: '1h' });
};
