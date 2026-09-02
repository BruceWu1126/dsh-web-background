# dsh-web-background

DeepSeek Harness Web UI 背景自定义插件。安装后，设置面板（左下角齿轮）中会出现「背景 / Background」页面，可自定义 Web 界面背景并持久化到 `$DSH_HOME/settings.yaml`。

## 功能

- **纯色**：为浅色 / 深色模式分别指定背景色（附预设色卡）。
- **渐变**：分别设置浅色 / 深色模式的起止颜色和角度（附预设渐变）。
- **图片**：http(s) 链接或 data URL，支持本地图片导入（≤1 MB）、铺放方式（覆盖 / 包含 / 平铺）、暗化程度（0–80% 遮罩提升文字可读性）以及加载兜底色。
- **浅色 / 深色独立取值**：通过主题系统的 token 覆盖层实现，跟随 UI 的明暗模式自动切换。
- **侧边栏联动**：可选择是否把背景同时应用到侧边栏。
- **即时响应**：所有改动乐观更新（界面与背景立即生效），写入防抖合并；持久化到 `settings.yaml`，刷新 / 重启后自动恢复，「恢复默认」一键清除。

## 兼容性

当前版本针对 DeepSeek Harness `0.1.0-rc.6` 与 `0.1.1-rc.2` 验证。`0.1.0-rc.6` 仍依赖硬编码设置白名单；`0.1.1` 起 Host 会暴露所有已注册的 settings namespace，安装脚本会自动跳过那步补丁。Harness 仍处于开发者预览阶段，内部设置白名单或主题 token 变更后可能需要同步适配（见下文「dsh 升级后」）。

## 要求

- Node.js ≥ 20（DeepSeek Harness 本身建议 Node.js 22+）
- 已安装并**至少成功运行过一次** `dsh web` 或 `npx @deepseek-ai/dsh web`（首次运行会创建 `$DSH_HOME/profiles` 及模块回退链接，安装脚本依赖它们定位 DSH 安装目录）
- Windows / macOS / Linux 均可；换系统后需要在新系统再装一次（见下表）

| 系统 | 默认 `$DSH_HOME` | 用来安装的终端 |
|---|---|---|
| Linux | `~/.dsh` | bash / zsh |
| macOS | `~/.dsh` | zsh / bash |
| Windows | `%USERPROFILE%\.dsh` | PowerShell |

切换操作系统不会带走 Harness 数据：Linux 的 `~/.dsh` 和 Windows 的 `%USERPROFILE%\.dsh` 互不相通。在另一边开机后，先再跑一次 `npx @deepseek-ai/dsh web`，再执行 `node install.mjs`。背景设置写在该系统的 `$DSH_HOME/settings.yaml`，不会自动同步。

## 快速安装（推荐）

Linux / macOS：

```sh
# 1. 若尚未运行过 Harness，先创建 ~/.dsh/profiles（浏览器打开后即可 Ctrl+C 停掉）
npx @deepseek-ai/dsh web

# 2. 安装本插件
git clone https://github.com/BruceWu1126/dsh-web-background.git
cd dsh-web-background
node install.mjs
```

Windows（PowerShell）同样是 `git clone` 后 `node install.mjs`；数据目录默认是 `%USERPROFILE%\.dsh`。

然后**重启 `dsh web`**（终端 Ctrl+C 后重新运行），刷新页面，打开设置 →「背景」。

查看安装器参数：

```sh
node install.mjs --help
```

可用参数：

| 参数 | 作用 | 默认值 |
|---|---|---|
| `--dsh-home <path>` | 指定 Harness 数据目录（`~` 会展开为家目录） | `$DSH_HOME`，否则 Linux/macOS 为 `~/.dsh`、Windows 为 `%USERPROFILE%\.dsh` |
| `--profile <name>` | 要打补丁的 profile | `web` |
| `--uninstall` | 完整卸载并还原备份 | — |
| `--help` | 打印各系统用法 | — |

## 安装脚本做了什么

`install.mjs` 共四步（每步都幂等，可重复运行）：

1. **复制插件本体**到 `$DSH_HOME/profiles/node_modules/dsh-web-background`（profile 共享模块目录）。
2. **注册插件行**：在 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 中追加 Loader 的 `insert` 条目。
3. **暴露设置命名空间（按版本）**：`0.1.0-rc.6` 的 Web 设置通道只服务 `dsh-host-apiproxy` 里一份**硬编码白名单**（`WEB_SETTINGS_NAMESPACES`）。脚本把 `"web-background"` 加入该白名单。`0.1.1` 起该白名单已移除（`settings.describe()` 返回全部已注册 namespace），脚本检测到后会跳过这一步而不是失败。
4. **导航图标（可选，外观）**：设置面板导航行的图标由 `dsh-client-ui-settings-general` 硬编码，未知 id 一律回退成齿轮图标。脚本给 `background` 补一个图片图标分支。

