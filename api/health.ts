import { handleHealth } from '../src/server/healthRoute.js';
import { createVercelGetHandler } from '../src/server/vercelHandler.js';

export default createVercelGetHandler(handleHealth);
