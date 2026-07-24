<script setup>
    import { ref, watch } from "vue";
    import { useAppStore } from "../stores/app.js";
    import { storeToRefs } from "pinia";
    import { ElMessage } from "element-plus";

    const formRef = ref(null);

    const rules = ref({
        EMAIL_DOMAIN: [{ required: true, message: "请输入域名", trigger: "blur" }],
        RECEIVING_EMAIL: [
            { required: true, message: "请输入tempmail邮箱", trigger: "blur" },
            { type: "email", message: "请输入正确的邮箱格式", trigger: ["blur", "change"] },
        ],
        RECEIVING_EMAIL_PIN: [{ required: true, message: "请输入PIN码", trigger: "blur" }],
    });

    const props = defineProps({
        modelValue: Boolean,
    });
    const emit = defineEmits(["update:modelValue", "saved"]);

    const appStore = useAppStore();
    const { appConfig } = storeToRefs(appStore);

    const localConfig = ref({
        EMAIL_DOMAIN: "",
        RECEIVING_EMAIL: "",
        RECEIVING_EMAIL_PIN: "",
    });

    watch(
        appConfig,
        (newVal) => {
            if (newVal) {
                localConfig.value = JSON.parse(JSON.stringify(newVal));
            }
        },
        { immediate: true, deep: true }
    );

    watch(
        () => props.modelValue,
        (newVal) => {
            if (newVal) {
                // When dialog opens, copy config again to make sure it's fresh
                if (appConfig.value) {
                    localConfig.value = JSON.parse(JSON.stringify(appConfig.value));
                }
            }
        }
    );

    const saveConfig = async () => {
        if (!formRef.value) return;
        try {
            await formRef.value.validate();
        } catch {
            return;
        }

        const newConfig = JSON.parse(JSON.stringify(localConfig.value));

        try {
            let setResult = await window.api.setAppConfig(newConfig);
            if (setResult.success) {
                ElMessage.success(`修改配置成功`);
                await appStore.fetchAppConfig();
                closeDialog();
            } else {
                ElMessage.error("修改配置失败");
            }
        } catch (error) {
            console.log("error1 :>> ", error);
            ElMessage.error("修改配置失败");
        }
    };

    const closeDialog = () => {
        emit("update:modelValue", false);
    };

    const openLink = (url) => {
        window.api.openExternalLink(url);
    };
</script>

<template>
    <el-dialog
        :model-value="modelValue"
        :close-on-click-modal="false"
        title="自动注册配置"
        width="500px"
        @update:model-value="closeDialog"
    >
        <el-form ref="formRef" :model="localConfig" :rules="rules" label-width="150px">
            <el-form-item label="域名" prop="EMAIL_DOMAIN">
                <el-input v-model="localConfig.EMAIL_DOMAIN" placeholder="个人域名 例：flyxx.com 阿里云1元购买" />
            </el-form-item>
            <el-form-item label="tempmail邮箱" prop="RECEIVING_EMAIL">
                <el-input v-model="localConfig.RECEIVING_EMAIL" placeholder="临时邮箱 https://tempmail.plus免费申请" />
            </el-form-item>
            <el-form-item label="PIN码" prop="RECEIVING_EMAIL_PIN">
                <el-input v-model="localConfig.RECEIVING_EMAIL_PIN" placeholder="临时邮箱PIN码" />
            </el-form-item>
            <el-form-item label="">
                <p class="open-link" @click.prevent="openLink('https://tempmail.plus')">
                    临时邮箱申请地址:https://tempmail.plus
                </p>
            </el-form-item>
            <el-form-item label="">
                <p class="open-link" @click.prevent="openLink('https://www.bilibili.com/opus/951275934028136469')">
                    Cloudflare路由无限邮箱配置教程
                </p>
            </el-form-item>
        </el-form>
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="closeDialog">取消</el-button>
                <el-button type="primary" @click="saveConfig"> 保存 </el-button>
            </span>
        </template>
    </el-dialog>
</template>

<style scoped>
    .open-link {
        color: var(--el-color-primary);
        cursor: pointer;
        text-decoration: underline;
    }
</style>
