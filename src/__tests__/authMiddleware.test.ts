import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Require the actual implementation to bypass the global mock in setup.ts
const { authenticateJWT } = jest.requireActual('../middlewares/authMiddleware');
import { AuthRequest } from '../middlewares/authMiddleware';

describe('Auth Middleware Unit Tests', () => {
    let mockRequest: Partial<AuthRequest>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction = jest.fn();

    beforeEach(() => {
        mockRequest = {
            headers: {}
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
    });

    it('should return 401 if authorization header is missing', () => {
        authenticateJWT(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Authorization header missing' }));
    });

    it('should return 403 if token is invalid', () => {
        mockRequest.headers = { authorization: 'Bearer invalid_token' };
        
        jest.spyOn(jwt, 'verify').mockImplementation((token, secret, cb: any) => {
            cb(new Error('Invalid token'), null);
        });

        authenticateJWT(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should call next() if token is valid', () => {
        mockRequest.headers = { authorization: 'Bearer valid_token' };
        const mockUser = { userId: 1, email: 'test@example.com' };

        jest.spyOn(jwt, 'verify').mockImplementation((token, secret, cb: any) => {
            cb(null, mockUser);
        });

        authenticateJWT(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

        expect(mockRequest.user).toEqual(mockUser);
        expect(nextFunction).toHaveBeenCalled();
    });
});
