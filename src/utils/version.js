/**
 * 比较两个版本号的大小。
 *
 * @param {string} v1 第一个版本号 (例如 "1.2.3")
 * @param {string} v2 第二个版本号 (例如 "1.3.0")
 * @returns {number}
 * - 1: 如果 v1 > v2
 * - -1: 如果 v1 < v2
 * - 0: 如果 v1 === v2
 */
export function compareVersions(v1, v2) {
    if (typeof v1 !== "string" || typeof v2 !== "string") {
        // 或者可以抛出错误，取决于你希望如何处理无效输入
        return 0;
    }

    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);
    const len = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < len; i++) {
        // 如果某个版本号部分不存在，则视为 0
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;

        if (isNaN(p1) || isNaN(p2)) {
            // 处理非数字部分，例如 "1.2.a" vs "1.2.b"
            // 在这种情况下，我们可能还是希望返回0或根据需求处理
            return 0;
        }

        if (p1 > p2) {
            return 1;
        }
        if (p1 < p2) {
            return -1;
        }
    }

    return 0;
}
