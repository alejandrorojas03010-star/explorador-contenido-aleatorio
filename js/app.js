// ===== Explorador de contenido aleatorio =====
// Consume cuatro APIs públicas con fetch + async/await.
// Cada sección tiene su propia función de consulta y se actualiza de forma independiente.

"use strict";

// ----- Endpoints -----
const URL_CITA_ALEATORIA = "https://dummyjson.com/quotes/random";
const URL_PERRO_ALEATORIO = "https://dog.ceo/api/breeds/image/random";
const URL_GATO_ALEATORIO_JSON = "https://cataas.com/cat?json=true";
const URL_BASE_IMAGEN_GATO = "https://cataas.com/cat/";
const URL_DATO_CURIOSO = "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en";

const TIEMPO_MAXIMO_ESPERA_MS = 10000;
const TEXTO_CARGANDO = "Cargando…";

// ----- Referencias a elementos del DOM -----
const seccionCita = {
    boton: document.getElementById("boton-cita"),
    estado: document.getElementById("cita-estado"),
    contenido: document.getElementById("cita-contenido"),
    texto: document.getElementById("cita-texto"),
    autor: document.getElementById("cita-autor"),
};

const seccionPerro = {
    boton: document.getElementById("boton-perro"),
    estado: document.getElementById("perro-estado"),
    imagen: document.getElementById("perro-imagen"),
};

const seccionGato = {
    boton: document.getElementById("boton-gato"),
    estado: document.getElementById("gato-estado"),
    imagen: document.getElementById("gato-imagen"),
};

const seccionDato = {
    boton: document.getElementById("boton-dato"),
    estado: document.getElementById("dato-estado"),
    texto: document.getElementById("dato-texto"),
};

// ===== Utilidades compartidas =====

/**
 * Realiza una petición GET y devuelve el cuerpo interpretado como JSON.
 * Lanza un error si la respuesta HTTP no es correcta (response.ok === false)
 * o si la solicitud tarda demasiado.
 */
async function solicitarJson(url) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_ESPERA_MS);

    try {
        // cache: "no-store" garantiza que cada clic haga una consulta nueva
        const response = await fetch(url, { cache: "no-store", signal: controlador.signal });

        if (!response.ok) {
            throw new Error(`El servidor respondió con el código ${response.status}.`);
        }

        return await response.json();
    } finally {
        clearTimeout(temporizador);
    }
}

/**
 * Descarga una imagen antes de mostrarla. Resuelve cuando la imagen terminó
 * de cargar y rechaza si el navegador no pudo obtenerla.
 */
function precargarImagen(urlImagen) {
    return new Promise((resolve, reject) => {
        const imagenTemporal = new Image();
        imagenTemporal.onload = () => resolve(urlImagen);
        imagenTemporal.onerror = () => reject(new Error("No se pudo cargar la imagen."));
        imagenTemporal.src = urlImagen;
    });
}

/** Convierte un error técnico en un mensaje comprensible para el usuario. */
function describirError(error) {
    if (error.name === "AbortError") {
        return "La solicitud tardó demasiado en responder.";
    }
    if (error instanceof TypeError) {
        // fetch lanza TypeError cuando no hay conexión o la petición es bloqueada
        return "No se pudo conectar con el servicio. Revisa tu conexión a Internet.";
    }
    return error.message || "Ocurrió un error inesperado.";
}

function mostrarCargando(elementoEstado) {
    elementoEstado.className = "estado estado-cargando" + (esEstadoDeImagen(elementoEstado) ? " estado-imagen" : "");
    elementoEstado.textContent = TEXTO_CARGANDO;
}

function mostrarError(elementoEstado, mensaje) {
    elementoEstado.className = "estado estado-error" + (esEstadoDeImagen(elementoEstado) ? " estado-imagen" : "");
    elementoEstado.textContent = `${mensaje} Presiona el botón para intentarlo de nuevo.`;
}

function limpiarEstado(elementoEstado) {
    elementoEstado.textContent = "";
}

function esEstadoDeImagen(elementoEstado) {
    return elementoEstado.classList.contains("estado-imagen");
}

// ===== 1. Citas y autores — DummyJSON =====
async function obtenerCitaAleatoria() {
    seccionCita.boton.disabled = true;
    seccionCita.contenido.hidden = true;
    mostrarCargando(seccionCita.estado);

    try {
        const datosCita = await solicitarJson(URL_CITA_ALEATORIA);

        if (!datosCita.quote || !datosCita.author) {
            throw new Error("La respuesta no contiene una cita válida.");
        }

        seccionCita.texto.textContent = datosCita.quote;
        seccionCita.autor.textContent = datosCita.author;
        seccionCita.contenido.hidden = false;
        limpiarEstado(seccionCita.estado);
    } catch (error) {
        console.error("Error al obtener la cita:", error);
        mostrarError(seccionCita.estado, `No se pudo obtener la cita. ${describirError(error)}`);
    } finally {
        seccionCita.boton.disabled = false;
    }
}

