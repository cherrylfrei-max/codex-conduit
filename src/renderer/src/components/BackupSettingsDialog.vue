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

    watch(
        () => props.modelValue,
        (val) => {
            dialogVisible.value = val;
        }
    );

    watch(dialogVisible, (val) => {
        if (!val) {
            emits("update:modelValue", false);
        }
    });

    const handleConfirm = async () => {
        if (!appConfig.value.path_cursor_user_db) {
            ElMessage.error("未找到Cursor文件路径！");
            return;
        }

        try {
            let result = await window.api.backup();
            if (result.success === true) {
                ElMessage.success("备份成功");
            } else {
                throw result.message;
            }
        } catch (error) {
            console.error("备份失败", error);
            ElMessage.error("备份失败");
        }
        dialogVisible.value = false;
    };
</script>

<template>
    <el-dialog v-model="dialogVisible" title="备份Cursor设置" width="500">
        <div>
            <p>确定要备份您的Cursor吗？</p>
            <p style="margin-top: 10px">包括Cursor设置、快捷键、扩展插件、代码片段</p>
            <p style="margin-top: 10px">超过5个备份将自动删除旧备份</p>
        </div>
        <template #footer>
            <div class="dialog-footer">
                <el-button @click="dialogVisible = false">取消</el-button>
                <el-button type="primary" @click="handleConfirm"> 确定 </el-button>
            </div>
        </template>
    </el-dialog>
</template>

<style lang="scss" scoped></style>
