import type { Env } from './env';
import { DispatchBoard } from './dispatch-board';

export { DispatchBoard };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      const id = env.DISPATCH_BOARD.idFromName('singleton');
      const stub = env.DISPATCH_BOARD.get(id);
      return stub.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
