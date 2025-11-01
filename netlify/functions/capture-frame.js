const { Innertube } = require('youtubei.js');
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

    try {
        // Inicializar Innertube
        const youtube = await Innertube.create();

        // Obtener la información del video
        const info = await youtube.getInfo(videoId);

        // Descargar el stream del video
        const videoStream = await info.download({
            type: 'video',          // Solo video
            quality: 'best',        // La mejor calidad disponible
            format: 'mp4'           // En formato mp4 para compatibilidad
        });

        const chunks = [];
        const writable = new Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk);
                callback();
            }
        });

        return new Promise((resolve, reject) => {
            const readableVideoStream = new require('stream').Readable.from(videoStream);

            ffmpeg(readableVideoStream)
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
        console.error('Error al obtener la información o el stream del video:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error al obtener la información del video de YouTube con youtubei.js.', details: error.message }),
        };
    }
};