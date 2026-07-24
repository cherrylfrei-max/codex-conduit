<template>
    <el-dialog
        :model-value="modelValue"
        title="切换账号"
        width="500px"
        :close-on-click-modal="false"
        @update:model-value="$emit('update:modelValue', $event)"
    >
        <div v-if="account">
            <p>
                确定要使用账号<strong>{{ account.email }}</strong
                >吗？
            </p>
            <p>此操作可能会重启Cursor ！</p>
            <p>
                <el-checkbox v-model="isResetMachines">重置机器码（推荐）</el-checkbox>
            </p>
            <p>
                <el-checkbox v-model="isResetCursor">特殊重置Cursor（推荐）</el-checkbox>
            </p>
            <p>
                <el-checkbox v-model="isResetCursorAll">完全重置Cursor</el-checkbox>
            </p>
        </div>
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="$emit('update:modelValue', false)">取消</el-button>
                <el-button type="primary" @click="handleConfirm">确定</el-button>
            </span>
        </template>
    </el-dialog>
</template>

<script setup>
    // eslint-disable-next-line no-unused-vars
    const props = defineProps({
        modelValue: {
            type: Boolean,
            required: true,
        },
        account: {
            type: Object,
            default: null,
        },
    });

    const isResetMachines = ref(true);
    const isResetCursor = ref(true);
    const isResetCursorAll = ref(false);

    const emit = defineEmits(["update:modelValue", "confirm"]);

    // 然后使用函数形式监听
    watch(
        () => props.modelValue,
        (newVal) => {
            if (!newVal) {
                isResetMachines.value = true;
                isResetCursor.value = true;
                isResetCursorAll.value = false;
            }
        }
    );

    const handleConfirm = () => {
        emit("confirm", {
            isResetMachines: isResetMachines.value,
            isResetCursor: isResetCursor.value,
            isResetCursorAll: isResetCursorAll.value,
        });
        emit("update:modelValue", false);
    };
</script>

<style scoped>
    .dialog-footer {
        text-align: right;
    }
</style>
