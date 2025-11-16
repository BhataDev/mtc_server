import jwt from 'jsonwebtoken';
import { JWT_EXPIRES_IN } from '../config/constants';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-this';

export interface TokenPayload {
  id: string;
  username: string;
  role: 'admin' | 'branch' | 'customer';
  branchId?: string;
}

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

export const decodeToken = (token: string): TokenPayload | null => {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
};
