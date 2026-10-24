import { handleDeviceHeartbeat } from '../../src/server/deviceRoutes.js';
import { createVercelPostHandler } from '../../src/server/vercelHandler.js';

export const config = {
  api: {
    bodyParser: { sizeLimit: '64kb' },
  },
};

export default createVercelPostHandler(handleDeviceHeartbeat);
