import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export function validateBody(schema: z.ZodTypeAny) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((e) => ({
          field: e.path.join('.') || 'body',
          message: e.message,
        }));

        // Task 3: Safe development diagnostics identifying failing route & validation field
        // without logging passwords, tokens, or sensitive customer data
        const safeSummary = details.map((d) => `${d.field}: ${d.message}`).join('; ');
        console.warn(`[Validation Failed] ${req.method} ${req.originalUrl} — ${safeSummary}`);

        const primaryMessage = details[0]?.message || 'Validation failed';

        res.status(400).json({
          error: 'Validation failed',
          message: primaryMessage,
          details,
        });
        return;
      }
      next(error);
    }
  };
}
