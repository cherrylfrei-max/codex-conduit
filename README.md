# Codex Conduit

> Codex 多账号路由与自动故障转移网关

Codex Conduit 是一款面向 **Codex CLI、Codex App 和受支持 IDE 集成**的桌面网关。它在本机统一管理多个 ChatGPT 订阅账号和 OpenAI 兼容的第三方 Provider，并根据额度与账号状态完成请求路由、无感切换和故障转移。

> Formerly known as **Codex Switcher / Seamless Switch**.

**Route every Codex request through the right account.**

## 功能特性

- **多账号管理**：集中管理 ChatGPT 订阅账号、OpenAI API Key 和第三方 Provider。
- **本地代理**：在本机转发 Codex 流量，不中断当前会话即可切换账号。
- **自动故障转移**：遇到 `401`、`429` 或额度不足时切换到健康账号。
- **额度监控**：查看 5 小时额度、周额度、第三方 Provider 余额及账号健康状态。
- **灵活路由**：可决定 FREE、Relay、Coding Plan 和第三方 API 账号是否参与自动轮换。
- **配置保护**：启用代理时自动备份 `~/.codex/config.toml`，停用时恢复原配置。
- **跨平台桌面端**：提供 macOS、Windows 和 Linux 构建产物。

## 界面预览

![Codex Conduit 仪表盘](img/1.png)

仪表盘集中显示当前账号、额度、第三方余额和本地代理状态。

## 快速开始

### 1. 安装应用

