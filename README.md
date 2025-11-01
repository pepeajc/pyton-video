# Analizador de Video de YouTube

Esta es una aplicación web diseñada para analizar videos de YouTube. Permite a los usuarios cargar un video desde una URL de YouTube, controlarlo con alta precisión (segundo a segundo y frame a frame) y capturar el cuadro actual como una imagen descargable.

La aplicación está construida con HTML, CSS y JavaScript vainilla en el frontend, y utiliza una Netlify Serverless Function en el backend para la tarea intensiva de procesar el video.

## Características

-   **Carga de Videos de YouTube**: Pega cualquier URL de un video de YouTube (incluyendo formatos `watch?v=` y `shorts`) para cargarlo en el reproductor.
-   **Controles de Reproducción Precisos**:
    -   Play / Pausa.
    -   Avance y retroceso de 1 segundo.
    -   Avance y retroceso de 1 frame (simulado a 30 FPS).
-   **Captura de Frames**: Captura el cuadro exacto en el que te encuentras con un solo clic.
-   **Descarga de Imagen**: Descarga el frame capturado en formato PNG.
-   **Listo para Desplegar**: Configurado para un despliegue sin esfuerzo en Netlify.

---

## Cómo Ejecutar en Local

Para ejecutar la aplicación en tu máquina local, necesitarás tener [Node.js](https://nodejs.org/) instalado. El servidor de desarrollo de Netlify (`netlify-cli`) se encargará de servir tanto el frontend como la función serverless.

1.  **Clona el repositorio:**
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd <NOMBRE_DEL_DIRECTORIO>
    ```

2.  **Instala las dependencias del proyecto principal:**
    Esto instalará `netlify-cli`, la herramienta para correr el entorno de Netlify localmente.
    ```bash
    npm install
    ```

3.  **Instala las dependencias de la Función Serverless:**
    La función que captura los frames tiene sus propias dependencias, que deben instalarse por separado.
    ```bash
    npm install --prefix netlify/functions
    ```

4.  **Inicia el servidor de desarrollo:**
    Este comando utiliza `netlify-cli` para lanzar el servidor. Leerá el archivo `netlify.toml` y servirá tu sitio y tus funciones.
    ```bash
    npm run dev
    ```

5.  **Abre la aplicación:**
    Una vez que el servidor se inicie, te proporcionará una URL (normalmente `http://localhost:8888`). Ábrela en tu navegador para usar la aplicación.

---

## Cómo Desplegar en Netlify

El despliegue en Netlify es extremadamente sencillo gracias al fichero de configuración `netlify.toml` incluido en el proyecto.

1.  **Sube tu código a un repositorio Git:**
    Asegúrate de que tu proyecto esté en un repositorio de GitHub, GitLab o Bitbucket.

2.  **Crea un nuevo sitio en Netlify:**
    -   Inicia sesión en tu cuenta de [Netlify](https://www.netlify.com/).
    -   Haz clic en **"Add new site"** y selecciona **"Import an existing project"**.

3.  **Conecta tu repositorio:**
    -   Elige tu proveedor de Git y autoriza a Netlify.
    -   Selecciona el repositorio de tu aplicación.

4.  **Configura el despliegue:**
    -   Netlify leerá automáticamente el archivo `netlify.toml` y configurará todo por ti. No deberías necesitar cambiar ninguna configuración de construcción.
    -   El `publish directory` será `.` (el directorio raíz) y el `functions directory` será `netlify/functions`.

5.  **Despliega:**
    -   Haz clic en **"Deploy site"**. Netlify construirá y desplegará tu aplicación y tus funciones. ¡En unos minutos, tu sitio estará online!
