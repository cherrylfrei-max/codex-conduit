import { ipcMain } from "electron";
let mainWindow = null;
let message = [];
let isRenderMounted = false;
/**
 * Initializes the logger with the main browser window.
 * This must be called after the window is created.
 * @param {import('electron').BrowserWindow} window
 */
export function initLogger(window) {
    mainWindow = window;
}

ipcMain.handle("render-on-mounted", () => {
    isRenderMounted = true;
    message.forEach((item) => {
        mainWindow.webContents.send(...item);
    });
    message = [];
});

/**
 * Sends a message to the renderer process.
 * @param {string} channel - The IPC channel.
 * @param {...any} args - The data to send.
 */
function sendToRenderer(channel, ...args) {
    if (isRenderMounted && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send(channel, ...args);
    } else {
        message.push([channel, ...args]);
    }
}

// Keep the original console functions for output in the main process terminal
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
};

/**
 * Logs a message and sends it to the renderer process.
 * @param {...any} args
 */
export function mainLog(args) {
    originalConsole.log(args); // Keep output in main process console
    sendToRenderer("log-message", { level: "info", data: args });
}
export function mainSuccessLog(args) {
    originalConsole.log(args); // Keep output in main process console
    sendToRenderer("log-message", { level: "success", data: args });
}
export function mainBeginLog(args) {
    originalConsole.log(args); // Keep output in main process console
    sendToRenderer("log-message", { level: "begin", data: args });
}

export function mainEndLog(args) {
    originalConsole.log(args); // Keep output in main process console
    sendToRenderer("log-message", { level: "end", data: args });
}
export function mainAccountLog(args) {
    originalConsole.log(args); // Keep output in main process console
    sendToRenderer("log-message", { level: "account", data: args });
}
export function mainLicenseLog(args) {
    // originalConsole.log(args); // Keep output in main process console
    sendToRenderer("log-message", { level: "license", data: args });
}
export function mainLicenseError(args) {
    originalConsole.error(args); // Keep output in main process console
    sendToRenderer("log-message", { level: "license-error", data: args });
}
export function mainBoxTips(args) {
    sendToRenderer("log-message", { level: "box-tips", data: args });
}
export function mainLogTips(args) {
    sendToRenderer("log-message", { level: "log-tips", data: args });
}
export function mainAboutNotice(args) {
    sendToRenderer("log-message", { level: "about-notice", data: args });
}

/**
 * Logs an error message and sends it to the renderer process.
 * @param {...any} args
 */
export function mainError(args) {
    originalConsole.error(args); // Keep output in main process console
    sendToRenderer("log-message", { level: "error", data: args });
}
