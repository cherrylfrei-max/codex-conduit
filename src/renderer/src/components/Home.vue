<script setup>
    import { ref, nextTick, provide, computed } from "vue";
    import { onMounted, onUnmounted } from "vue";
    import { storeToRefs } from "pinia";
    import { useAppStore } from "../stores/app.js";
    // eslint-disable-next-line no-unused-vars
    import { getUsage, getStripeProfile } from "../api/cursor_api.js";
    import AccountManagement from "./AccountManagement.vue";
    import UseAccountConfirmationDialog from "./UseAccountConfirmationDialog.vue";
    import Settings from "./Settings.vue";
    import SettingsDialog from "./SettingsDialog.vue";
    import BackupSettingsDialog from "./BackupSettingsDialog.vue";
    import RestoreBackupDialog from "./RestoreBackupDialog.vue";
    import { Refresh, CircleCheck, WarningFilled, Delete } from "@element-plus/icons-vue";
    import { ElMessage, ElMessageBox } from "element-plus";
    import { jwtDecode } from "jwt-decode";
    const SUBSCRIBE_FREE_NAME = "free";
    const SUBSCRIBE_PRO_NAME = "free_trial";

    const appStore = useAppStore();
    const { cursorInfo, appConfig, systemInfo, cursorAccountsInfo, appLicenseInfo, aboutNotice } =
        storeToRefs(appStore);

    const activeName = ref("first");
    const accountManagementRef = ref(null);
    let unsubscribeLog;
    const isRefreshLoading = ref(false);
    let refreshIntervalId = null;
    const isInitLoading = ref(false);
    const useAccountDialogVisible = ref(false);
    const settingsDialogVisible = ref(false);
    const backupSettingsDialogVisible = ref(false);
    const restoreBackupDialogVisible = ref(false);
    const accountToUse = ref(null);
    const isAdmin = ref(false);
    const loopCount = ref(1);
    const settingsRef = ref(null);
    const logs = ref([]);
    const logScrollbarRef = ref(null);

    const loadingAutoRegister = ref(false);
    const isAutoRegistAndLogin = ref(false);

    const addLog = async ({ level = "info", data }) => {
        const message = `[${new Date().toLocaleTimeString()}] ${data}`;
        logs.value.push({ level, message });
        if (logs.value.length > 400) {
            logs.value.shift();
        }
        await nextTick();
        if (logScrollbarRef.value) {
            const scrollWrapper = logScrollbarRef.value.wrapRef;
            if (scrollWrapper) {
                logScrollbarRef.value.scrollTo({
                    top: scrollWrapper.scrollHeight,
                    behavior: "smooth",
                });
            }
        }
    };

    // 将 addLog 方法通过 provide 暴露给后代组件使用
    provide("addLog", addLog);

    const accountInfoShow = computed(() => {
        let info = { ...cursorAccountsInfo.value };
        info.membershipTypeShow = checkMembershipType(info);
        console.log("membershipTypeShow :>> ", info.membershipTypeShow);

        info.accessTokenExpStatus = checkAccessTokenExpireTime(info.accessToken);

        return info;
    });

    const versionText = computed(() => {
        // const name = appConfig.value.appName || "";
        const ver = appConfig.value.version || "";
        return `${ver}`.trim();
    });

    const signatureText = computed(() => appLicenseInfo.value?.signature || "");

    const checkAdminRights = async () => {
        isAdmin.value = await window.api.checkAdminRights();
    };

    onMounted(async () => {
        // 监听来自主进程的日志
        unsubscribeLog = window.api.onLog(handleLogFromMain);
        isInitLoading.value = true;
        try {
            await Promise.allSettled([
                window.api.getAppLicenseInfo(),
                window.api.initAppConfig(),
                window.api.renderOnMounted(),
                checkAdminRights(),
            ]);
        } catch (error) {
            console.error("初始化路径失败", error);
        } finally {
            isInitLoading.value = false;
        }
        await refresh();
    });

    onUnmounted(() => {
        // 组件卸载时取消监听
        if (unsubscribeLog) {
            unsubscribeLog();
        }
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
        }
    });

    const handleLogFromMain = async (log) => {
        const { level, data } = log;
        switch (level) {
            case "info":
            case "success":
            case "warning":
            case "error":
                await addLog(log);
                break;
            case "begin":
                loadingAutoRegister.value = true;
                break;
            case "end":
                loadingAutoRegister.value = false;
                break;
            case "account": {
                const isAutoLoginFlow = appStore.isAutoLoginFlow;
                if (isAutoLoginFlow) {
                    // 自动登录，并重置机器码
                    await addLog({ level: "info", data: "正在使用新账号登录..." });
                    await window.api.resetCursorAccount({
                        ...data,
                        isResetMachines: true,
                        isResetCursor: true,
                        isResetCursorAll: false,
                    });
                    await addLog({ level: "info", data: "登录完成" });
                    await refresh();
                }
                break;
            }
            case "license": {
                appStore.setAppLicenseInfo(data);
                break;
            }
            case "license-error": {
                ElMessage.error(data);
                addLog({ level: "error", data: data });
                break;
            }
            case "box-tips": {
                ElMessageBox.confirm(data.message, data.title || "提示", {
                    confirmButtonText: "确定",
                    showCancelButton: false,
                    type: data.type || "",
                });
                break;
            }
            case "log-tips": {
                addLog({ level: "warning", data: data });
                break;
            }
            case "about-notice": {
                appStore.setAboutNotice(data);
                break;
            }
            default:
                break;
        }
    };

    const handleClick = (tab, event) => {
        console.log(tab, event);
        if (tab.props.name === "second") {
            accountManagementRef.value?.fetchAccounts();
        }
        if (tab.props.name === "fourth") {
            settingsRef.value?.updateConfig();
        }
    };

    const refresh = async () => {
        if (isRefreshLoading.value) return;
        await window.api.initAppConfig(); //初始化路径
        isRefreshLoading.value = true;
        const timeStart = Date.now();
        try {
            await Promise.allSettled([
                appStore.fetchCursorInfo(),
                appStore.fetchAppConfig(),
                appStore.fetchSystemInfo(),
            ]);
            if (!cursorAccountsInfo.value.accessToken || !cursorAccountsInfo.value.email) {
                throw new Error("未登录");
            }

            await getStripeProfile(cursorAccountsInfo.value.accessToken)
                .then((stripeProfileResult) => {
                    console.log("home stripeProfileResult :>> ", stripeProfileResult);
                    appStore.setCursorAccountsInfo({
                        membershipType: stripeProfileResult.membershipType,
                        daysRemainingOnTrial: stripeProfileResult.daysRemainingOnTrial,
                    });
                    addLog({ level: "info", data: "更新订阅信息成功" });
                })
                .catch(() => {
                    addLog({ level: "error", data: "更新订阅信息失败" });
                });

            // addLog({ level: "info", data: "刷新订阅信息成功" });
            // let usageResult = await getUsage(accessToken);
            // updateData.modelUsageUsed = usageResult.numRequestsTotal || 0;
            // updateData.modelUsageTotal = usageResult.maxRequestUsage || 0;
            // updateData.registerTimeStamp = new Date(usageResult.startOfMonth).getTime();
        } catch (error) {
            console.error(error);
            addLog({ level: "error", data: "刷新页面信息失败" });
            // ElMessage.error("刷新失败");
            // ElMessage.error("刷新订阅信息失败");
        } finally {
            await window.api.accounts.createOrUpdateAccount(JSON.parse(JSON.stringify(cursorAccountsInfo.value)));

            const timeEnd = Date.now();
            setTimeout(
                () => {
                    isRefreshLoading.value = false;
                },
                2000 - ((timeEnd - timeStart) % 2000)
            );
            console.log("cursorInfo :>> ", cursorInfo.value);

            if (refreshIntervalId) {
                clearInterval(refreshIntervalId);
            }
            // refreshIntervalId = setInterval(refresh, 10 * 60 * 1000);

            console.log("cursorAccountsInfo :>> ", appStore.cursorAccountsInfo);
        }
    };

    const showUseAccountDialog = (account) => {
        accountToUse.value = account;
        useAccountDialogVisible.value = true;
    };

    // 切换账号
    const handleConfirmUseAccount = async (data) => {
        const account = Object.assign({}, accountToUse.value, data);

        console.log("准备使用账号 :>> ", account.email);

        try {
            let result = await window.api.resetCursorAccount(JSON.parse(JSON.stringify(account)));
            useAccountDialogVisible.value = false;
            if (result.success) {
                ElMessage.success("切换账号成功");
            } else {
                ElMessage.error("切换账号失败");
            }

            await refresh();
        } catch (error) {
            console.error(error);
            ElMessage.error("切换账号失败");
        }
    };

    const checkAccessTokenExpireTime = (token) => {
        if (typeof token !== "string") return null;

        try {
            const decodedToken = jwtDecode(token);
            // 检查解码后的 token 是否有 exp 字段
            if (decodedToken && typeof decodedToken.exp === "number") {
                let expTimestamp = decodedToken.exp * 1000; // 返回毫秒级时间戳
                const now = Date.now();

                const remainingMilliseconds = expTimestamp - now;
                if (remainingMilliseconds < 0) {
                    return {
                        label: "已过期",
                        type: "danger",
                        isExpired: true,
                    };
                }
                const days = Math.floor(remainingMilliseconds / (1000 * 60 * 60 * 24));
                if (days > 0) {
                    return {
                        label: `${days}天`,
                        type: "success",
                        isExpired: false,
                    };
                }

                const hours = Math.floor(remainingMilliseconds / (1000 * 60 * 60));
                if (hours > 0) {
                    return {
                        label: `${hours}小时`,
                        type: "warning",
                        isExpired: false,
                    };
                }

                // 小于一小时，显示分钟。向上取整以避免显示0分钟。
                const minutes = Math.ceil(remainingMilliseconds / (1000 * 60));
                return {
                    label: `${minutes}分钟`,
                    type: "danger",
                    isExpired: false,
                };
            }
        } catch {
            // 解码失败，不是有效的JWT，继续尝试下一个
            console.warn("JWT decoding failed for a token, continuing...");
            return null;
        }
    };

    const checkMembershipType = (info) => {
        let remainingDays = info.daysRemainingOnTrial
            ? info.daysRemainingOnTrial
            : calculateRemainingDays(info.registerTimeStamp);
        if (info.membershipType === SUBSCRIBE_FREE_NAME) {
            remainingDays = 0;
        }
        let membershipTypeShow = "";
        if (info.membershipType === SUBSCRIBE_FREE_NAME) {
            membershipTypeShow = "（已失效）" + info.membershipType;
        } else if (info.membershipType === SUBSCRIBE_PRO_NAME) {
            membershipTypeShow = "（" + remainingDays + "天试用）" + info.membershipType;
        } else if (info.membershipType) {
            membershipTypeShow = info.membershipType;
            remainingDays = 999;
        } else {
            membershipTypeShow = "";
        }
        return membershipTypeShow;
    };

    /**
     * 计算剩余天数
     * @param {string} registerTime - 格式为 "YYYY-MM-DD HH:MM:SS" 的注册时间
     * @returns {number} 剩余天数
     */
    const calculateRemainingDays = (registerTime) => {
        if (!registerTime) return 0;
        const now = new Date();
        const registerDate = new Date(registerTime);
        // 15天后过期
        const expiryDate = new Date(new Date(registerTime).setDate(registerDate.getDate() + 15));

        // 如果已过期，返回0
        if (now > expiryDate) {
            return 0;
        }

        // 计算剩余毫秒数并转换为天数
        const remainingMilliseconds = expiryDate - now;
        // 计算剩余天数，1天=24小时*60分钟*60秒*1000毫秒，向上取整保证有剩余时间时显示为1天
        const remainingDays = Math.ceil(remainingMilliseconds / (1000 * 60 * 60 * 24));
        return remainingDays;
    };

    const resetMachine = async () => {
        ElMessageBox.confirm("确定要重置机器码？依赖机器码的软件可能失效，此操作需要管理员权限", "重置机器码", {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            type: "warning",
        })
            .then(async () => {
                await window.api.setRandomMachineInfo();
                await appStore.fetchSystemInfo();
                await appStore.fetchCursorInfo();
                ElMessage.success("机器码已重置");
            })
            .catch(() => {
                // ElMessage.info("已取消重置机器码");
            });
    };

    const backup = async () => {
        backupSettingsDialogVisible.value = true;
    };

    const restoreBackup = async () => {
        restoreBackupDialogVisible.value = true;
    };

    const autoRegisterAndLogin = async () => {
        if (loadingAutoRegister.value) {
            ElMessage.error("正在执行注册程序，请稍后再试");
            return;
        }

        const { RECEIVING_EMAIL, RECEIVING_EMAIL_PIN, EMAIL_DOMAIN } = appConfig.value;

        if (!RECEIVING_EMAIL || !RECEIVING_EMAIL_PIN || !EMAIL_DOMAIN) {
            settingsDialogVisible.value = true;
            return;
        }

        const emailRegex =
            /[\w!#$%&'*+/=?^_`{|}~-]+(?:\.[\w!#$%&'*+/=?^_`{|}~-]+)*@(?:[\w](?:[\w-]*[\w])?\.)+[\w](?:[\w-]*[\w])?/;
        if (!emailRegex.test(RECEIVING_EMAIL)) {
            ElMessage.error("收件邮箱格式不正确，请修改");
            settingsDialogVisible.value = true;
            return;
        }

        ElMessageBox.confirm("确定要一键注册并使用新账号登录吗？此操作将重置机器码、覆盖登录账号。", "一键注册登录", {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            type: "warning",
        })
            .then(() => {
                try {
                    isAutoRegistAndLogin.value = true;
                    // ElMessage.success("已开始一键注册登录，请关注日志输出...");
                    addLog({ data: "开始一键注册登录..." });
                    appStore.setIsAutoLoginFlow(true);
                    window.api.runAutoRegister({
                        email: RECEIVING_EMAIL,
                        pin: RECEIVING_EMAIL_PIN,
                        domain: EMAIL_DOMAIN,
                        LOOP_COUNT: 1, // 只注册一个
                    });
                } catch (e) {
                    console.error(e);
                    ElMessage.error("一键注册登录过程中发生错误");
                    addLog({ level: "error", data: `一键注册登录过程中发生错误: ${e.message}` });
                    appStore.setIsAutoLoginFlow(false);
                }
            })
            .catch(() => {
                // ElMessage.info("已取消一键注册登录");
            });
    };

    const autoRegister = async () => {
        if (loadingAutoRegister.value) {
            ElMessage.error("正在执行注册程序，请稍后再试");
            return;
        }

        const { RECEIVING_EMAIL, RECEIVING_EMAIL_PIN, EMAIL_DOMAIN } = appConfig.value;

        if (!RECEIVING_EMAIL || !RECEIVING_EMAIL_PIN || !EMAIL_DOMAIN) {
            settingsDialogVisible.value = true;
            return;
        }

        const emailRegex =
            /[\w!#$%&'*+/=?^_`{|}~-]+(?:\.[\w!#$%&'*+/=?^_`{|}~-]+)*@(?:[\w](?:[\w-]*[\w])?\.)+[\w](?:[\w-]*[\w])?/;
        if (!emailRegex.test(RECEIVING_EMAIL)) {
            ElMessage.error("收件邮箱格式不正确，请修改");
            settingsDialogVisible.value = true;
            return;
        }
        loopCount.value = 1; // 重置循环次数

        let registerNum = appStore.appLicenseInfo?.license?.permissions?.registerNum || 2;
        ElMessageBox.prompt("请输入批量注册的数量，注册过多可能被封域名", "批量自动注册", {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            customClass: "auto-register-dialog",
            inputValue: loopCount.value,
            inputPattern: /^\d+$/,
            inputValidator: (value) => {
                const num = Number(value);
                if (!Number.isInteger(num) || num < 1 || num > registerNum) {
                    return `请输入1到${registerNum}之间的整数`;
                }
                return true;
            },
        })
            .then(({ value }) => {
                loopCount.value = parseInt(value, 10);
                try {
                    isAutoRegistAndLogin.value = false;
                    // ElMessage.success("已开始批量自动注册，请关注日志输出...");
                    // addLog({ data: `开始批量自动注册，共 ${loopCount.value} 次...` });
                    window.api.runAutoRegister({
                        email: RECEIVING_EMAIL,
                        pin: RECEIVING_EMAIL_PIN,
                        domain: EMAIL_DOMAIN,
                        LOOP_COUNT: loopCount.value,
                        AUTO_LOGIN: false,
                    });
                } catch (e) {
                    console.error(e);
                    ElMessage.error("批量自动注册过程中发生错误");
                    addLog({ level: "error", data: `批量自动注册过程中发生错误: ${e.message}` });
                }
            })
            .catch(() => {
                // addLog({ data: "已取消批量自动注册" });
                // ElMessage.info("已取消批量自动注册");
            });
    };

    const cancelAutoRegister = () => {
        if (loadingAutoRegister.value) {
            ElMessageBox.confirm("正在执行注册程序，确定要取消吗？", "提示", {
                confirmButtonText: "确定",
                cancelButtonText: "取消",
                type: "warning",
            }).then(async () => {
                await window.api.cleanupAutoRegister();
                addLog({ level: "warning", data: "正在取消自动注册程序..." });
            });
        }
    };

    const clearLogs = () => {
        logs.value = [];
    };

    const openLink = (url) => {
        if (url) {
            window.api.openExternalLink(url);
        }
    };
</script>

<template>
    <div v-loading="isInitLoading" class="body-card">
        <el-tabs v-model="activeName" class="demo-tabs" @tab-click="handleClick">
            <el-tab-pane label="首页" name="first">
                <div class="body-card-item">
                    <el-scrollbar>
                        <div class="card-container">
                            <el-card style="">
                                <div class="card-header">
                                    <span>当前登录账号</span>
                                </div>
                                <p class="card-item">
                                    <span class="card-item-label">登录邮箱:</span>
                                    <span
                                        :class="{
                                            'is-expired': !cursorAccountsInfo.email,
                                            'is-trial': cursorAccountsInfo.email,
                                        }"
                                    >
                                        {{ cursorAccountsInfo.email || "未登录" }}
                                    </span>
                                </p>
                                <p class="card-item">
                                    <span class="card-item-label">订阅状态:</span>
                                    <span
                                        :class="{
                                            'is-expired': accountInfoShow.membershipType === SUBSCRIBE_FREE_NAME,
                                            'is-trial': accountInfoShow.membershipType === SUBSCRIBE_PRO_NAME,
                                        }"
                                    >
                                        {{ accountInfoShow.membershipTypeShow }}
                                    </span>
                                </p>
                                <!-- <p class="card-item">
                                    <span class="card-item-label">令牌时效:</span>
                                    <span
                                        v-if="accountInfoShow.accessTokenExpStatus"
                                        size="small"
                                        :type="accountInfoShow.accessTokenExpStatus.type"
                                    >
                                        {{ accountInfoShow.accessTokenExpStatus.label }}
                                    </span>
                                </p> -->
                                <p class="card-item">
                                    <span class="card-item-label">模型用量:</span>
                                    <template v-if="accountInfoShow.modelUsageTotal">
                                        <span
                                            >{{ accountInfoShow.modelUsageUsed }} /
                                            {{ accountInfoShow.modelUsageTotal }}
                                        </span>
                                        <el-progress
                                            class="model-usage-progress"
                                            :percentage="
                                                accountInfoShow.modelUsageTotal
                                                    ? (accountInfoShow.modelUsageUsed /
                                                          accountInfoShow.modelUsageTotal) *
                                                      100
                                                    : 0
                                            "
                                            :show-text="false"
                                            :stroke-width="10"
                                            striped
                                            striped-flow
                                            :duration="15"
                                        />
                                    </template>
                                    <template v-else>
                                        <span class="is-trial">无限制</span>
                                    </template>
                                </p>
                                <el-icon
                                    class="refresh-icon"
                                    :class="{ 'is-loading': isRefreshLoading }"
                                    :size="20"
                                    @click="refresh"
                                    ><Refresh
                                /></el-icon>
                            </el-card>
                            <el-card style="">
                                <div class="card-header">
                                    <span>版本信息</span>
                                </div>
                                <p class="card-item">
                                    <span class="card-item-label"> 版本: </span>
                                    <span v-if="systemInfo.platform === 'win32'">Windows</span>
                                    <span v-else-if="systemInfo.platform === 'darwin'">Mac</span>
                                    <span v-else-if="systemInfo.platform === 'linux'">Linux</span>
                                    <span v-else-if="systemInfo.platform">未知</span>
                                    <span v-else></span>
                                    &nbsp;|&nbsp;
                                    <span>{{ appConfig.appName }}{{ appConfig.version }}</span>
                                    &nbsp;|&nbsp;
                                    <span> Cursor {{ appConfig.cursorVersion }} </span>
                                </p>

                                <p class="card-item">
                                    <span class="card-item-label">machineGuid:</span>
                                    <span class="card-item-value">{{ cursorAccountsInfo.machineGuid }}</span>
                                </p>
                                <p class="card-item">
                                    <span class="card-item-label">machineId:</span>
                                    <span class="card-item-value">{{ cursorAccountsInfo.machineId }}</span>
                                </p>
                                <!-- <p class="card-item">
                                    <span class="card-item-label">machineId_ASCII:</span>
                                    <span>{{ cursorAccountsInfo.machineId_ASCII }}</span>
                                </p>
                                <p class="card-item">
                                    <span class="card-item-label">macMachineId:</span>
                                    <span>{{ cursorAccountsInfo.macMachineId }}</span>
                                </p>
                                <p class="card-item">
                                    <span class="card-item-label">devDeviceId:</span>
                                    <span>{{ cursorAccountsInfo.devDeviceId }}</span>
                                </p>
                                <p class="card-item">
                                    <span class="card-item-label">sqmId:</span>
                                    <span>{{ cursorAccountsInfo.sqmId }}</span>
                                </p> -->

                                <el-icon
                                    v-if="false"
                                    class="refresh-icon"
                                    :class="{ 'is-loading': isRefreshLoading }"
                                    :size="20"
                                    @click="refresh"
                                    ><Refresh
                                /></el-icon>
                            </el-card>
                        </div>
                        <div class="card-container">
                            <el-card style="">
                                <div class="card-header" style="margin-bottom: 3px">
                                    <span>功能</span>
                                </div>

                                <el-tooltip
                                    :visible="
                                        !appConfig.EMAIL_DOMAIN ||
                                        !appConfig.RECEIVING_EMAIL ||
                                        !appConfig.RECEIVING_EMAIL_PIN
                                            ? undefined
                                            : false
                                    "
                                    content="设置域名后启用注册功能"
                                    effect="customized"
                                    placement="right"
                                >
                                    <p class="card-item check-item">
                                        <span class="card-item-label">设置域名和收验证码邮箱</span>
                                        <span
                                            v-if="
                                                appConfig.EMAIL_DOMAIN &&
                                                appConfig.RECEIVING_EMAIL &&
                                                appConfig.RECEIVING_EMAIL_PIN
                                            "
                                        >
                                            <el-icon class="check-icon" :size="20" style="color: #67c23a"
                                                ><CircleCheck
                                            /></el-icon>
                                        </span>
                                        <span v-else>
                                            <el-icon class="check-icon" :size="20" style="color: #f56c6c"
                                                ><WarningFilled
                                            /></el-icon>
                                        </span>
                                    </p>
                                </el-tooltip>

                                <el-tooltip
                                    :visible="!isAdmin ? undefined : false"
                                    content="请以管理员身份启动，否则功能受限"
                                    effect="customized"
                                    placement="right"
                                >
                                    <p class="card-item check-item">
                                        <span class="card-item-label">以管理员身份启动</span>
                                        <span v-if="isAdmin">
                                            <el-icon class="check-icon" :size="20" style="color: #67c23a"
                                                ><CircleCheck
                                            /></el-icon>
                                        </span>
                                        <span v-else>
                                            <el-icon class="check-icon" :size="20" style="color: #f56c6c"
                                                ><WarningFilled
                                            /></el-icon>
                                        </span>
                                    </p>
                                </el-tooltip>

                                <el-tooltip
                                    :visible="!appConfig.path_cursor_exe ? undefined : false"
                                    content="未找到Cursor安装路径，打开Cursor后点击刷新重新查找"
                                    effect="customized"
                                    placement="right"
                                >
                                    <p class="card-item check-item">
                                        <span class="card-item-label">获取 Cursor 安装路径</span>
                                        <span v-if="appConfig.path_cursor_exe">
                                            <el-icon class="check-icon" :size="20" style="color: #67c23a"
                                                ><CircleCheck
                                            /></el-icon>
                                        </span>
                                        <span v-else>
                                            <el-icon class="check-icon" :size="20" style="color: #f56c6c"
                                                ><WarningFilled
                                            /></el-icon>
                                        </span>
                                    </p>
                                </el-tooltip>

                                <el-tooltip
                                    :visible="!appConfig.path_cursor_user_db ? undefined : false"
                                    content="未找到Cursor数据文件路径，建议安装默认路径"
                                    effect="customized"
                                    placement="right"
                                >
                                    <p class="card-item check-item">
                                        <span class="card-item-label">获取 Cursor 数据文件路径</span>
                                        <span v-if="appConfig.path_cursor_user_db">
                                            <el-icon class="check-icon" :size="20" style="color: #67c23a"
                                                ><CircleCheck
                                            /></el-icon>
                                        </span>
                                        <span v-else>
                                            <el-icon class="check-icon" :size="20" style="color: #f56c6c"
                                                ><WarningFilled
                                            /></el-icon>
                                        </span>
                                    </p>
                                </el-tooltip>

                                <el-tooltip
                                    :visible="!appConfig.path_chrome ? undefined : false"
                                    content="未找到浏览器路径，注册功能可能失败"
                                    effect="customized"
                                    placement="right"
                                >
                                    <p class="card-item check-item">
                                        <span class="card-item-label">获取 Chrome 浏览器路径</span>
                                        <span v-if="appConfig.path_chrome">
                                            <el-icon class="check-icon" :size="20" style="color: #67c23a"
                                                ><CircleCheck
                                            /></el-icon>
                                        </span>
                                        <span v-else>
                                            <el-icon class="check-icon" :size="20" style="color: #f56c6c"
                                                ><WarningFilled
                                            /></el-icon>
                                        </span>
                                    </p>
                                </el-tooltip>
                                <p class="card-item btn-item">
                                    <span class="card-item-label">一键注册登录</span>
                                    <el-button
                                        v-if="loadingAutoRegister && isAutoRegistAndLogin === true"
                                        @click="cancelAutoRegister"
                                    >
                                        取消
                                    </el-button>
                                    <el-button
                                        :loading="loadingAutoRegister && isAutoRegistAndLogin === true"
                                        @click="autoRegisterAndLogin"
                                        >一键注册登录</el-button
                                    >
                                </p>

                                <p class="card-item btn-item">
                                    <span class="card-item-label">自动注册账号</span>
                                    <el-button
                                        v-if="loadingAutoRegister && isAutoRegistAndLogin === false"
                                        @click="cancelAutoRegister"
                                    >
                                        取消
                                    </el-button>
                                    <el-button
                                        :loading="loadingAutoRegister && isAutoRegistAndLogin === false"
                                        @click="autoRegister"
                                        >批量自动注册</el-button
                                    >
                                </p>
                                <p class="card-item btn-item">
                                    <span class="card-item-label">重置机器码</span>
                                    <el-button @click="resetMachine">重置机器码</el-button>
                                </p>
                                <p class="card-item btn-item">
                                    <span class="card-item-label">备份Cursor设置、快捷键...</span>
                                    <el-button @click="backup">备份设置</el-button>
                                </p>
                                <p class="card-item btn-item">
                                    <span class="card-item-label">备份恢复</span>
                                    <el-button @click="restoreBackup">备份恢复</el-button>
                                </p>
                                <!-- <p class="card-item btn-item">
                                    <span class="card-item-label">阻止更新</span>
                                    <el-button @click="restoreBackup">阻止更新</el-button>
                                </p> -->
                            </el-card>
                            <el-card class="log-card" style="">
                                <div class="card-header">
                                    <span>日志</span>
                                    <el-icon
                                        class="refresh-icon clear-logs-icon"
                                        style="font-size: 16px; right: 25px; top: 18px"
                                        @click="clearLogs"
                                        ><Delete
                                    /></el-icon>
                                </div>
                                <el-scrollbar ref="logScrollbarRef" class="log-container">
                                    <p
                                        v-for="(log, index) in logs"
                                        :key="index"
                                        class="log-item"
                                        :class="`log-item-${log.level}`"
                                    >
                                        {{ log.message }}
                                    </p>
                                </el-scrollbar>
                            </el-card>
                        </div>
                    </el-scrollbar>
                </div>
            </el-tab-pane>
            <el-tab-pane label="账号" name="second">
                <div class="body-card-item">
                    <AccountManagement ref="accountManagementRef" @show-use-account-dialog="showUseAccountDialog" />
                </div>
            </el-tab-pane>
            <!-- <el-tab-pane label="功能" name="third">
                <div class="body-card-item">
                    <el-scrollbar>
                        <el-button type="primary" @click="register">注册</el-button>
                    </el-scrollbar>
                </div>
            </el-tab-pane> -->
            <el-tab-pane label="设置" name="fourth">
                <div class="body-card-item">
                    <Settings ref="settingsRef" />
                </div>
            </el-tab-pane>

            <el-tab-pane label="关于" name="fifth">
                <el-scrollbar>
                    <div class="body-card-item" style="padding-top: 20px">
                        <div class="about-notice-container">
                            <div
                                v-for="(notice, index) in aboutNotice"
                                :key="index"
                                class="about-notice-item"
                                :class="{ 'has-link': notice.url }"
                                :style="{
                                    color: notice.color || (notice.url ? 'var(--el-color-primary)' : ''),
                                    'font-size': notice.fontSize || '',
                                }"
                                @click="notice.url ? openLink(notice.url) : null"
                            >
                                {{ notice.title }}: {{ notice.message }}
                            </div>
                        </div>

                        <div class="license-display">
                            <div>Fly Cursor {{ versionText }}</div>
                            <div>联系QQ：3663856429</div>
                            <div v-if="signatureText">{{ signatureText }}</div>
                        </div>
                    </div>
                </el-scrollbar>
            </el-tab-pane>
        </el-tabs>
        <UseAccountConfirmationDialog
            v-model="useAccountDialogVisible"
            :account="accountToUse"
            @confirm="handleConfirmUseAccount"
        />
        <SettingsDialog v-model="settingsDialogVisible" />
        <BackupSettingsDialog v-model="backupSettingsDialogVisible" />
        <RestoreBackupDialog v-model="restoreBackupDialogVisible" />
    </div>
