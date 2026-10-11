# luci-theme-Basalt

[![LuCI 兼容性矩阵](https://github.com/Ozero-top/luci-theme-Basalt/actions/workflows/luci-compat.yml/badge.svg?branch=main)](https://github.com/Ozero-top/luci-theme-Basalt/actions/workflows/luci-compat.yml)

**简体中文** | [English](README.en.md)

面向 [OpenWrt LuCI](https://github.com/openwrt/luci) 的**暗色顶部导航**主题，
基于现行 ucode 模板 LuCI 技术栈（OpenWrt 22.03 至 25.12 / SNAPSHOT）。
v2 的视觉层源自 [luci-theme-footstrap](https://github.com/VizzleTF/luci-theme-footstrap)（Apache-2.0）。

- 炭灰暗底：`#1c2128` 页面 / `#22272e` 卡片，蓝色强调 `#569df5`
- 顶部水平导航：纯文字 pill，子菜单悬停/点击弹出下拉卡片
- 12 px 大圆角卡片、Manrope→系统字体栈、内置原创几何暗纹背景
- 暗色唯一：无浅色模式、无外观设置页、无 UCI 配置
- 登录页为暗色居中卡片，服务端直出（禁用 JS 也可登录，兼容 2FA 插件字段）
- 窄屏（≤860 px）自动换行为两行：品牌行 + 可横滑的 pill 条
- 与官方主题保持相同菜单/Tab/指示器 DOM 契约，所有 LuCI 模块均可正常使用

## 目录结构

```
luci-theme-Basalt/
├── Makefile                                  # OpenWrt 包定义（+luci-base）
├── build-css.mjs                             # 开发用：styles/ 切片拼接成 cascade.css
├── styles/                                   # CSS 源切片（@layer tokens/base/theme/page）
├── ucode/template/themes/basalt/       # ucode 模板（.ut）
│   ├── head_meta.ut
│   ├── header.ut / footer.ut                 # 管理界面外壳（容器开闭严格配对）
│   └── sysauth.ut                            # 登录页（blank header/footer）
├── htdocs/luci-static/
│   ├── basalt/                         # 主题媒体根目录
│   │   ├── css/cascade.css                   # 唯一样式表（构建产物，随包提交）
│   │   ├── pattern/texture.svg               # 内置原创暗纹
│   │   ├── logo.svg / logo_48.png / app-icon-192.png / manifest.json
│   └── resources/
│       └── menu-basalt.js              # 顶栏菜单渲染器（自包含，仅依赖 ui/baseclass）
├── root/etc/uci-defaults/30_luci-theme-Basalt
└── tests/                                    # 跨分支浏览器测试 harness（1280 + 390 双视口）
```

`luci.mk` 执行的安装路径映射：

| 源路径                              | 目标设备路径                         |
|-------------------------------------|---------------------------------------------|
| `ucode/**`                          | `/usr/share/ucode/luci/template/themes/basalt/` |
| `htdocs/luci-static/basalt/`  | `/www/luci-static/basalt/`            |
| `htdocs/luci-static/resources/`     | `/www/luci-static/resources/`               |
| `root/etc/uci-defaults/...`         | `/etc/uci-defaults/`（安装时执行一次）       |

## 运行要求

- 使用 ucode LuCI 技术栈的 OpenWrt（22.03 至 25.12 / SNAPSHOT）
- `luci-base`（声明为唯一包依赖）

## 兼容性

**OpenWrt / LuCI 服务端技术栈** —— 本主题使用 ucode 模板 LuCI（与官方
22.03 及之后主题同一技术栈）与标准 `luci-base` dispatcher：

| 系统 | 状态 |
|--------|--------|
| OpenWrt 25.12.x（apk；最新稳定版，已在 25.12 上验证） | 支持 |
| OpenWrt 24.10.x（opkg） | 支持 |
| OpenWrt 23.05、22.03 | 支持 |
| 同基线 ImmortalWrt（22.03 / 23.05 / 24.10） | 支持 |
| OpenWrt 21.02 及更早（Lua `.htm` 模板时代的 LuCI） | 不支持 |

兼容性由 CI 持续锁定：每次推送都会用 openwrt-22.03 / 23.05 / 24.10 /
25.12（必须通过）与 master（非阻塞金丝雀）分支的**真实 luci-base 核心**
在 1280 px 与 390 px 两个视口执行同一套浏览器断言（零控制台/网络错误）。

**Web 服务器** —— 完全透明，因为主题位于 LuCI 渲染层，只发布静态资源与
ucode 模板：

- **uhttpd**（默认）：开箱即用。
- **nginx**：在标准 `luci-nginx` / uwsgi 配置下即可工作，无需主题侧任何
  设置——所有 URL 都通过 `media` / `resource` /
  `dispatcher.build_url()` 生成，没有硬编码 `/cgi-bin/luci`；
  `/luci-static` 在两种服务器下都按普通静态目录提供服务。

**LuCI 页面与第三方应用** —— 所有面向标准 LuCI 布局的官方模块和第三方应用
都会在主题内正常渲染：外壳保持官方 DOM 契约
（`#topmenu`、`#modemenu`、`#tabmenu`、`#indicators`、`#maincontent`），
菜单/Tab/轮询指示器均由 `menu-basalt.js` 按公开 `ui` API 渲染。
即使第三方样式表自带全局重置（如 OpenClash），外壳几何也不会塌缩；
同时声明了 iStoreOS 应用（快捷向导、iStore、VUM）读取的暗色外观契约，
这些应用会自动以暗色渲染。

**浏览器** —— 现代内核（Chrome/Edge、Firefox、Safari 近年版本）获得完整
体验；旧内核通过 `@supports` 与静态回退值优雅降级（`color-mix`、`:has()`
等），功能与导航保持可用。

## 安装

### 方式一：编入固件 / 通过 feed 构建

1. 将包目录放入 buildroot 的 `package/luci-theme-basalt`
   （或从自定义 feed 建立软链接）。
2. 在 `make menuconfig` -> *LuCI* -> *Themes* 中选中
   **luci-theme-Basalt**。
3. 编译：

   ```sh
   make package/luci-theme-basalt/compile V=s
   ```

   产物 `.ipk`（25.12 等 apk 发行版为 `.apk`）位于
   `bin/packages/.../luci/` 下。

### 方式二：在运行中的路由器上安装软件包

```sh
opkg update
opkg install luci-theme-basalt_*.ipk
# 基于 apk 的发行版（24.10-SNAPSHOT / 25.12）：
# apk add --allow-untrusted luci-theme-basalt-*.apk
```

`uci-defaults` 脚本会注册主题并在全新安装时启用；包升级时绝不会覆盖用户
当前使用的主题。

### 方式三：直接部署文件（开发 / 快速试用）

```sh
# 模板
mkdir -p /usr/share/ucode/luci/template/themes/basalt
cp -a ucode/template/themes/basalt/*.ut \
      /usr/share/ucode/luci/template/themes/basalt/

# 静态资源
mkdir -p /www/luci-static/basalt
cp -a htdocs/luci-static/basalt/* /www/luci-static/basalt/
cp -a htdocs/luci-static/resources/menu-basalt.js \
      /www/luci-static/resources/

# 注册并启用
uci set luci.themes.Basalt=/luci-static/basalt
uci set luci.main.mediaurlbase=/luci-static/basalt
uci commit luci
```

> **不要**修改 `luci.main.resourcebase`。核心脚本（`cbi.js`、`luci.js`）
> 独立于所选主题，固定从 `/luci-static/resources` 提供。

### 启用 / 切换主题

- 网页界面：**系统 -> 系统 -> 语言和风格 -> 设计** -> 选择
  *Basalt*，然后刷新页面。
- 命令行：

  ```sh
  uci set luci.main.mediaurlbase=/luci-static/basalt
  uci commit luci
  /etc/init.d/rpcd reload
  ```

## 开发与测试

样式表 `cascade.css` 是零依赖构建产物：`styles/` 下每个切片首尾包一层
`@layer`，`build-css.mjs` 按 `tokens/base/theme/page` 顺序剥壳拼成一份
（打包时无需 Node，产物随仓库提交）。修改样式后本地重建：

```sh
node build-css.mjs
```

`tests/` 包含自包含的浏览器 harness，覆盖暗色 token、暗纹、pill/下拉的
disclosure 语义（aria/Esc/外部点击/边缘收窄）、tab、以及 1280/390 两种
视口的顶栏几何。可针对任意 openwrt/luci 分支的**真实** luci-base 核心
JS 运行：

```sh
node build-css.mjs
bash tests/assemble-site.sh openwrt-25.12 site
python3 tests/serve-harness.py site 8765 &
cd tests && npm install && npx playwright install chromium
node run-browser-tests.mjs http://127.0.0.1:8765/shell.html
```

## 卸载

```sh
# 若主题正在使用，先切回官方主题：
uci set luci.main.mediaurlbase=/luci-static/bootstrap
uci commit luci
opkg remove luci-theme-basalt
```

## 版本记录

| 版本 | 日期       | 说明                          |
|---------|------------|--------------------------------|
| 2.0.2   | 2026-10-09 | 修复第三方应用页面布局塌缩；适配 iStoreOS 应用暗色显示 |
| 2.0.1   | 2026-10-09 | 修复品牌标题换行与双模式固件导航缺失；更换原创背景暗纹；卡片半透明 |
| 2.0.0   | 2026-10-09 | 重写为暗色顶部导航（footstrap 视觉）；删除浅色模式与主题设置 |
| 1.1.3   | 2026-10-09 | 导航图标多语言适配与桌面侧栏亚克力 |
| 1.1.2   | 2026-10-09 | 修复侧栏高度链与子菜单图标重叠 |
| 1.1.1   | 2026-10-08 | 旧浏览器 CSS 回退与兼容性矩阵 |
| 1.1.0   | 2026-10-08 | 主题设置页（UCI）             |
| 1.0.0   | 2026-10-08 | Basalt 首个正式版本    |

2.0.0 为重大版本：旧版的主题设置页、`/etc/config/basalt` 与自定义
登录背景均已移除，主题不再读取任何 UCI 配置。

## 许可证

Apache License 2.0
