import { Router } from 'express';
import { handleDeviceEvent, handleDeviceHeartbeat } from './deviceRoutes.js';

export const deviceRouter = Router();

deviceRouter.post('/heartbeat', handleDeviceHeartbeat);
deviceRouter.post('/event', handleDeviceEvent);
