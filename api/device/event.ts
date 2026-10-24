import { handleDeviceEvent } from '../../src/server/deviceRoutes';
import { createVercelPostHandler } from '../../src/server/vercelHandler';

export const config = {
  api: {
    bodyParser: { sizeLimit: '64kb' },
  },
};

export default createVercelPostHandler(handleDeviceEvent);
