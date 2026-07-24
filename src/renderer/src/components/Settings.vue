<script setup>
    import { useAppStore } from "../stores/app.js";
    import { storeToRefs } from "pinia";
    import { ref, onMounted } from "vue";
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

    const appStore = useAppStore();
    const { appConfig } = storeToRefs(appStore);

    const localConfig = ref({
        EMAIL_DOMAIN: "",
        RECEIVING_EMAIL: "",
        RECEIVING_EMAIL_PIN: "",
    });

    const updateConfig = () => {
        if (appConfig.value) {
            localConfig.value = JSON.parse(JSON.stringify(appConfig.value));
            formRef.value.clearValidate();
        }
    };

    onMounted(() => {
        updateConfig();
    });

    defineExpose({
        updateConfig,
    });

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
            } else {
                ElMessage.error("修改配置失败");
            }
        } catch (error) {
            console.log("error1 :>> ", error);
            ElMessage.error("修改配置失败");
        }
    };

    const openLink = (url) => {
        window.api.openExternalLink(url);
    };
</script>

<template>
    <div v-if="localConfig" class="settings-container">
        <el-form ref="formRef" :model="localConfig" :rules="rules" label-width="150px" style="max-width: 450px">
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
            <el-form-item>
                <el-button type="primary" @click="saveConfig">保存</el-button>
            </el-form-item>
        </el-form>
    </div>
    <div v-else>正在加载配置...</div>
</template>

<style scoped>
    .settings-container {
        padding: 20px;
    }
    .open-link {
        color: var(--el-color-primary);
        cursor: pointer;
        text-decoration: underline;
    }
    :deep(.el-form-item) {
        label {
            color: var(--ev-c-text-1);
        }
    }
</style>
