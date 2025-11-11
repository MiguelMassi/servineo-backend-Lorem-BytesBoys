import Server from './config/server.config.js';
import { SERVER_PORT } from './config/env.config.js';
import { conectarMongo } from './config/mongo.config.js';

async function startServer() {
  try {
    await conectarMongo();
    
    Server.listen(SERVER_PORT, () => {
      console.info(`Server running on http://localhost:${SERVER_PORT}`);
    });
  } catch (error) {
    console.error('Error starting server', error);
  }
}

startServer();

