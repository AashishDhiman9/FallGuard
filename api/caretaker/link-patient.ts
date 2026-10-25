import { handleCaretakerPatientLink } from '../../src/server/caretakerLinkRoute.js';
import { createVercelPostHandler } from '../../src/server/vercelHandler.js';

export const config = {
  api: {
    bodyParser: { sizeLimit: '16kb' },
  },
};

export default createVercelPostHandler(handleCaretakerPatientLink);
