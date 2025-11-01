const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { Writable, Readable } = require('stream');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Indicar a fluent-ffmpeg dónde encontrar el ejecutable de ffmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

exports.handler = async (event) => {
    // Parsear los parámetros de la URL de la petición
    const { videoId, timestamp } = event.queryStringParameters;

    if (!videoId || !timestamp) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Faltan los parámetros videoId o timestamp.' }),
        };
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        // Obtener la información del video para asegurarse de que es válido
        await ytdl.getInfo(videoUrl);

        // Crear un stream de video con ytdl
        const videoStream = ytdl(videoUrl, { quality: 'highestvideo' });

        // Crear un buffer en memoria para la imagen de salida
        const chunks = [];
        const writable = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk);
                callback();
            }
        });

        return new Promise((resolve, reject) => {
            ffmpeg(videoStream)
                .seekInput(timestamp) // Ir al segundo exacto
                .frames(1)           // Capturar solo 1 frame
                .outputFormat('image2')// Formato de imagen
                .outputOptions('-update 1')
                .on('end', () => {
                    // Una vez que ffmpeg ha terminado, el buffer (chunks) contiene la imagen
                    const imageBuffer = Buffer.concat(chunks);

                    // Devolver la imagen en formato base64
                    resolve({
                        statusCode: 200,
                        headers: { 'Content-Type': 'image/png' },
                        body: imageBuffer.toString('base64'),
                        isBase64Encoded: true,
                    });
                })
                .on('error', (err) => {
                    console.error('Error de FFMpeg:', err);
                    reject({
                        statusCode: 500,
                        body: JSON.stringify({ error: 'Error al procesar el video con FFMpeg.', details: err.message }),
                    });
                })
                .pipe(writable, { end: true }); // Enviar la salida de ffmpeg al buffer en memoria
        });

    } catch (error) {
        console.error('Error al obtener la información del video:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error al obtener la información del video de YouTube.', details: error.message }),
        };
    }
};