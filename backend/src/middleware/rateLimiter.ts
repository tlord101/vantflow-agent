import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import logger from '../utils/logger';

// Rate limiters for different endpoints
const loginLimiter = new RateLimiterMemory({
  points: 5, // 5 attempts
  duration: 15 * 60, // per 15 minutes
  blockDuration: 15 * 60, // block for 15 minutes
});

const registerLimiter = new RateLimiterMemory({
  points: 3, // 3 attempts
  duration: 60 * 60, // per hour
  blockDuration: 60 * 60, // block for 1 hour
});

const chatLimiter = new RateLimiterMemory({
  points: 20, // 20 requests
  duration: 60, // per minute
  blockDuration: 60, // block for 1 minute
});

const generalLimiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 15 * 60, // per 15 minutes
});

export const rateLimitLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    await loginLimiter.consume(ip);
    next();
  } catch (error) {
    logger.warn(`Rate limit exceeded for login from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many login attempts. Please try again later.',
      retryAfter: 15 * 60, // seconds
    });
  }
};

export const rateLimitRegister = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    await registerLimiter.consume(ip);
    next();
  } catch (error) {
    logger.warn(`Rate limit exceeded for registration from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many registration attempts. Please try again later.',
      retryAfter: 60 * 60, // seconds
    });
  }
};

export const rateLimitChat = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    await chatLimiter.consume(ip);
    next();
  } catch (error) {
    logger.warn(`Rate limit exceeded for chat from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests. Please slow down.',
      retryAfter: 60, // seconds
    });
  }
};

export const rateLimitGeneral = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    await generalLimiter.consume(ip);
    next();
  } catch (error) {
    logger.warn(`Rate limit exceeded from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: 15 * 60, // seconds
    });
  }
};