第 3、4 步会修改 DSH **安装目录**里的文件（通过 `$DSH_HOME/profiles/node_modules` 的引导回退链接定位真实位置）。每次修改前都会把原文件备份为 `<file>.dsh-wb-backup`，`--uninstall` 会原样还原。这两处补丁是当前产品版本的权宜之计，待 Harness 提供正式扩展点后即可移除。

## 手工安装（备选，不用安装脚本）

1. 用 npm 安装插件本体（或直接手动复制本仓库到 `$DSH_HOME/profiles/node_modules/dsh-web-background`）。

   Linux / macOS：

   ```sh
   dshHome="${DSH_HOME:-$HOME/.dsh}"
   npm install --prefix "$dshHome/profiles" 'https://github.com/BruceWu1126/dsh-web-background.git'
   ```

   Windows（PowerShell）：

   ```powershell
   $dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
   npm.cmd install --prefix (Join-Path $dshHome 'profiles') 'https://github.com/BruceWu1126/dsh-web-background.git'
   ```

2. 在 `$dshHome/profiles/web/cordis.patch.yml`（Windows 为 `$dshHome\profiles\web\cordis.patch.yml`）中加入：
   ```yaml
   - insert:
       - id: web-background
         name: dsh-web-background
   ```
3. 在 DSH 安装目录的 `node_modules/@deepseek-ai/dsh-host-apiproxy/lib/index.js` 中，把 `"web-background"` 加入 `WEB_SETTINGS_NAMESPACES` 数组（**必做**，改前备份文件）。
4. （可选）在 `node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js` 的 `navIcon(id)` 中给 `id === "background"` 加一个图标分支，否则显示齿轮图标。
5. 重启 `dsh web`，打开设置 →「背景」。

## Linux 常见问题

- **`profile directory not found`**：还没有跑过 Harness。先执行 `npx @deepseek-ai/dsh web`，确认 `~/.dsh/profiles/web` 存在后再安装。
- **`dsh: command not found`**：没有全局安装 CLI。用 `npx @deepseek-ai/dsh web`，或 `npm install -g @deepseek-ai/dsh`。
- **装到了 `/root/.dsh`**：不要用 `sudo node install.mjs`。插件必须装进你登录用户的 `~/.dsh`。
- **自定义数据目录**：`node install.mjs --dsh-home ~/.dsh`（脚本会展开 `~`）。
- **换到另一台 Linux / 另一个发行版**：把同一套命令再跑一遍；不要把 Windows 的 `%USERPROFILE%\.dsh` 直接拷过来当 Linux 家目录。

## 卸载

```sh
node install.mjs --uninstall
```

还原两个产品文件与 profile 补丁文件、删除插件目录（`settings.yaml` 里的 `web-background:` 段可保留，无副作用）。手工安装的按上述步骤逆向删除即可。

## dsh 升级后

Harness 升级（`npx` 缓存重建 / 重新安装）会覆盖两个产品补丁。**重新运行一次 `node install.mjs`** 即可：脚本会检测到补丁缺失并重新应用（备份不会重复覆盖原始文件）。插件本体在 `$DSH_HOME` 下不受影响。

## 测试

```sh
npm ci
npm run check
```

测试覆盖客户端主题覆盖层与本地编辑合并、Host schema 默认值与边界、Host → 浏览器 schema 序列化、React 设置页渲染，以及安装器的安装、重复运行、卸载、已有白名单兼容和 profile 路径约束。

## 已知限制

- 渐变 / 图片模式下，`--dsw-alias-bg-base` 不再是一个纯色，少量用 `color-mix(...)` 引用该 token 的加载扫光动画（消息行 shimmer）会停止绘制，不影响功能。
- 远程浏览器（非本机回环地址）以内存模式运行，设置仅当次会话有效，不写入 `settings.yaml`。
- 本地图片导入上限 1 MB（设置写入本地配置文件，内嵌不宜过大）；更大的图片请用 http(s) 链接。
- 修改插件代码后需要重启 `dsh web`（无 HMR watcher 时）；新插件集合本身也只在重启时扫描。
