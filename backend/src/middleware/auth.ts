import { Request, Response, NextFunction } from 'express';
import { verifySessionToken, SessionPayload } from '../modules/auth/authService';

export interface AuthedRequest extends Request {
  session: SessionPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  try {
    const session = verifySessionToken(header.slice('Bearer '.length));
    (req as AuthedRequest).session = session;
    next();
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
}
