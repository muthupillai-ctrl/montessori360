import { Router } from 'express';
import { login, refresh, logout, forgotPassword, resetPassword, setParentPassword } from './auth.controller.js';
import { validateLogin, validateForgotPassword, validateResetPassword } from './auth.validators.js';
import { authenticate } from '../../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login',          validateLogin,          login);
authRouter.post('/refresh',                                refresh);
authRouter.post('/logout',         authenticate,           logout);
authRouter.post('/forgot-password', validateForgotPassword, forgotPassword);
authRouter.post('/reset-password',        validateResetPassword, resetPassword);
authRouter.post('/parent/set-password',                        setParentPassword);
