const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { Writable } = require('stream');

// Indicar a fluent-ffmpeg dónde encontrar el ejecutable de ffmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

exports.handler = async (event) => {
    const { videoId, timestamp } = event.queryStringParameters;

    if (!videoId || !timestamp) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Faltan los parámetros videoId o timestamp.' }),
        };
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        const videoStream = ytdl(videoUrl, {
            filter: 'videoonly',      // Asegurar que obtenemos un stream con video
            quality: 'highestvideo',  // Seleccionar la mejor calidad de video
        });

        const chunks = [];
        const writable = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk);
                callback();
            }
        });

        return new Promise((resolve, reject) => {
            ffmpeg(videoStream)
                .inputOptions([`-ss ${timestamp}`])
                .outputOptions([
                    '-vframes 1',
                    '-f image2',
                    '-q:v 2',
                    '-vcodec png'
                ])
                .on('end', () => {
                    const imageBuffer = Buffer.concat(chunks);

                    if (imageBuffer.length === 0) {
                        return reject({
                            statusCode: 500,
                            body: JSON.stringify({ error: 'FFMpeg no pudo generar la imagen (buffer vacío).' }),
                        });
                    }

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
                .pipe(writable, { end: true });
        });

    } catch (error) {
        console.error('Error al obtener el stream del video:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error al obtener el stream del video de YouTube.', details: error.message }),
        };
    }
};