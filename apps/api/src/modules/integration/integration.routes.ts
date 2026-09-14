import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { listKeys, createKey, revokeKey, deleteKey } from './integration.controller.js';

export const integrationRouter = Router();
integrationRouter.use(authenticate);

const ADMIN = ['owner', 'principal'];

integrationRouter.get(   '/api-keys',          authorize(...ADMIN), listKeys);
integrationRouter.post(  '/api-keys',          authorize(...ADMIN), createKey);
integrationRouter.patch( '/api-keys/:id/revoke', authorize(...ADMIN), revokeKey);
integrationRouter.delete('/api-keys/:id',      authorize(...ADMIN), deleteKey);