</template>

<style lang="scss" scoped>
    // .body-card {
    //     font-size: 20px;
    // }
    // .el-tabs__item.is-active {
    //     // background-color: #262c321c;
    // }

    :deep(.el-tabs__item) {
        color: var(--ev-c-text-1);
        user-select: none;
    }
    :deep(.el-tabs__nav-wrap::after) {
        background-color: #f8f9fa26;
    }
    .body-card-item {
        position: relative;
        height: calc(100vh - 120px);
        padding: 10px;
        background-color: #f8f9fa26;
        // box-shadow: 0 0 5px 0px rgb(64 64 64 / 50%);
        box-shadow: 0 5px 25px rgba(0, 0, 0, 0.05);
        border-radius: 10px;

        .card-container {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 10px;
            .el-card {
                flex: 1;
                position: relative;
                --el-card-bg-color: #f8f9fa0a;
                --el-card-border-color: #f8f9fa00;
                --el-card-border-radius: 10px;

                color: var(--ev-c-text-1);
                max-width: 1880px;
                min-width: 300px;
                :deep(.el-card__body) {
                    padding-top: 10px;
                }
                &.log-card {
                    // height: 100%;
                    :deep(.el-card__body) {
                        // height: 100%;
                        height: 450px;
                        display: flex;
                        flex-direction: column;
                        .el-scrollbar {
                            flex-grow: 1;
                            min-height: 0;
                            padding-bottom: 0;
                            padding-top: 0;
                            .el-scrollbar__view {
                                padding-bottom: 10px;
                            }
                        }
                    }
                }
                .card-header {
                    font-size: 16px;
                    font-weight: 800;
                    color: var(--el-color-primary);
                    user-select: none;
                    .clear-logs-icon {
                        cursor: pointer;
                        position: absolute;
                        right: 20px;
                        top: 20px;
                        color: var(--ev-c-text-2);
                        &:hover {
                            color: var(--el-color-primary);
                        }
                    }
                }
                .card-item {
                    display: flex;
                    font-size: 14px;
                    margin-top: 10px;
                    word-break: break-all;
                    &.check-item {
                        align-items: center;
                        justify-content: space-between;
                        margin-top: 0px;
                    }
                    &.btn-item {
                        align-items: center;
                        justify-content: space-between;
                        .el-button {
                            color: var(--ev-c-text-1);
                            --el-button-bg-color: #ffffff15;
                            --el-button-border-color: #ffffff15;

                            &:hover {
                                color: var(--el-color-primary);
                            }
                        }
                    }

                    .card-item-label {
                        flex-grow: 1;
                        flex-shrink: 0;
                        color: rgba(255, 255, 255, 0.308);
                        display: inline-block;
                        // min-width: 100px;
                        margin-right: 10px;
                        user-select: none;
                    }
                    .card-item-value {
                        display: inline-block;
                        max-width: 38ch;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        direction: rtl;
                        text-align: left;
                        vertical-align: bottom;
                        // margin-left: 30px;
                    }
                    .is-trial {
                        color: #67c23a;
                    }
                    .is-expired {
                        color: #f56c6c;
                    }
                }
                .refresh-icon {
                    cursor: pointer;
                    position: absolute;
                    right: 20px;
                    top: 20px;
                    &:hover {
                        color: var(--el-color-primary);
                    }
                }
            }
            .model-usage-progress {
                margin-top: 10px;
                .el-progress-bar__outer {
                    background-color: #f8f9fa1f;
                }
            }
            .log-container {
                margin-top: 10px;
                background-color: #0000001a;
                padding: 0;
                border-radius: 5px;
                font-size: 12px;
                :deep(.el-scrollbar__view) {
                    padding: 10px;
                }
                .log-item {
                    margin: 0;
                    padding: 2px 0;
                    color: var(--ev-c-text-2);
                    word-break: break-all;
                    white-space: pre-wrap;
                }
                .log-item-error {
                    color: #f56c6c;
                }
                .log-item-account {
                    color: #67c23a;
                }
                .log-item-success {
                    color: #67c23a;
                }
                .log-item-warning {
                    color: #e6a23c;
                }
            }
        }
    }

    .license-display {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 12px;
        opacity: 0.5;
        color: var(--ev-c-text-1);
        white-space: pre-wrap;
        text-align: center;
    }

    /* about notice */
    .about-notice-item {
        margin-bottom: 10px;
        text-align: center;

        &.has-link {
            cursor: pointer;
            text-decoration: underline;
        }
    }
</style>
