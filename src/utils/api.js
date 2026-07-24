/**
 * src/main/api.js
 * 该文件用于集中处理所有通过 IPC 调用转发过来的 API 请求。
 */
import axios from "axios";

// 也可以在这里创建一个配置好的 axios 实例，例如设置 baseURL, timeout, headers 等
// const apiClient = axios.create({
//   baseURL: 'https://api.example.com',
//   timeout: 5000,
// });

/**
 * 通用的 API 请求处理器
 * @param {object} options - axios 请求配置 (method, url, data, params, headers 等)
 * @returns {Promise<object>} - 返回从 API 获取的数据或错误信息
 */
export async function handleApiRequest(options) {
    try {
        // 确保参数结构完整和正确
        const requestConfig = {
            method: options.method || "get",
            url: options.url,
            // 仅在提供了 data 时添加到请求配置中
            ...(options.data && { data: options.data }),
            // 仅在提供了 params 时添加到请求配置中
            ...(options.params && { params: options.params }),
            // 仅在提供了 headers 时添加到请求配置中
            ...(options.headers && { headers: options.headers }),
            // 添加其他可能的 axios 选项
            ...(options.timeout && { timeout: options.timeout }),
            ...(options.responseType && { responseType: options.responseType }),
            ...(options.withCredentials && { withCredentials: options.withCredentials }),
        };

        // 使用 axios 发起请求
        const response = await axios(requestConfig);

        // 返回成功响应
        return {
            success: true,
            data: response.data,
            status: response.status,
            headers: response.headers,
        };
    } catch (error) {
        console.error(`API请求失败: ${error.message}`);

        // 返回一个标准化的错误结构
        return {
            success: false,
            error: {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
                code: error.code,
            },
        };
    }
}


