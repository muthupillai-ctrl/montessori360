import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import type { Request } from 'express';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']);
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const storage = multer.diskStorage({
  destination(req: Request, _file, cb) {
    const schema = (req as any).user?.tenantSchema ?? 'default';
    const dir = path.join(process.cwd(), 'uploads', schema);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Accepted: PDF, DOC, DOCX, JPG, PNG`));
    }
  },
});
