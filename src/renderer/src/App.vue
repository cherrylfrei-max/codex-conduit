<script setup>
    import Home from "./components/Home.vue";
    import TitleBar from "./components/TitleBar.vue";
    import backgroundImageUrl from "./assets/image/background.jpg";
    // const ipcHandle = () => window.electron.ipcRenderer.send('ping');
</script>

<template>
    <div class="app-body" :style="{ backgroundImage: `url(${backgroundImageUrl})` }">
        <TitleBar />
        <div class="content">
            <Home />
        </div>
    </div>
</template>

<style lang="scss">
    .app-body {
        position: relative;
        height: calc(100vh - 6px);
        width: calc(100vw - 6px);
        margin: 3px;
        // background-color: #012f49;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        overflow: hidden;
        border-radius: 10px;
        box-shadow: 1px 1px 5px 0px rgb(0 0 0 / 51%);

        .content {
            padding: 40px 20px 20px;
            height: 100%;
            box-sizing: border-box;
            overflow-y: auto;
        }
    }
    .auto-register-dialog {
        .el-input {
            width: 80px;
        }
    }
    .el-popper.is-customized {
        --el-card-bg-color: #f8f9fa69;
        /* Set padding to ensure the height is 32px */
        padding: 6px 12px;
        background: white;
        color: rgba(0, 0, 0, 0.664);
    }

    .el-popper.is-customized .el-popper__arrow::before {
        background: white;
        right: 0;
    }
</style>
