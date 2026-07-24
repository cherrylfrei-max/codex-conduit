<script setup>
    import { ref, watch } from "vue";
    import { ElMessage } from "element-plus";
    import { storeToRefs } from "pinia";
    import { useAppStore } from "../stores/app.js";

    const appStore = useAppStore();
    const { appConfig } = storeToRefs(appStore);
    const props = defineProps({
        modelValue: Boolean,
    });

    const emits = defineEmits(["update:modelValue", "confirm"]);

    const dialogVisible = ref(props.modelValue);

    const backups = ref([]);
    const selectedBackup = ref("");
    const getBackups = async () => {
        const result = await window.api.listBackups();
        console.log("result:", result);
        backups.value = result.data.map((item, index) => {
            return {
                label: item.replace(
                    /^settings_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/,
                    (match, y, m, d, h, min, s) => {
                        let name = `备份_${y}年${m}月${d}日${h}时${min}分${s}秒`;
                        if (index === 0) {
                            name = name + " 最新";
                        }
                        return name;
                    }
                ),
                value: item,
            };
        });
    };
    watch(
        () => props.modelValue,
        (val) => {
            dialogVisible.value = val;
            if (val) {
                getBackups();
                isResetOriginalMachineGuid.value = false;
            }
        }
    );

    watch(dialogVisible, (val) => {
        if (!val) {
            emits("update:modelValue", false);
            selectedBackup.value = "";
            backups.value = [];
        }
    });
    const isResetOriginalMachineGuid = ref(false);
    const handleConfirm = async () => {
        if (isResetOriginalMachineGuid.value) {
            let result = await window.api.setMachineGuid(appConfig.value.originalMachineGuid);
            if (result.success === true) {
                ElMessage.success("恢复初始机器码成功");
                await appStore.fetchSystemInfo();
            } else {
                ElMessage.error(result.message);
            }
        }

        if (!backups.value.length) {
            dialogVisible.value = false;
            return;
        }

        if (!appConfig.value.path_cursor_user_db) {
            ElMessage.error("未找到Cursor文件路径，建议将Cursor安装到默认路径");
            return;
        }

        if (!selectedBackup.value) {
            ElMessage.error("请选择要恢复的备份文件");
            return;
        }

        try {
            console.log("selectedBackup.value :>> ", selectedBackup.value);
            let result = await window.api.restoreBackup(selectedBackup.value);
            if (result.success === true) {
                ElMessage.success("恢复备份成功");
            } else {
                throw result.message;
            }
        } catch (error) {
            console.error("恢复备份失败", error);
            ElMessage.error("恢复备份失败");
        }
        dialogVisible.value = false;
    };
</script>

<template>
    <el-dialog v-model="dialogVisible" title="恢复备份" width="500">
        <div v-if="backups.length">
            <p>从备份恢复您的Cursor设置、快捷键、扩展插件、代码片段</p>
            <p style="color: #f56c6c; margin-top: 10px">注意：此操作将覆盖您当前Cursor的设置。并重启Cursor</p>
        </div>

        <el-radio-group
            v-if="backups.length"
            v-model="selectedBackup"
            style="display: flex; flex-direction: column; margin-top: 10px"
        >
            <el-radio v-for="backup in backups" :key="backup.value" :value="backup.value">{{ backup.label }}</el-radio>
        </el-radio-group>
        <p v-else style="margin-top: 5px; opacity: 0.6">当前暂无Cursor设置备份，请先备份</p>
        <p v-if="appConfig.originalMachineGuid" style="margin-top: 10px">
            <el-checkbox v-model="isResetOriginalMachineGuid">同时恢复初始机器码MachineGuid</el-checkbox>
        </p>
        <template #footer>
            <div class="dialog-footer">
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" @click="handleConfirm"> 确定 </el-button>
            </div>
        </template>
    </el-dialog>
</template>

<style lang="scss" scoped>
    .el-radio-group {
        align-items: flex-start;
    }
</style>
