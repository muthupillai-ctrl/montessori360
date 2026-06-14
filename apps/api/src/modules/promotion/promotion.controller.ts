import { Request, Response, NextFunction } from 'express';
import { promotionService } from './promotion.service.js';

export async function preparePromotion(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = req.user!.tenantSchema;
    const preview = await promotionService.prepare(schema, req.body);
    res.json({ data: preview });
  } catch (err) { next(err); }
}

export async function executePromotion(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = req.user!.tenantSchema;
    const batch = await promotionService.execute(schema, req.body, req.user!.sub);
    res.json({ data: batch, message: `Promotion completed — ${batch.promoted_count} students promoted, ${batch.graduated_count} graduated` });
  } catch (err) { next(err); }
}

export async function listBatches(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = req.user!.tenantSchema;
    const batches = await promotionService.listBatches(schema);
    res.json({ data: batches });
  } catch (err) { next(err); }
}

export async function getStudentEnrollments(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = req.user!.tenantSchema;
    const enrollments = await promotionService.getStudentEnrollments(schema, String(req.params.studentId));
    res.json({ data: enrollments });
  } catch (err) { next(err); }
}

export async function getClassEnrollments(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = req.user!.tenantSchema;
    const classId = String(req.params.classId);
    const yearId  = String(req.params.yearId);
    const enrollments = await promotionService.getClassEnrollments(schema, classId, yearId);
    res.json({ data: enrollments });
  } catch (err) { next(err); }
}