// ===== 2. Imágenes de perros — Dog CEO =====
async function obtenerPerroAleatorio() {
    seccionPerro.boton.disabled = true;
    seccionPerro.imagen.hidden = true;
    mostrarCargando(seccionPerro.estado);

    try {
        const datosPerro = await solicitarJson(URL_PERRO_ALEATORIO);

        if (datosPerro.status !== "success" || !datosPerro.message) {
            throw new Error("La respuesta no contiene una imagen válida.");
        }

        const urlImagenPerro = datosPerro.message;
        await precargarImagen(urlImagenPerro);

        seccionPerro.imagen.src = urlImagenPerro;
        seccionPerro.imagen.alt = `Fotografía aleatoria de un perro de raza ${obtenerRazaDesdeUrl(urlImagenPerro)}`;
        seccionPerro.imagen.hidden = false;
        limpiarEstado(seccionPerro.estado);
    } catch (error) {
        console.error("Error al obtener el perro:", error);
        mostrarError(seccionPerro.estado, `No se pudo mostrar el perro. ${describirError(error)}`);
    } finally {
        seccionPerro.boton.disabled = false;
    }
}

/** La URL de Dog CEO incluye la raza: .../breeds/{raza}-{subraza}/archivo.jpg */
function obtenerRazaDesdeUrl(urlImagen) {
    const coincidencia = urlImagen.match(/breeds\/([^/]+)\//);
    if (!coincidencia) {
        return "desconocida";
    }
    return coincidencia[1].split("-").reverse().join(" ");
}

// ===== 3. Imágenes de gatos — CATAAS =====
// https://cataas.com/cat?json=true devuelve JSON con el campo "id";
// con ese identificador se construye la URL de la imagen: https://cataas.com/cat/{id}
async function obtenerGatoAleatorio() {
    seccionGato.boton.disabled = true;
    seccionGato.imagen.hidden = true;
    mostrarCargando(seccionGato.estado);

    try {
        const datosGato = await solicitarJson(URL_GATO_ALEATORIO_JSON);

        if (!datosGato.id) {
            throw new Error("La respuesta no contiene el identificador de la imagen.");
        }

        const urlImagenGato = URL_BASE_IMAGEN_GATO + encodeURIComponent(datosGato.id);
        await precargarImagen(urlImagenGato);

        const etiquetas = Array.isArray(datosGato.tags) && datosGato.tags.length > 0
            ? ` (etiquetas: ${datosGato.tags.join(", ")})`
            : "";

        seccionGato.imagen.src = urlImagenGato;
        seccionGato.imagen.alt = `Fotografía aleatoria de un gato${etiquetas}`;
        seccionGato.imagen.hidden = false;
        limpiarEstado(seccionGato.estado);
    } catch (error) {
        console.error("Error al obtener el gato:", error);
        mostrarError(seccionGato.estado, `No se pudo mostrar el gato. ${describirError(error)}`);
    } finally {
        seccionGato.boton.disabled = false;
    }
}

// ===== 4. Datos curiosos — Useless Facts =====
async function obtenerDatoCurioso() {
    seccionDato.boton.disabled = true;
    seccionDato.texto.hidden = true;
    mostrarCargando(seccionDato.estado);

    try {
        const datosCuriosos = await solicitarJson(URL_DATO_CURIOSO);

        if (!datosCuriosos.text) {
            throw new Error("La respuesta no contiene un dato curioso.");
        }

        seccionDato.texto.textContent = datosCuriosos.text;
        seccionDato.texto.hidden = false;
        limpiarEstado(seccionDato.estado);
    } catch (error) {
        console.error("Error al obtener el dato curioso:", error);
        mostrarError(seccionDato.estado, `No se pudo obtener el dato curioso. ${describirError(error)}`);
    } finally {
        seccionDato.boton.disabled = false;
    }
}

// ===== Errores al mostrar imágenes ya cargadas =====
// Si el navegador falla al pintar la imagen (por ejemplo, se pierde la conexión),
// se oculta la imagen rota y se informa al usuario.
function manejarErrorDeImagen(seccion, nombreAnimal) {
    seccion.imagen.addEventListener("error", () => {
        if (!seccion.imagen.getAttribute("src")) {
            return;
        }
        seccion.imagen.hidden = true;
        mostrarError(seccion.estado, `No se pudo cargar la imagen del ${nombreAnimal}.`);
    });
}

// ===== Inicialización =====
function inicializarExplorador() {
    seccionCita.boton.addEventListener("click", obtenerCitaAleatoria);
    seccionPerro.boton.addEventListener("click", obtenerPerroAleatorio);
    seccionGato.boton.addEventListener("click", obtenerGatoAleatorio);
    seccionDato.boton.addEventListener("click", obtenerDatoCurioso);

    manejarErrorDeImagen(seccionPerro, "perro");
    manejarErrorDeImagen(seccionGato, "gato");

    // Al ingresar a la página se cargan las cuatro secciones en paralelo.
    // Cada función maneja sus propios errores, así que el fallo de una no afecta a las demás.
    obtenerCitaAleatoria();
    obtenerPerroAleatorio();
    obtenerGatoAleatorio();
    obtenerDatoCurioso();
}

document.addEventListener("DOMContentLoaded", inicializarExplorador);
