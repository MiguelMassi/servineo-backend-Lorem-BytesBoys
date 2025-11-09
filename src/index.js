import { SERVER_PORT } from './config/env.config.js';
import Server from './config/server.config.js';
import _connect from './database.js';


async function startServer() {
  try {
    Server.listen(SERVER_PORT, async () => {
      console.info(`Server running on http://localhost:${SERVER_PORT}`);
    });
  } catch (error) {
    console.error('Error starting server', error);
  }
}

_connect();
startServer();