从 [Releases](https://github.com/VallierDev/codex-switcher/releases) 下载对应平台的最新安装包：

| 平台 | 安装包 |
| --- | --- |
| macOS | `.dmg` 或 `.app.tar.gz`，按 Apple Silicon、Intel 或 Universal 选择 |
| Windows | `.msi` 或 `.exe` |
| Linux | `.AppImage`、`.deb` 或 `.rpm` |

安装并启动 Codex Conduit。首次使用前，建议先退出正在运行的 Codex CLI 或 Codex App，以便后续代理配置完整生效。

### 2. 添加 ChatGPT 订阅账号

点击右上角 **+ Sign In**，然后选择一种授权方式：

1. 点击 **Sign In to OpenAI**，使用系统默认浏览器完成官方 OAuth 授权。
2. 如果需要指定浏览器，点击 **Copy Authorization Link (Use Preferred Browser)**，将链接粘贴到目标浏览器。
3. 授权完成后，浏览器会自动返回 Codex Conduit，账号随即加入列表。
4. 如果浏览器没有自动返回，点击底部的手动回调入口，并粘贴浏览器最终跳转的完整回调链接。

![通过 OpenAI OAuth 添加订阅账号](img/4.png)

> OAuth 登录不会要求你在 Codex Conduit 中输入 OpenAI 密码。请只在 OpenAI 官方授权页面完成登录。

重复以上步骤即可添加多个订阅账号。建议在不同浏览器配置文件或无痕窗口中登录，以免误用已登录的账号。

### 3. 添加第三方 Provider

如果你使用 OpenAI 兼容中转站、Coding Plan 或其他 API 服务，点击右上角 **+ Add Third-Party Provider**：

1. 选择预置 Provider；没有对应预设时选择自定义 Provider。
2. 填写便于识别的 **Account Name** 和服务商提供的 **API Key**。
3. 检查 **Base URL** 与 **Upstream Protocol**。支持 `/v1/responses` 和 `/chat/completions` 协议。
4. 在 **Usage Lookup** 中选择余额查询方式；不支持查询时可禁用。
5. 仅在服务商要求时展开高级设置，填写回退模型或模型映射。
6. 点击 **Add Provider** 完成添加。

![添加第三方 Provider](img/5.png)

> API Key 属于敏感凭据。不要将真实 Key 粘贴到 issue、日志、截图或公开配置中。

### 4. 检查账号并切换

打开 **Accounts** 页面，可以查看所有账号的类型、剩余额度、健康状态和更新时间。

![账号列表与额度状态](img/2.png)

- 点击账号行右侧的切换按钮，将该账号设为当前账号。
- 点击刷新按钮，重新拉取单个账号的额度或余额。
- 使用页面顶部的刷新操作，可以批量更新账号状态。
- 通过 **Subscriptions** 和 **Relay** 筛选不同类型的账号。
- 当前账号会显示 **Current** 标记；失效或已退出的账号应重新授权。

### 5. 启用本地代理

返回 **Dashboard**，在 **Local Proxy** 卡片中打开开关：

1. 应用会备份现有 `~/.codex/config.toml` 为 `config.toml.mybak`。
2. 应用写入本地代理配置并启动代理服务。
3. 顶部出现 **Proxy ON**，卡片状态显示 **Running** 后，重启 Codex CLI、Codex App 或相关 IDE。
4. 后续请求会经过 Codex Conduit；切换账号时无需中断当前会话。

![本地代理运行状态](img/1.png)

关闭 Dashboard 中的代理开关后，本地代理停止，应用会尝试恢复启用前的 Codex 配置。

## 自动切换设置

在 **Settings > Background Services** 中配置账号选择策略，修改后务必点击右上角 **Save Settings**。

![配置自动切换策略](img/3.png)

| 设置 | 作用 | 建议 |
| --- | --- | --- |
| Background Refresh and Sync | 后台刷新并同步账号状态 | 多账号长期运行时开启 |
| Allow FREE Accounts for Smart Switching | 允许自动选择 FREE 账号 | 仅在需要使用免费额度时开启 |
| Fall Back to Subscription Accounts | 第三方账号异常时回退到健康订阅账号 | 建议开启以提高可用性 |
| Include Relay, Plan, and Third-Party Accounts | 允许从订阅账号自动切入第三方账号 | 确认可接受第三方额度消耗后再开启 |

推荐策略：

- **优先稳定性**：开启订阅账号回退，关闭第三方账号自动切入。
- **统一额度池**：同时开启订阅回退和第三方账号自动切入。
- **控制成本**：关闭 FREE 与第三方账号自动切入，需要时手动切换。

## 日常使用

1. 保持 Codex Conduit 在后台运行，并确认顶部显示 **Proxy ON**。
2. 在 Dashboard 查看当前账号和综合额度。
3. 在 Accounts 页面刷新额度、检查账号健康状态或手动切换账号。
4. 代理收到限流或额度错误后，会根据 Settings 中的策略选择下一个健康账号。
5. 不再需要代理时，从 Dashboard 关闭开关，不要直接删除生成的配置文件。

## 常见问题

### 开启代理后 Codex 没有走新账号

- 确认 Dashboard 顶部显示 **Proxy ON**，Local Proxy 显示 **Running**。
- 开启代理后重启 Codex CLI、Codex App 或正在使用的 IDE。
- 在 Accounts 页面确认目标账号带有 **Current** 标记且状态健康。
- 如果 Codex 登录状态与当前账号不一致，按 Dashboard 中的同步提示修正账号状态。

### OAuth 授权后没有自动返回应用

保持添加账号窗口打开，点击手动回调入口，将浏览器地址栏中的完整回调 URL 粘贴进去。也可以重新开始授权，并使用复制授权链接的方式在其他浏览器中完成登录。

### 第三方 Provider 无法请求

- 确认 Base URL、API Key 和上游协议与服务商文档一致。
- Codex 原生请求通常使用 `/v1/responses`；仅支持 Chat Completions 的服务商应选择 `/chat/completions`。
- 如果客户端模型名不被服务商支持，在高级设置中添加模型映射或回退模型。
- 余额查询失败不一定代表请求不可用，可暂时将 Usage Lookup 设为禁用后测试。

### macOS 提示应用已损坏或无法打开

在 **Settings > Troubleshooting** 中使用 **Fix Codex App Crashes** 修复隔离属性。该操作可能需要管理员权限。只应安装本仓库 Releases 发布的构建产物。

### 如何恢复原来的 Codex 配置

优先通过 Dashboard 关闭代理，应用会自动恢复备份。启用代理时，原配置会备份为 `~/.codex/config.toml.mybak`；手动处理前请先退出 Codex Conduit 和 Codex。

## 从源码运行

### 环境要求

- Node.js 20+
- Rust stable
- Tauri 2 对应平台的系统依赖

### 开发模式

```bash
npm install
npm run tauri dev
```

### 构建桌面应用

```bash
npm install
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`。不同平台的 Tauri 系统依赖请参考 [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)。

## 安全说明

- Codex Conduit 会在本机保存账号授权信息和第三方 API Key，请保护好当前系统用户账户与数据目录。
- 本地代理默认仅用于本机访问；只有明确需要时才启用局域网访问。
- 请勿提交 `auth.json`、API Key、Cookie、OAuth 回调链接或其他凭据到 Git 仓库。
- 使用第三方 Provider 前，请自行确认其隐私政策、计费规则和服务可靠性。

## License

本项目采用 [MIT License](LICENSE)。
