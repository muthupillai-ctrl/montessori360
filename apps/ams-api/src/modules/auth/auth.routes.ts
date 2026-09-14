import { Router } from 'express';
import { login, refresh, logout } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/login',   login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout',  logout);
