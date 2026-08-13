# dsh-web-background

DeepSeek Harness Web UI 背景自定义插件。安装后，设置面板（左下角齿轮）中会出现「背景 / Background」页面，可自定义 Web 界面背景并持久化到 `$DSH_HOME/settings.yaml`。

## 功能

- **纯色**：为浅色 / 深色模式分别指定背景色（附预设色卡）。
- **渐变**：分别设置浅色 / 深色模式的起止颜色和角度（附预设渐变）。
- **图片**：http(s) 链接或 data URL，支持铺放方式（覆盖 / 包含 / 平铺）、暗化程度（0–80% 遮罩提升文字可读性）以及加载兜底色。
- **浅色 / 深色独立取值**：通过主题系统的 token 覆盖层实现，跟随 UI 的明暗模式自动切换。
- **侧边栏联动**：可选择是否把背景同时应用到侧边栏。
- **持久化**：设置通过 Host settings 文档写入 `settings.yaml`，刷新页面 / 重启后自动恢复；「恢复默认」一键清除。

## 工作原理

- Host 半（`lib/index.js`）：注册 `web-background` 设置命名空间（schemastery schema），把设置落到 `settings.yaml`。
- 浏览器半（`lib/client.js`）：绑定该设置作用域，把 `--dsw-alias-bg-base`（主背景）与可选的 `--dsw-specific-sidebar-fill`（侧边栏）以 `{light, dark}` 覆盖层叠加到活动主题上（`ctx.theme.overrideTokens`），并注册设置页面。

## 兼容性

当前版本针对 DeepSeek Harness `0.1.0-rc.6` 验证。Harness 仍处于开发者预览阶段，内部设置白名单或主题 token 变更后可能需要同步适配。

## 安装（无 pnpm 的手工安装）

1. 确定 DSH 数据目录，并从 GitHub 安装插件及其运行依赖：
   ```powershell
   $dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
   npm.cmd install --prefix (Join-Path $dshHome 'profiles') 'https://github.com/BruceWu1126/dsh-web-background.git'
   ```
2. 在 `$dshHome\profiles\web\cordis.patch.yml` 中加入插件：
   ```yaml
   - insert:
       - id: web-background
         name: dsh-web-background
   ```
3. **暴露设置命名空间**：`0.1.0-rc.6` 的 Web 设置通道只服务一份硬编码白名单。在当前 DSH 安装中的 `node_modules/@deepseek-ai/dsh-host-apiproxy/lib/index.js` 找到 `WEB_SETTINGS_NAMESPACES`，加入 `"web-background"`。升级或重装 DSH 后需要重新检查这项补丁。
4. 重启 `dsh web`（插件集合与 Host 代码的变化都在重启后生效），打开设置 →「背景」。

> 第 3 步会修改 Harness 的安装文件。修改前应备份目标文件；这项限制需要由 Harness 后续提供插件自声明设置命名空间的机制才能消除。

## 卸载

1. 从 `cordis.patch.yml` 中删除上述 `insert` 块。
2. 运行 `npm.cmd uninstall --prefix (Join-Path $dshHome 'profiles') dsh-web-background`。
3. 重启 `dsh web`；`settings.yaml` 中的 `web-background:` 段可保留或手动删除。

## 测试

```powershell
npm.cmd ci
npm.cmd run check
```

测试覆盖客户端主题覆盖层与本地编辑合并、Host schema 默认值与边界、Host → Web schema 序列化，以及 React 设置页的四种渲染状态。

## 已知限制

- 渐变 / 图片模式下，`--dsw-alias-bg-base` 不再是一个纯色，少量用 `color-mix(...)` 引用该 token 的加载扫光动画（消息行 shimmer）会停止绘制，不影响功能。
- 远程浏览器（非本机回环地址）以内存模式运行，设置仅当次会话有效，不写入 `settings.yaml`。
- 修改插件代码后需要重启 `dsh web`（无 HMR watcher 时）；新插件集合本身也只在重启时扫描。
