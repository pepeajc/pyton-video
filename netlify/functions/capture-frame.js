const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { Writable, Readable } = require('stream');

ffmpeg.setFfmpegPath(ffmpegStatic);

let youtubeClientPromise;

async function getYoutubeClient() {
    if (!youtubeClientPromise) {
        youtubeClientPromise = (async () => {
            const { Innertube } = await import('youtubei.js');
            return Innertube.create({ fetch: (...args) => fetch(...args) });
        })();
    }

    return youtubeClientPromise;
}

function webStreamToNodeStream(webStream) {
    if (!webStream) {
        return null;
    }

    if (typeof Readable.fromWeb === 'function') {
        return Readable.fromWeb(webStream);
    }

    const reader = webStream.getReader();

    return new Readable({
        async read() {
            try {
                const { value, done } = await reader.read();
                if (done) {
                    this.push(null);
                } else {
                    this.push(Buffer.from(value));
                }
            } catch (error) {
                this.destroy(error);
            }
        }
    });
}

exports.handler = async (event) => {
    const { videoId, timestamp } = event.queryStringParameters;
    const seekSeconds = Number(timestamp);

    if (!videoId || Number.isNaN(seekSeconds)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Parámetros inválidos: se requieren videoId y timestamp numérico.' })
        };
    }

    try {
        const youtube = await getYoutubeClient();
        const info = await youtube.getInfo(videoId, { client: 'ANDROID' });

        const streamingFormats = [
            ...(info.streaming_data?.adaptive_formats || []),
            ...(info.streaming_data?.formats || [])
        ]
            .filter((format) => format.has_video && !format.is_drc && !format.drm_families)
            .filter((format) => format.mime_type?.includes('mp4'));

        if (streamingFormats.length === 0) {
            return {
                statusCode: 502,
                body: JSON.stringify({ error: 'No se encontraron formatos de video válidos para este contenido.' })
            };
        }

        const progressiveFormats = streamingFormats.filter((format) => format.has_audio);
        const adaptiveOnlyFormats = streamingFormats.filter((format) => !format.has_audio);

        const orderedFormats = [
            ...progressiveFormats.sort((a, b) => (b.height || 0) - (a.height || 0)),
            ...adaptiveOnlyFormats.sort((a, b) => (b.height || 0) - (a.height || 0))
        ];

        const player = info.actions.session.player;
        const clientContext = info.actions?.session?.context?.client;
        const baseHeaders = {
            accept: '*/*',
            origin: 'https://www.youtube.com',
            referer: 'https://www.youtube.com',
            DNT: '?1',
            Range: 'bytes=0-',
            'accept-language': 'en-US,en;q=0.9',
            'accept-encoding': 'gzip, deflate, br',
            connection: 'keep-alive'
        };

        const attemptedFormats = [];

        for (const format of orderedFormats) {
            attemptedFormats.push(format.itag);

            let resolvedUrl;
            try {
                resolvedUrl = format.url || (await format.decipher(player));
            } catch (decipherError) {
                console.warn('Fallo al descifrar formato', {
                    itag: format.itag,
                    message: decipherError instanceof Error ? decipherError.message : decipherError
                });
                continue;
            }

            if (!resolvedUrl) {
                continue;
            }

            try {
                const requestUrl = new URL(resolvedUrl);
                requestUrl.searchParams.set('cpn', info.cpn);
                requestUrl.searchParams.set('rbuf', '0');

                const headers = { ...baseHeaders };
                if (clientContext?.userAgent) {
                    headers['User-Agent'] = clientContext.userAgent;
                } else if (clientContext?.clientName === 'ANDROID') {
                    headers['User-Agent'] = 'com.google.android.youtube/19.35.36 (Linux; U; Android 13) gzip';
                }

                const fetchUrl = requestUrl.toString();

                const response = await fetch(fetchUrl, {
                    method: 'GET',
                    headers,
                    redirect: 'follow'
                });

                if (!response.ok || !response.body) {
                    const errorBody = await response.text().catch(() => '');
                    console.warn('Fallo al solicitar stream de YouTube', {
                        status: response.status,
                        url: fetchUrl,
                        headers: Object.fromEntries(response.headers.entries()),
                        errorBody: errorBody?.slice(0, 200)
                    });
                    continue;
                }

                const videoStream = webStreamToNodeStream(response.body);

                if (!videoStream) {
                    continue;
                }

                const captureResult = await new Promise((resolve, reject) => {
                    const chunks = [];
                    let firstChunkReceived = false;

                    videoStream.on('error', (streamError) => {
                        console.error('Error del stream de YouTube (descarga directa):', streamError);
                        reject({
                            statusCode: 500,
                            body: JSON.stringify({ error: 'Error al descargar el video desde YouTube.', details: streamError.message })
                        });
                    });

                    const writable = new Writable({
                        write(chunk, encoding, callback) {
                            if (!firstChunkReceived && chunk.length > 0) {
                                firstChunkReceived = true;
                            }
                            chunks.push(chunk);
                            callback();
                        }
                    });

                    ffmpeg(videoStream)
                        .inputOptions(['-ss', seekSeconds.toString()])
                        .outputOptions([
                            '-vframes 1',
                            '-f image2',
                            '-q:v 2',
                            '-vcodec png'
                        ])
                        .on('end', () => {
                            const imageBuffer = Buffer.concat(chunks);

                            if (!firstChunkReceived || imageBuffer.length === 0) {
                                console.warn('FFmpeg terminó sin recibir datos del stream', {
                                    videoId,
                                    formatItag: format.itag,
                                    resolvedUrl: fetchUrl
                                });
                                if (chunks.length === 0) {
                                    reject({
                                        statusCode: 500,
                                        body: JSON.stringify({ error: 'El stream de video no entregó datos antes de finalizar.' })
                                    });
                                    return;
                                }
                                reject({
                                    statusCode: 500,
                                    body: JSON.stringify({ error: 'FFMpeg no pudo generar la imagen (buffer vacío).' })
                                });
                                return;
                            }

                            resolve({
                                statusCode: 200,
                                headers: { 'Content-Type': 'image/png' },
                                body: imageBuffer.toString('base64'),
                                isBase64Encoded: true
                            });
                        })
                        .on('error', (err) => {
                            console.error('Error de FFMpeg:', err);
                            reject({
                                statusCode: 500,
                                body: JSON.stringify({ error: 'Error al procesar el video con FFMpeg.', details: err.message })
                            });
                        })
                        .pipe(writable, { end: true });
                });

                if (captureResult?.statusCode === 200) {
                    return captureResult;
                }
            } catch (formatError) {
                console.warn('Fallo al procesar formato de YouTube', {
                    itag: format.itag,
                    error: formatError instanceof Error ? formatError.message : formatError
                });
            }
        }

        console.error('No se pudo capturar el fotograma tras probar los formatos disponibles', {
            videoId,
            attemptedFormats
        });

        return {
            statusCode: 502,
            body: JSON.stringify({
                error: 'No se pudo capturar el fotograma del video.',
                attemptedFormats
            })
        };
    } catch (error) {
        console.error('Error al obtener la información o el stream del video:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error al procesar el video desde YouTube.', details: error.message })
        };
    }
};
