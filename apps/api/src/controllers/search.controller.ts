import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { searchService } from '../services/search.service.js';
import { AppError } from '../middlewares/error.middleware.js';

export async function searchGlobalHandler(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const q = req.query.q ? String(req.query.q) : '';
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 8;

    const data = await searchService.searchGlobal(req.user.userId, q, limit);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
