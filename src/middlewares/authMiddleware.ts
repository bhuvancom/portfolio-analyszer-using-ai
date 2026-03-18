import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: {
        userId: number;
        email: string;
    };
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1]; // Bearer <token>

        jwt.verify(token, process.env.JWT_SECRET as string, (err, user) => {
            if (err) {
                res.status(403).json({ success: false, message: 'Invalid or expired token' });
                return;
            }
            req.user = user as { userId: number; email: string };
            next();
        });
    } else {
        res.status(401).json({ success: false, message: 'Authorization header missing' });
    }
};
