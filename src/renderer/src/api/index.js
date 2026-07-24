/**
 * src/renderer/src/api/index.js
 * 渲染进程的通用 API 模块，封装了与主进程的 IPC 通信。
 * 提供了类似 axios 的方法，方便在 Vue 组件中调用。
 */

/**
 * 通用的请求函数，是所有导出方法的核心。
 * @param {object} options - 传递给主进程 axios 的请求配置对象 (method, url, data, params, headers 等)
 * @returns {Promise<any>} - 成功时返回 API 响应的 `data` 部分。
 * @throws {Error} - 当 API 返回错误或通信异常时，抛出一个包含详细信息的异常。
 *                   调用方应该使用 try...catch 来处理错误。
 */
async function request(options) {
    try {
        // 调用在 preload.js 中暴露的通用请求方法
        const response = await window.api.request(options);

        if (response.success) {
            // 请求成功，直接返回 `data` 部分，这是最常见的使用场景
            return response.data;
        } else {
            // 请求在主进程中失败（例如，网络错误，服务器返回 4xx/5xx）
            // 构造一个包含详细信息的 Error 对象并抛出
            const error = new Error(response.error.message || "API 请求发生未知错误");
            error.data = response.error.data; // 附加原始错误数据
            error.status = response.error.status; // 附加 HTTP 状态码
            error.code = response.error.code; // 附加错误代码 (例如 'ECONNRESET')
            throw error;
        }
    } catch (error) {
        // 捕获并重新抛出在 request 函数内部或 IPC 通信中发生的异常
        // 这样做可以确保调用方总是能通过 try/catch 来处理所有类型的错误
        console.error("API请求封装层捕获到异常:", error);
        throw error;
    }
}

/**
 * 发送 GET 请求
 * @param {string} url - 请求的 URL
 * @param {object} [params] - URL 查询参数
 * @param {object} [config] - 其他 axios 配置，例如 headers, timeout
 * @returns {Promise<any>}
 */
export const get = (url, params, config = {}) => {
    return request({
        method: "get",
        url,
        params,
        ...config,
    });
};

/**
 * 发送 POST 请求
 * @param {string} url - 请求的 URL
 * @param {object} [data] - 请求体数据
 * @param {object} [config] - 其他 axios 配置，例如 headers, timeout
 * @returns {Promise<any>}
 */
export const post = (url, data, config = {}) => {
    return request({
        method: "post",
        url,
        data,
        ...config,
    });
};

/**
 * 发送 PUT 请求
 * @param {string} url - 请求的 URL
 * @param {object} [data] - 请求体数据
 * @param {object} [config] - 其他 axios 配置
 * @returns {Promise<any>}
 */
export const put = (url, data, config = {}) => {
    return request({
        method: "put",
        url,
        data,
        ...config,
    });
};

/**
 * 发送 DELETE 请求
 * @param {string} url - 请求的 URL
 * @param {object} [config] - 其他 axios 配置
 * @returns {Promise<any>}
 */
export const del = (url, config = {}) => {
    return request({
        method: "delete",
        url,
        ...config,
    });
};

// 也可以导出一个默认对象，包含所有方法
export default {
    get,
    post,
    put,
    delete: del, // 'delete' 是一个保留关键字
    request, // 也导出原始的 request 方法，以便进行更复杂的配置
};
