<script setup>
    import { ElMessage, ElMessageBox } from "element-plus";
    // eslint-disable-next-line no-unused-vars
    import { getStripeProfile, getUsage, getApiTokens } from "../api/cursor_api";
    import { jwtDecode } from "jwt-decode";
    import { useAppStore } from "../stores/app";
    import { storeToRefs } from "pinia";
    import { UserFilled } from "@element-plus/icons-vue";
    const emit = defineEmits(["show-use-account-dialog"]);

    const appStore = useAppStore();
    const { cursorAccountsInfo } = storeToRefs(appStore);
    // --- 响应式状态定义 ---

    const allData = ref([]); // 从后端获取的所有数据
    const loading = ref(true); // 加载状态，默认为true
    const multipleSelection = ref([]); // 多选中的行
    const rowLoadingState = ref({}); // 存储每行的加载状态，使用email作为键
    const rowLoadingStateSessionToken = ref({}); // 存储每行的加载状态，使用email作为键
    const isShowUpdateSessionTokenConst = false; // 是否显示更新会话令牌按钮

    // 分页状态
    const pagination = reactive({
        currentPage: 1,
        pageSize: 100,
        total: 0,
    });
    const SUBSCRIBE_FREE_NAME = "free";
    const SUBSCRIBE_PRO_NAME = "free_trial";
    // 排序状态
    const sortOptions = reactive({
        prop: "register_time",
        order: "descending", // "ascending" 或 "descending"
    });

    // 对话框与表单状态
    const dialogVisible = ref(false);
    const formRef = ref(null);
    const accountForm = ref({
        email: "",
        accessToken: "",
        // ... 其他字段可以按需添加
    });
    const formRules = {
        email: [{ required: true, message: "请输入邮箱地址", trigger: "blur" }],
        accessToken: [{ required: true, message: "请输入token", trigger: "blur" }],
    };

    // 进度条状态
    const progressState = reactive({
        visible: false,
        title: "",
        percentage: 0,
        message: "",
        handleId: null,
        status: "",
    });

    const resetProgressState = () => {
        progressState.handleId = null;
    };

    // --- 计算属性 ---

    // 分页布局
    const paginationLayout = computed(() => {
        // 当总条目数不大于每页大小时（即只有一页或没有数据），只显示总数和每页条数选择
        if (pagination.total < 11) {
            return "total";
        }

        if (pagination.total <= pagination.pageSize) {
            return "total,sizes";
        }

        const totalPages = Math.ceil(pagination.total / pagination.pageSize);
        let baseLayout = "total, sizes, prev, pager, next";

        // 如果总页数大于7，则添加跳转控件
        if (totalPages > 7) {
            return baseLayout + ", jumper";
        }

        return baseLayout;
    });

    // 将 progressState.status 映射到 el-progress 的 status
    const progressStatus = computed(() => {
        switch (progressState.status) {
            case "finished":
                return "success";
            case "error":
                return "exception";
            case "warning":
                return "warning";
            default:
                return ""; // el-progress status 为空字符串时，显示默认主题色
        }
    });

    // --- 生命周期钩子 ---

    let cleanupMainProcessListener = null;

    onMounted(() => {
        // fetchAccounts();
        // 监听主进程的消息，用于更新进度
        cleanupMainProcessListener = window.api.onMainProcessMessage((eventData) => {
            // 检查是否是进度消息，并且handleId匹配当前操作
            if (eventData.type === "progress" && eventData.handleId === progressState.handleId) {
                progressState.percentage =
                    eventData.total > 0 ? Math.round((eventData.processed / eventData.total) * 100) : 0;
                progressState.message = eventData.message;
                progressState.status = eventData.status;
                if (eventData.status === "finished" || eventData.status === "error") {
                    // 进度完成后由用户手动关闭
                }
            }
        });
    });

    onUnmounted(() => {
        if (cleanupMainProcessListener) {
            cleanupMainProcessListener();
        }
    });

    // --- 工具函数 ---

    const getTokenExpTimestamp = (inputString) => {
        if (typeof inputString !== "string") {
            return null;
        }
        const match = inputString.match(/ey[^ ]*$/);
        if (!match) {
            return null;
        }
        const token = match[0];

        try {
            const decodedToken = jwtDecode(token);
            if (decodedToken && typeof decodedToken.exp === "number") {
                return decodedToken.exp * 1000;
            }
        } catch {
            // 解码失败，不是有效的JWT，继续尝试下一个
            console.warn("JWT decoding failed for a token, continuing...");
        }
        return null;
    };

    // 获取真实的token
    const getRealAccessToken = (inputString) => {
        if (typeof inputString !== "string") {
            return "";
        }
        const match = inputString.match(/ey[^ ]*$/);
        if (!match) {
            return "";
        }
        return match[0];
    };
    const formatExpTimestamp = (expTimestamp) => {
        if (!expTimestamp) {
            return {
                label: "无令牌",
                type: "danger",
                isExpired: true,
            };
        }
        const now = Date.now();
        if (expTimestamp < now) {
            return {
                label: "已过期",
                type: "danger",
                isExpired: true,
            };
        }

        const remainingMilliseconds = expTimestamp - now;

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
        const remainingDays = Math.ceil(remainingMilliseconds / (1000 * 60 * 60 * 24));
        return remainingDays;
    };

    /**
     * 格式化时间戳
     * @param {number} timestamp - 时间戳 (毫秒)
     * @returns {string|null} 格式化后的日期时间字符串 "YYYY-MM-DD HH:MM:SS" 或 null
     */
    const formatTimestamp = (timestamp) => {
        if (!timestamp) {
            return null;
        }
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const seconds = date.getSeconds().toString().padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    // --- 数据获取与处理 ---

    // 从后端获取账户列表
    const fetchAccounts = async () => {
        loading.value = true;
        try {
            // 确保数据库目录存在
            await window.api.accounts.ensureDatabaseDirectoryExists();
            const sortOrder = sortOptions.order === "ascending" ? "ASC" : "DESC";
            const { accounts, total } = await window.api.accounts.listAccounts({
                sortByRegisterTime: sortOrder,
                page: pagination.currentPage,
                pageSize: pagination.pageSize,
            }); //DESC 降序 | ASC 升序

            pagination.total = total;

            // 最佳实践：检查当前页是否仍然有效
            const totalPages = Math.ceil(pagination.total / pagination.pageSize);
            if (pagination.currentPage > 1 && pagination.currentPage > totalPages) {
                // 如果当前页码超过了新的总页数（并且不是第一页），则自动跳转到最后一页并重新获取数据
                pagination.currentPage = totalPages > 0 ? totalPages : 1;
                await fetchAccounts(); // 重新调用以获取最后一页的数据
                return; // 终止当前函数的执行，因为数据将由新的调用来填充
            }

            // 保存之前的loading状态
            // const previousLoadingState = { ...rowLoadingState.value };

            const now = Date.now();
            allData.value = accounts.map((acc) => {
                let remainingDays = acc.daysRemainingOnTrial
                    ? acc.daysRemainingOnTrial
                    : calculateRemainingDays(acc.registerTimeStamp);
                if (acc.membershipType === SUBSCRIBE_FREE_NAME) {
                    remainingDays = 0;
                }
                let membershipTypeShow;
                if (acc.membershipType === SUBSCRIBE_FREE_NAME) {
                    membershipTypeShow = "已失效";
                } else if (acc.membershipType === SUBSCRIBE_PRO_NAME) {
                    membershipTypeShow = remainingDays + "天试用";
                } else if (acc.membershipType) {
                    membershipTypeShow = acc.membershipType;
                    remainingDays = 999;
                } else {
                    membershipTypeShow = "";
                    remainingDays = 999;
                }
                //accessToken 优先级高于 WorkosCursorSessionToken
                const expTimeAccessToken = getTokenExpTimestamp(acc.accessToken);
                const expTimeSessionToken = getTokenExpTimestamp(acc.WorkosCursorSessionToken);

                let expTimestamp, optimalToken;
                if (expTimeAccessToken) {
                    expTimestamp = expTimeAccessToken;
                    optimalToken = getRealAccessToken(acc.accessToken);
                } else if (expTimeSessionToken) {
                    expTimestamp = expTimeSessionToken;
                    optimalToken = getRealAccessToken(acc.WorkosCursorSessionToken);
                } else {
                    expTimestamp = null;
                    optimalToken = null;
                }
                const expTimestampShow = formatExpTimestamp(expTimestamp);

                const percentage = acc.modelUsageTotal > 0 ? (acc.modelUsageUsed / acc.modelUsageTotal) * 100 : 0;
                const percentageStatus = percentage > 99.9 ? "exception" : percentage > 85 ? "warning" : "success";

                return {
                    ...acc,
                    register_time: formatTimestamp(acc.register_time),
                    remainingDays,
                    membershipTypeShow,
                    modelUsage: {
                        used: acc.modelUsageUsed ?? 0,
                        total: acc.modelUsageTotal ?? 0,
                    },
                    expTimeAccessToken,
                    expTimeSessionToken,
                    expTimestamp,
                    optimalToken,
                    expTimestampShow,
                    percentage,
                    percentageStatus,
                    isShowUpdateSessionToken:
                        isShowUpdateSessionTokenConst &&
                        !expTimeAccessToken &&
                        expTimeSessionToken &&
                        expTimeSessionToken > now,
                };
            });

            // 恢复之前的loading状态
            // rowLoadingState.value = previousLoadingState;

            console.log("查询到", allData.value.length, "条数据");
            console.log("allData.value :>> ", allData.value);
        } catch (error) {
            console.error("获取账户列表失败:", error);
            ElMessage.error("获取账户列表失败: " + error.message);
        } finally {
            loading.value = false;
        }
    };

    // --- 事件处理 ---

    // 导入按钮点击
    const handleImport = async () => {
        const handleId = `import-${Date.now()}`;
        try {
            progressState.title = "正在导入账户";
            progressState.visible = true;
            progressState.percentage = 0;
            progressState.message = "等待用户选择文件...";
            progressState.status = "pending";
            progressState.handleId = handleId;

            const result = await window.api.accounts.importAccountsFromJSON(handleId);

            if (!result.canceled) {
                // ElMessage.success(`导入完成！成功 ${result.successful} 个，失败 ${result.failed} 个。`);
                await fetchAccounts();
            } else {
                progressState.visible = false;
            }
        } catch (error) {
            console.log("导入操作失败 :>> ", error);
            // ElMessage.error("导入操作失败: " + error.message);
        }
    };

    // 导出按钮点击
    const handleExport = async () => {
        const handleId = `export-${Date.now()}`;
        try {
            progressState.title = "正在导出账户";
            progressState.visible = true;
            progressState.percentage = 0;
            progressState.message = "等待用户选择保存位置...";
            progressState.status = "pending";
            progressState.handleId = handleId;

            const result = await window.api.accounts.exportAccountsToJSON(handleId);

            if (!result.canceled) {
                // ElMessage.success(`账户已成功导出到: ${result.filePath}`);
            } else {
                // ElMessage.info("用户取消了导出操作。");
                progressState.visible = false;
            }
        } catch (error) {
            console.log("导出操作失败 :>> ", error);
            ElMessage.error("导出操作失败: " + error.message);
            progressState.visible = false;
        }
    };

    // 新增按钮点击
    const handleAdd = () => {
        accountForm.value = { id: null, email: "", accessToken: "" };
        nextTick(() => {
            formRef.value && formRef.value.resetFields();
        });
        dialogVisible.value = true;
    };

    // eslint-disable-next-line no-unused-vars
    const importCurrentLoginAccount = () => {
        if (!cursorAccountsInfo.value.email) {
            ElMessage.error("当前没有登录账户。");
            return;
        }
        accountForm.value = { ...cursorAccountsInfo.value };
    };

    // // 编辑按钮点击
    // const handleEdit = async (row) => {

    //     try {
    //         isEditMode.value = true;
    //         // 使用 Object.assign 确保响应性
    //         Object.assign(accountForm.value, { ...row });
    //         dialogVisible.value = true;
    //     } catch (error) {
    //         console.error("编辑操作发生错误:", error);
    //         ElMessage.error("操作失败：" + error.message);
    //     }
    // };

    // // 删除按钮点击
    // const handleDelete = (row) => {
    //     ElMessageBox.confirm(`确定要删除邮箱为 "${row.email}" 的账户吗？`, "警告", {
    //         confirmButtonText: "确定",
    //         cancelButtonText: "取消",
    //         type: "warning",
    //     })
    //         .then(async () => {
    //             try {
    //                 const success = await window.api.accounts.deleteAccount(row.email);
    //                 if (success) {
    //                     ElMessage.success("删除成功！");
    //                     await fetchAccounts();
    //                 } else {
    //                     ElMessage.error("删除失败，未找到该账户。");
    //                 }
    //             } catch (error) {
    //                 ElMessage.error("删除失败: " + error.message);
    //             }
    //         })
    //         .catch(() => {
    //             // 用户取消
    //         });
    // };

    const handleUpdateSessionToken = async (row) => {
        if (!row.WorkosCursorSessionToken) {
            ElMessage.error("该账户没有刷新令牌。");
            return;
        }

        if (rowLoadingStateSessionToken.value[row.email]) {
            return;
        }
        ElMessageBox.confirm("使用第三方接口刷新60天令牌，该接口每个ip每天5次，可能有未知风险，确定刷新吗？", "注意", {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            type: "warning",
        }).then(async () => {
            rowLoadingStateSessionToken.value[row.email] = true;

            // 获取 api tokens
            console.log("正在刷新 token ");
            const updateData = {
                email: row.email,
            };
            try {
                const cursorAccountInfo = await getApiTokens(row.WorkosCursorSessionToken);
                updateData.accessToken = cursorAccountInfo.accessToken;
                updateData.refreshToken = cursorAccountInfo.refreshToken;
                await window.api.accounts.createOrUpdateAccount(updateData);
                await fetchAccounts();
                appStore.setActiveEmail(row.email);
            } catch (error) {
                console.error("获取 api tokens 失败:", error);
                ElMessage.error("刷新 token 失败！");
            } finally {
                rowLoadingStateSessionToken.value[row.email] = false;
            }
        });
    };

    const handleUpdateAccount = async (row) => {
        let accessToken = row.optimalToken;
        if (!accessToken) {
            ElMessage.error("该账户没有访问令牌。");
            return;
        }
        // 设置当前行的loading状态
        rowLoadingState.value[row.email] = true;

        try {
            const updateData = {
                email: row.email,
            };

            let stripeProfileResult = await getStripeProfile(accessToken);
            console.log("stripeProfileResult :>> ", stripeProfileResult);

            updateData.membershipType = stripeProfileResult.membershipType;
            updateData.daysRemainingOnTrial = stripeProfileResult.daysRemainingOnTrial;

            // let usageResult = await getUsage(accessToken);
            // updateData.modelUsageUsed = usageResult.numRequestsTotal || 0;
            // updateData.modelUsageTotal = usageResult.maxRequestUsage || 0;
            // updateData.registerTimeStamp = new Date(usageResult.startOfMonth).getTime();

            await window.api.accounts.createOrUpdateAccount(updateData);
            await fetchAccounts();
            appStore.setActiveEmail(row.email);
        } catch (error) {
            console.error("更新订阅信息时发生意外错误:", error);
            ElMessage.error("更新订阅信息失败");
        } finally {
            rowLoadingState.value[row.email] = false;
        }
    };

    const handleUseAccount = (row) => {
        if (!row.optimalToken) {
            ElMessage.error("该账户没有访问令牌。");
            return;
        }
        emit("show-use-account-dialog", { ...row });
    };

    // 批量删除按钮点击
    const handleDeleteBatch = () => {
        if (multipleSelection.value.length === 0) {
            ElMessage.warning("请至少选择一个账户。");
            return;
        }
        ElMessageBox.confirm(`确定要删除选中的 ${multipleSelection.value.length} 个账户吗？`, "警告", {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            type: "warning",
        })
            .then(async () => {
                try {
                    const handleId = `delete-batch-${Date.now()}`;
                    const emails = multipleSelection.value.map((item) => item.email);

                    progressState.title = "正在批量删除";
                    progressState.visible = true;
                    progressState.percentage = 0;
                    progressState.message = "准备开始...";
                    progressState.status = "pending";
                    progressState.handleId = handleId;

                    const deletedCount = await window.api.accounts.deleteAccounts(emails, handleId);
                    console.log(`成功删除了 ${deletedCount} 个账户。`);
                    // ElMessage.success(`成功删除了 ${deletedCount} 个账户。`);
                    await fetchAccounts();
                    multipleSelection.value = []; // 清空选择
                } catch (error) {
                    ElMessage.error("批量删除失败: " + error.message);
                }
            })
            .catch(() => {
                // 用户取消
            });
    };

    // 提交表单
    const submitForm = async () => {
        await formRef.value.validate(async (valid) => {
            if (valid) {
                try {
                    const expTimestamp = getTokenExpTimestamp(accountForm.value.accessToken);
                    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                    if (!emailRegex.test(accountForm.value.email)) {
                        ElMessage.error("邮箱格式不正确");
                        return;
                    }
                    if (!expTimestamp) {
                        ElMessage.error("token 无效");
                        return;
                    }
                    if (expTimestamp < Date.now()) {
                        ElMessage.error("token 已过期");
                        return;
                    }

                    let saveData = {
                        ...accountForm.value,
                        email: accountForm.value.email,
                    };

                    if (accountForm.value.accessToken.startsWith("user_")) {
                        saveData.WorkosCursorSessionToken = accountForm.value.accessToken;
                    } else {
                        saveData.accessToken = accountForm.value.accessToken;
                    }

                    // 新增模式
                    await window.api.accounts.createOrUpdateAccount(saveData);
                    ElMessage.success("新增成功！");
                    dialogVisible.value = false;

                    await fetchAccounts();
                    appStore.setActiveEmail(accountForm.value.email);
                } catch (error) {
                    console.log("error :>> ", error);
                    ElMessage.error("操作失败：" + error.message);
                }
            }
        });
    };

    // 处理表格多选变化
    const handleSelectionChange = (val) => {
        multipleSelection.value = val;
    };

    // 处理每页显示条数变化
    const handleSizeChange = (val) => {
        pagination.pageSize = val;
        pagination.currentPage = 1; // 切换每页条数时，返回第一页
        fetchAccounts();
    };

    // 处理当前页码变化
    const handleCurrentChange = (val) => {
        pagination.currentPage = val;
        fetchAccounts();
    };

    // 处理排序变化
    const handleSortChange = ({ prop, order }) => {
        // 目前只支持按注册时间排序
        if (prop === "register_time" && order) {
            sortOptions.order = order;
            // 排序后回到第一页
            pagination.currentPage = 1;
            fetchAccounts();
        }
    };

    const handleRowClick = (row) => {
        console.log("click row.email :>> ", row.email);
        appStore.setActiveEmail("");
    };

    const tableRowClassName = ({ row }) => {
        if (row.email === appStore.activeEmail) {
            return "active-row";
        }
        return "";
    };

    defineExpose({
        fetchAccounts,
    });
</script>

<template>
    <div class="account-management-container">
        <!-- 表格展示区 -->
        <div class="table-container">
            <el-table
                v-loading="loading"
                :data="allData"
                style="width: 100%"
                height="100%"
                stripe
                :row-class-name="tableRowClassName"
                :default-sort="{ prop: 'register_time', order: 'descending' }"
                @selection-change="handleSelectionChange"
                @sort-change="handleSortChange"
                @row-click="handleRowClick"
            >
                <el-table-column type="selection" width="55" align="center" />
                <el-table-column
                    label="序号"
                    type="index"
                    width="60"
                    align="center"
                    :index="(index) => (pagination.currentPage - 1) * pagination.pageSize + index + 1"
                />
                <el-table-column prop="email" label="邮箱" min-width="100" show-overflow-tooltip>
                    <template #default="scope">
                        <span style="position: relative; padding-left: 5px">
                            <el-icon
                                v-if="cursorAccountsInfo.email === scope.row.email"
                                color="#67c23a"
                                style="position: absolute; top: 3px; margin-right: 2px; margin-left: -17px"
                                ><UserFilled
                            /></el-icon>
                            <span :style="cursorAccountsInfo.email === scope.row.email ? 'color:#67c23a;' : ''">{{
                                scope.row.email
                            }}</span>
                        </span>
                    </template>
                </el-table-column>

                <el-table-column
                    prop="register_time"
                    label="创建时间"
                    min-width="100"
                    align="center"
                    sortable="custom"
                    show-overflow-tooltip
                >
                    <template #default="scope">
                        <span :style="cursorAccountsInfo.email === scope.row.email ? 'color:#67c23a;' : ''">{{
                            scope.row.register_time
                        }}</span>
                    </template>
                </el-table-column>

                <el-table-column label="订阅状态" width="100" align="center">
                    <template #default="scope">
                        <el-tag
                            v-if="scope.row.membershipTypeShow"
                            size="small"
                            :type="
                                scope.row.remainingDays > 7
                                    ? 'success'
                                    : scope.row.remainingDays > 3
                                      ? 'warning'
                                      : 'danger'
                            "
                        >
                            {{ scope.row.membershipTypeShow }}
                        </el-tag>
                    </template>
                </el-table-column>
                <!-- <el-table-column
                    prop="modelUsage.membershipType"
                    label="令牌有效期"
                    width="120"
                    align="center"
                    show-overflow-tooltip
                >
                    <template #default="scope">
                        <el-tag
                            :type="scope.row.expTimestampShow.type"
                            size="small"
                        >
                            {{ scope.row.expTimestampShow.label }}
                        </el-tag>
                    </template>
                </el-table-column> -->

                <el-table-column label="模型使用量" width="100" align="center">
                    <template #default="scope">
                        <div v-if="scope.row.modelUsage.total">
                            <span>{{ scope.row.modelUsage.used }} / {{ scope.row.modelUsage.total }}</span>
                            <el-progress
                                v-if="scope.row.modelUsage.total > 0"
                                :percentage="scope.row.percentage"
                                :status="scope.row.percentageStatus"
                                :stroke-width="5"
                                :show-text="false"
                            />
                        </div>
                        <div v-else style="font-size: 12px; line-height: 23px">无限制</div>
                    </template>
                </el-table-column>

                <el-table-column fixed="right" label="操作" width="160" align="center">
                    <template #default="scope">
                        <template v-if="!scope.row.expTimestampShow.isExpired">
                            <el-button link type="success" size="small" @click="handleUseAccount(scope.row)">{{
                                cursorAccountsInfo.email === scope.row.email ? "使用中" : "使用"
                            }}</el-button>
                            <el-button
                                link
                                type="primary"
                                :loading="rowLoadingState[scope.row.email]"
                                @click="handleUpdateAccount(scope.row)"
                                >更新
                            </el-button>
                            <el-button
                                v-if="scope.row.isShowUpdateSessionToken"
                                link
                                type="primary"
                                :loading="rowLoadingStateSessionToken[scope.row.email]"
                                @click="handleUpdateSessionToken(scope.row)"
                                >刷新60天令牌
                            </el-button>
                        </template>

                        <!-- <el-dropdown trigger="click">
                            <el-button text type="primary">
                                <el-icon><MoreFilled /></el-icon>
                            </el-button>
                            <template #dropdown>
                                <el-dropdown-menu>
                                    <el-dropdown-item @click="handleEdit(scope.row)"> 编辑 </el-dropdown-item>
                                    <el-dropdown-item style="color: #f56c6c" @click="handleDelete(scope.row)">
                                        删除
                                    </el-dropdown-item>
                                </el-dropdown-menu>
                            </template>
                        </el-dropdown> -->
                    </template>
                </el-table-column>
            </el-table>
        </div>
        <div class="footer">
            <!-- 功能操作区 -->
            <div class="toolbar">
                <el-button type="success" size="small" plain @click="handleAdd">新增账号</el-button>
                <el-button type="danger" size="small" plain @click="handleDeleteBatch">批量删除</el-button>
                <el-button type="success" size="small" plain @click="handleImport">导入</el-button>
                <el-button type="warning" size="small" plain @click="handleExport">导出</el-button>
            </div>

            <!-- 分页控制区 -->
            <div v-if="pagination.total > 0" class="pagination-container">
                <el-pagination
                    v-model:current-page="pagination.currentPage"
                    v-model:page-size="pagination.pageSize"
                    size="small"
                    :page-sizes="[10, 20, 50, 100]"
                    :layout="paginationLayout"
                    :total="pagination.total"
                    @size-change="handleSizeChange"
                    @current-change="handleCurrentChange"
                />
            </div>
        </div>

        <!-- 新增/编辑对话框 -->
        <el-dialog v-model="dialogVisible" title="新增账号" width="500px">
            <el-form ref="formRef" :model="accountForm" :rules="formRules" label-width="80px">
                <el-form-item label="邮箱" prop="email">
                    <el-input v-model="accountForm.email" placeholder="请输入邮箱地址" />
                </el-form-item>
                <el-form-item label="token" prop="accessToken">
                    <el-input
                        v-model="accountForm.accessToken"
                        type="textarea"
                        :rows="5"
                        placeholder="请输入 accessToken 或 WorkosCursorSessionToken"
                    />
                </el-form-item>
                <!-- 更多字段可以根据需要添加 -->
            </el-form>
            <template #footer>
                <span class="dialog-footer">
                    <!-- <el-button @click="importCurrentLoginAccount">添加当前Cursor登录账号</el-button> -->
                    <el-button @click="dialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="submitForm">确定</el-button>
                </span>
            </template>
        </el-dialog>

        <!-- 进度条对话框 -->
        <el-dialog
            v-model="progressState.visible"
            :title="progressState.title"
            width="400px"
            :close-on-click-modal="false"
            append-to-body
            @close="resetProgressState"
        >
            <div class="progress-content">
                <el-progress :percentage="progressState.percentage" :status="progressStatus" />
                <p class="progress-message">
                    {{ progressState.message }}
                </p>
            </div>
        </el-dialog>
    </div>
</template>

<style lang="scss" scoped>
    .account-management-container {
        padding: 10px;
        display: flex;
        flex-direction: column;
        height: 100%;
        box-sizing: border-box;
        opacity: 0.9;
    }
    .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .toolbar {
            margin-top: 10px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
        }
        :deep(.pagination-container) {
            display: flex;
            justify-content: flex-end;
            margin-top: 10px;
            flex-shrink: 0;

            .el-pagination {
                .el-pagination__classifier,
                .el-pagination__goto,
                .el-pagination__total {
                    color: var(--ev-c-text-1);
                }
                .btn-prev,
                .btn-next,
                .el-pager li {
                    border-radius: 4px;
                    margin: 0 3px;
                }
                .el-pager li.is-active {
                    color: var(--el-color-white);
                    background-color: var(--el-color-primary);
                }
                .el-pager li:hover {
                    color: var(--el-color-primary);
                }
            }
        }
    }

    .table-container {
        flex: 1;
        min-height: 0;
        border-radius: 4px;
        overflow: hidden;
    }

    /* 美化UI样式 */
    :deep(.el-table) {
        // 表头
        th.el-table__cell {
            background-color: #f7f9fc;
            color: #333;
            font-weight: 600;
            user-select: none;
        }
        // hover效果
        .el-table__body tr:hover > td.el-table__cell {
            background-color: #ecf5ff !important;
        }
        .el-table__body tr.active-row > td,
        .el-table__body tr.active-row:hover > td {
            background-color: #d9ecff !important;
        }
    }

    :deep(.el-tag) {
        user-select: none;
    }

    :deep(.el-textarea__inner) {
        &::-webkit-scrollbar {
            width: 6px;
        }

        &::-webkit-scrollbar-track {
            background-color: transparent;
        }

        &::-webkit-scrollbar-thumb {
            background-color: #dcdfe6;
            border-radius: 4px;
            transition: background-color 0.3s;
        }

        &::-webkit-scrollbar-thumb:hover {
            background-color: #c0c4cc;
            cursor: pointer;
        }
    }

    :deep(.dialog-footer) {
        // display: flex;
        // justify-content: space-between;
        // align-items: center;
        // gap: 10px;
        .el-button:first-child {
            margin-right: auto;
        }
    }
</style>
