import Mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

export async function conectarMongo(){
    try {

        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI no está definido en las variables de entorno');
        }


        await Mongoose.connect(uri);
        
        console.log('mongoConectado');
} catch (error ) {
        console.log('mongoError');
        console.error(error); 
    }
}


export async function listarColecciones() {
    try {
        if (Mongoose.connection.readyState !== 1) {
            throw new Error('MongoDB no está conectado. Asegúrate de llamar a conectarMongo() primero.');
        }

        if (!Mongoose.connection.db) {
            throw new Error('La base de datos no está disponible.');
        }

        const collections = await Mongoose.connection.db.listCollections().toArray();
        
      
        const nombresColecciones = collections.map(collection => collection.name);
        
        return nombresColecciones;
    } catch (error) {
        console.error('Error al listar colecciones:', error);
        throw error;
    }
}