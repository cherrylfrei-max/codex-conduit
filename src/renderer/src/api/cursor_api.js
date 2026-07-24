/**
 * @file src/renderer/src/api/cursor_api.js
 * @description Cursor 相关 API 封装
 */

/**
 * 通用的请求函数
 * @param {object} options - axios 请求配置对象 (method, url, data, params, headers 等)
 * @returns {Promise<any>} - 返回 API 的响应数据
 * @throws {Error} - 当 API 返回错误时，抛出一个带有错误信息的异常
 */
async function request(options) {
    try {
        // 调用在 preload.js 中暴露的通用请求方法
        const response = await window.api.request(options);

        if (response.success) {
            // 请求成功，返回 `data` 部分
            return response.data;
        } else {
            // 请求失败，构造一个包含详细信息的 Error 对象并抛出
            const error = new Error(response.error.message || "API 请求发生未知错误");
            error.data = response.error.data; // 附加原始错误数据
            error.status = response.error.status; // 附加 HTTP 状态码
            error.code = response.error.code; // 附加错误代码
            throw error;
        }
    } catch (error) {
        // 捕获并重新抛出网络错误或其他异常
        console.error("API请求异常:", error);
        throw error;
    }
}

// 参考自 cursor_acc_info.py
const NAME_LOWER = "cursor";
const NAME_CAPITALIZE = "Cursor";

const BASE_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    Accept: "application/json",
    "Content-Type": "application/json",
};

/**
 * 获取用户的 Stripe 订阅信息
 * 对应 python/cursor_acc_info.py -> UsageManager.get_stripe_profile
 * @param {string} token - 用户认证令牌
 * @returns {Promise<any>}
 */
export const getStripeProfile = async (token) => {
    if (!token) {
        throw new Error("认证令牌不能为空");
    }
    const url = `https://www.cursor.com/api/auth/stripe`;
    const headers = {
        ...BASE_HEADERS,
        Cookie: `Workos${NAME_CAPITALIZE}SessionToken=user_01OOOOOOOOOOOOOOOOOOOOOOOO%3A%3A${token}`,
    };

    return request({
        method: "get",
        url: url,
        headers: headers,
        timeout: 20000, // 10秒超时
    });
};

/**
 * 获取用户的使用量信息
 * 对应 python/cursor_acc_info.py -> UsageManager.get_usage
 * @param {string} token - 用户认证令牌
 * @returns {Promise<object>}
 */
export const getUsage = async (token) => {
    if (!token) {
        throw new Error("认证令牌不能为空");
    }

    const url = `https://www.${NAME_LOWER}.com/api/usage`;
    const headers = {
        ...BASE_HEADERS,
        Cookie: `Workos${NAME_CAPITALIZE}SessionToken=user_01OOOOOOOOOOOOOOOOOOOOOOOO%3A%3A${token}`,
    };

    try {
        const data = await request({
            method: "get",
            url: url,
            headers: headers,
            timeout: 20000, // 10秒超时
        });

        console.log("usage data", data);

        // 格式化数据结构，确保返回一致的格式
        const gpt4_data = data["gpt-4"] || {};
        const numRequestsTotal = gpt4_data.numRequestsTotal || 0;
        const maxRequestUsage = "maxRequestUsage" in gpt4_data ? gpt4_data.maxRequestUsage : 999;

        const gpt35_data = data["gpt-3.5-turbo"] || {};
        const maxRequestUsageBasic = gpt35_data.numRequestsTotal || 0;

        return {
            startOfMonth: data.startOfMonth,
            numRequestsTotal,
            maxRequestUsage,
            maxRequestUsageBasic,
            numRequestsTotalBasic: "No Limit",
        };
    } catch (error) {
        console.error("获取使用量信息失败:", error);
        throw error;
    }
};

/**
 * 获取当前系统中的 Cursor 令牌
 * @returns {Promise<string>} Cursor 访问令牌
 */
export const getCursorToken = async () => {
    try {
        // 调用主进程获取 Cursor 信息
        const cursorInfo = await window.api.getCursorInfo();

        if (cursorInfo && cursorInfo.token) {
            return cursorInfo.token;
        } else {
            throw new Error("无法获取 Cursor 令牌");
        }
    } catch (error) {
        console.error("获取 Cursor 令牌失败:", error);
        throw error;
    }
};

/**
 * 获取当前用户的 Cursor 账号信息
 * 包含用户信息和使用情况
 * @returns {Promise<object>} 账号信息对象
 */
export const getCursorAccountInfo = async () => {
    try {
        // 获取 token
        const token = await getCursorToken();

        // 并行获取订阅信息和使用情况
        const [subscriptionInfo, usageInfo] = await Promise.all([getStripeProfile(token), getUsage(token)]);

        // 格式化订阅类型
        let subscriptionType = "免费版";
        if (subscriptionInfo) {
            const membership = subscriptionInfo.membershipType?.toLowerCase() || "";
            const status = subscriptionInfo.subscriptionStatus?.toLowerCase() || "";

            if (status === "active") {
                if (membership === "pro") {
                    subscriptionType = "专业版";
                } else if (membership === "free_trial") {
                    subscriptionType = "免费试用";
                } else if (membership === "pro_trial") {
                    subscriptionType = "专业版试用";
                } else if (membership === "team") {
                    subscriptionType = "团队版";
                } else if (membership === "enterprise") {
                    subscriptionType = "企业版";
                } else if (membership) {
                    subscriptionType = membership;
                }
            } else if (status) {
                subscriptionType = `${membership} (${status})`;
            }
        }

        // 获取邮箱
        const email = subscriptionInfo?.customer?.email || "未知";

        // 返回完整信息
        return {
            email,
            subscriptionType,
            usageInfo,
            // 试用天数
            trialDaysRemaining: subscriptionInfo?.daysRemainingOnTrial || 0,
        };
    } catch (error) {
        console.error("获取账号信息失败:", error);
        throw error;
    }
};

/**
 * 使用Session Token获取API访问令牌
 * @param {string} sessionToken - 会话令牌
 * @returns {Promise<object>} API访问令牌数据
 * @throws {Error} 当获取失败时抛出异常
 */
export const getApiTokens = async (sessionToken) => {
    if (!sessionToken) {
        throw new Error("会话令牌不能为空");
    }

    const url = "https://token.cursorpro.com.cn/reftoken";
    const headers = {
        ...BASE_HEADERS,
    };
    try {
        const data = await request({
            method: "get",
            url: url,
            params: { token: sessionToken },
            headers: headers,
            timeout: 20000, // 10秒超时
        });
        console.log("cursorpro data", data);

        if (data && data.code === 0) {
            return data.data;
        } else {
            throw new Error(data?.msg || "获取API Token失败");
        }
    } catch (error) {
        console.error("获取API访问令牌失败:", error);
        throw error;
    }
};
