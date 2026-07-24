import { defineStore } from "pinia";
import { ElMessageBox } from "element-plus";

export const useAppStore = defineStore("app", {
    state: () => ({
        appConfig: {},
        cursorInfo: {},
        systemInfo: {},

        cursorAccountsInfo: {
            email: "",
            password: undefined,
            register_time: undefined,
            registerTimeStamp: undefined,

            system_type: undefined,
            accessToken: undefined,
            refreshToken: undefined,
            WorkosCursorSessionToken: undefined,

            cachedSignUpType: undefined,
            machineId: undefined,
            macMachineId: undefined,
            devDeviceId: undefined,
            sqmId: undefined,
            machineGuid: undefined,

            machineId_ASCII: undefined,

            modelUsageUsed: undefined,
            modelUsageTotal: undefined,
            membershipType: undefined,
            daysRemainingOnTrial: undefined,
        },
        activeEmail: "",
        isAutoLoginFlow: false,

        appLicenseInfo: {
            status: 3, // 0: 正常  1:服务器错误 2: 许可证过期或验证失败 3: 未找到许可证  11: 需要升级APP版本  12: 用户被封禁
            message: "",
            license: null,
            signature: null,
        },

        aboutNotice: [],
    }),

    actions: {
        async fetchAppConfig() {
            try {
                this.appConfig = (await window.api.getAppConfig()) || {};
                console.log("this.appConfig =>", this.appConfig);
            } catch (error) {
                console.error("Failed to fetch app config:", error);
            }
        },

        async fetchCursorInfo() {
            try {
                this.cursorInfo = (await window.api.getCursorInfo()) || {};
                console.log("this.cursorInfo =>", this.cursorInfo);

                this.setCursorAccountsInfo({
                    email: this.cursorInfo.cachedEmail,
                    accessToken: this.cursorInfo.accessToken,
                    refreshToken: this.cursorInfo.refreshToken,
                    cachedSignUpType: this.cursorInfo.cachedSignUpType,
                });
            } catch (error) {
                console.error("Failed to fetch cursor info:", error);
            }
        },
        async fetchSystemInfo() {
            try {
                this.systemInfo = (await window.api.getSystemInfo()) || {};
                console.log("this.systemInfo =>", this.systemInfo);
                let machineId_ASCII;
                const machineId = this.systemInfo.cursorStorageConfig["telemetry.machineId"];
                if (machineId) {
                    machineId_ASCII = machineId
                        .match(/.{1,2}/g)
                        .map((hex) => String.fromCharCode(parseInt(hex, 16)))
                        .join("");
                }

                this.setCursorAccountsInfo({
                    machineGuid: this.systemInfo.machineGuid,
                    machineId: this.systemInfo.cursorStorageConfig["telemetry.machineId"],
                    macMachineId: this.systemInfo.cursorStorageConfig["telemetry.macMachineId"],
                    devDeviceId: this.systemInfo.cursorStorageConfig["telemetry.devDeviceId"],
                    sqmId: this.systemInfo.cursorStorageConfig["telemetry.sqmId"],
                    machineId_ASCII: machineId_ASCII || "",
                });
            } catch (error) {
                console.error("Failed to fetch system info:", error);
            }
        },

        setAppLicenseInfo(licenseInfo) {
            this.appLicenseInfo = licenseInfo;
            if (this.appLicenseInfo.status === 0) {
                return true;
            } else if (this.appLicenseInfo.status === 1) {
                ElMessageBox.confirm("连接服务器失败", "服务器错误", {
                    confirmButtonText: "确定",
                    showCancelButton: false,
                    type: "warning",
                })
                    .then(async () => {})
                    .catch(() => {});

                return false;
            } else if (this.appLicenseInfo.status === 2 || this.appLicenseInfo.status === 3) {
                ElMessageBox.confirm(this.appLicenseInfo.message || "未获得权限", "权限验证失败", {
                    confirmButtonText: "确定",
                    showCancelButton: false,
                    type: "warning",
                })
                    .then(async () => {})
                    .catch(() => {});
                return false;
            } else if (this.appLicenseInfo.status === 11) {
                ElMessageBox.confirm(this.appLicenseInfo.message || "需要升级APP版本", "升级提示", {
                    confirmButtonText: "确定",
                    showCancelButton: false,
                    type: "warning",
                })
                    .then(async () => {})
                    .catch(() => {});
            } else if (this.appLicenseInfo.status === 12) {
                ElMessageBox.confirm(this.appLicenseInfo.message || "用户已被封禁", "封禁提示", {
                    confirmButtonText: "确定",
                    showCancelButton: false,
                    type: "warning",
                })
                    .then(async () => {})
                    .catch(() => {});
                return false;
            }
        },

        async setCursorAccountsInfo(accountsInfo) {
            this.cursorAccountsInfo = { ...this.cursorAccountsInfo, ...accountsInfo };
        },
        setIsAutoLoginFlow(isAutoLogin) {
            this.isAutoLoginFlow = isAutoLogin;
        },
        setActiveEmail(email) {
            this.activeEmail = email;
        },
        setAboutNotice(aboutNotice) {
            this.aboutNotice = aboutNotice;
        },
    },
});
