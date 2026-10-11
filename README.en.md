# luci-theme-Basalt

[![LuCI compatibility matrix](https://github.com/Ozero-top/luci-theme-Basalt/actions/workflows/luci-compat.yml/badge.svg?branch=main)](https://github.com/Ozero-top/luci-theme-Basalt/actions/workflows/luci-compat.yml)

[简体中文](README.md) | **English**

A **dark top-navigation** theme for [OpenWrt LuCI](https://github.com/openwrt/luci),
built on the current ucode-template LuCI stack (OpenWrt 22.03 through
25.12 / SNAPSHOT). The v2 visual layer is vendored from
 [luci-theme-footstrap](https://github.com/VizzleTF/luci-theme-footstrap)（Apache-2.0）。

- Charcoal dark surfaces: `#1c2128` page / `#22272e` cards, blue accent `#569df5`
- Horizontal top navigation: text-only pills, hover/tap dropdown panels
- 12 px rounded cards, Manrope→system font stack, built-in original geometric pattern texture
- Dark-only: no light scheme, no appearance page, no UCI configuration
- Login is a dark centered card rendered server-side (works with JS off,
  keeps every pluggable-auth/2FA field)
- Below 860 px the bar wraps to two rows: brand row plus a scrollable pill strip
- Same menu/tabs/indicators DOM contract as stock, so every LuCI module keeps working

## Directory layout

```
luci-theme-Basalt/
├── Makefile                                  # OpenWrt package (+luci-base)
├── build-css.mjs                             # dev-only: concat styles/ slices into cascade.css
├── styles/                                   # CSS source slices (@layer tokens/base/theme/page)
├── ucode/template/themes/basalt/       # ucode templates (.ut)
│   ├── head_meta.ut
│   ├── header.ut / footer.ut                 # admin shell (containers paired)
│   └── sysauth.ut                            # login page (blank header/footer)
├── htdocs/luci-static/
│   ├── basalt/                         # theme media root
│   │   ├── css/cascade.css                   # the single stylesheet (build output, committed)
│   │   ├── pattern/texture.svg               # built-in original pattern texture
│   │   ├── logo.svg / logo_48.png / app-icon-192.png / manifest.json
│   └── resources/
│       └── menu-basalt.js              # top-bar menu renderer (self-contained, ui/baseclass only)
├── root/etc/uci-defaults/30_luci-theme-Basalt
└── tests/                                    # cross-branch browser harness (1280 + 390 viewports)
```

Runtime mapping (performed by `luci.mk`):

| Source                              | Installed on target                         |
|-------------------------------------|---------------------------------------------|
| `ucode/**`                          | `/usr/share/ucode/luci/template/themes/basalt/` |
| `htdocs/luci-static/basalt/`  | `/www/luci-static/basalt/`            |
| `htdocs/luci-static/resources/`     | `/www/luci-static/resources/`               |
| `root/etc/uci-defaults/...`         | `/etc/uci-defaults/` (run once on install)  |

## Requirements

- OpenWrt with the ucode LuCI stack (22.03 through 25.12 / SNAPSHOT)
- `luci-base` (declared as the only package dependency)

## Compatibility

**OpenWrt / LuCI server stack** — the theme uses the ucode template
LuCI (the same stack as the stock 22.03+ themes) and the standard
`luci-base` dispatcher:

| Stack | Status |
|--------|--------|
| OpenWrt 25.12.x (apk; latest stable, verified on 25.12) | Supported |
| OpenWrt 24.10.x (opkg) | Supported |
| OpenWrt 23.05, 22.03 | Supported |
| ImmortalWrt on the matching baselines (22.03 / 23.05 / 24.10) | Supported |
| OpenWrt 21.02 and older (Lua `.htm` template LuCI) | Not supported |

Compatibility is locked by CI: every push runs the same browser harness
against the real `luci-base` core of openwrt-22.03 / 23.05 / 24.10 /
25.12 (required) and master (non-blocking canary), at both 1280 px and
390 px viewports, with zero tolerated console/network errors.

**Web server** — transparent, because the theme sits on the LuCI
rendering layer and ships only static assets plus ucode templates:

- **uhttpd** (default): works out of the box.
- **nginx**: works with the standard `luci-nginx` / uwsgi setup.
  No theme-side configuration is needed — all URLs are built via
  `media` / `resource` / `dispatcher.build_url()`, nothing hardcodes
  `/cgi-bin/luci`, and `/luci-static` is served as plain static files
  by both servers.

**LuCI pages and third-party apps** — every official module and
third-party application that targets the standard LuCI layout renders
inside the theme: the shell keeps the stock DOM contract
(`#topmenu`, `#modemenu`, `#tabmenu`, `#indicators`, `#maincontent`),
and menu/tabs/poll indicators are rendered by `menu-basalt.js`
using only public `ui` APIs. The shell also keeps its geometry when a
third-party stylesheet ships a global reset (e.g. OpenClash), and
declares the dark-appearance contract read by iStoreOS apps
(quickstart, iStore, VUM), so they render in dark mode automatically.

**Browsers** — recent Chrome/Edge, Firefox and Safari engines get the
full experience; older engines degrade gracefully via `@supports` and
static-value fallbacks (`color-mix`, `:has()`, …), with all functions
and navigation still available.

## Install

### Option A — build into firmware / via feed

1. Put the package directory under `package/luci-theme-basalt` in your
   buildroot (or symlink it from a custom feed).
2. Select it in `make menuconfig` -> *LuCI* -> *Themes* ->
   **luci-theme-Basalt**.
3. Build:

   ```sh
   make package/luci-theme-basalt/compile V=s
   ```

   The resulting `.ipk` (or `.apk` on apk-based releases such as 25.12)
   is under `bin/packages/.../luci/`.

### Option B — install the package on a running router

```sh
opkg update
opkg install luci-theme-basalt_*.ipk
# apk-based releases (24.10-SNAPSHOT / 25.12):
# apk add --allow-untrusted luci-theme-basalt-*.apk
```

The `uci-defaults` script registers the theme and activates it on a fresh
install. On package upgrade it never overrides the user's current theme.

### Option C — deploy files directly (development / quick test)

```sh
# templates
mkdir -p /usr/share/ucode/luci/template/themes/basalt
cp -a ucode/template/themes/basalt/*.ut \
      /usr/share/ucode/luci/template/themes/basalt/

# media
mkdir -p /www/luci-static/basalt
cp -a htdocs/luci-static/basalt/* /www/luci-static/basalt/
cp -a htdocs/luci-static/resources/menu-basalt.js \
      /www/luci-static/resources/

# register + enable
uci set luci.themes.Basalt=/luci-static/basalt
uci set luci.main.mediaurlbase=/luci-static/basalt
uci commit luci
```

> Do **not** change `luci.main.resourcebase`. Core scripts (`cbi.js`,
> `luci.js`) are served from `/luci-static/resources` independently of the
> selected theme.

### Enable / switch

- Web UI: **System -> System -> Language and Style -> Design** ->
  *Basalt*, then refresh.
- CLI:

  ```sh
  uci set luci.main.mediaurlbase=/luci-static/basalt
  uci commit luci
  /etc/init.d/rpcd reload
  ```

## Development & tests

`cascade.css` is a zero-dependency build output: each slice under
`styles/` is wrapped in one `@layer`, and `build-css.mjs` unwraps and
concatenates them in `tokens/base/theme/page` order (no Node needed for
packaging — the output is committed). Rebuild after editing styles:

```sh
node build-css.mjs
```

`tests/` contains a self-contained browser harness covering the dark
tokens, the pattern layer, pill/dropdown disclosure semantics
(aria/Escape/outside-click/edge-clamp), tabs and the bar geometry at
both 1280 px and 390 px. It runs against the **real** luci-base core
JS of any openwrt/luci branch:

```sh
node build-css.mjs
bash tests/assemble-site.sh openwrt-25.12 site
python3 tests/serve-harness.py site 8765 &
cd tests && npm install && npx playwright install chromium
node run-browser-tests.mjs http://127.0.0.1:8765/shell.html
```

## Uninstall

```sh
# switch back to a stock theme first if it was active:
uci set luci.main.mediaurlbase=/luci-static/bootstrap
uci commit luci
opkg remove luci-theme-basalt
```

## Versioning

| Version | Date       | Notes                          |
|---------|------------|--------------------------------|
| 2.0.2   | 2026-10-09 | Fix layout collapse on third-party app pages; dark-mode support for iStoreOS apps |
| 2.0.1   | 2026-10-09 | Fix brand title wrapping and missing nav on dual-mode firmware; original pattern texture; translucent cards |
| 2.0.0   | 2026-10-09 | Rewrite as a dark top-navigation theme (footstrap look); light mode and the settings page removed |
| 1.1.3   | 2026-10-09 | Locale-independent nav icons, acrylic desktop sidebar |
| 1.1.2   | 2026-10-09 | Fix sidebar height chain and submenu icon overlap |
| 1.1.1   | 2026-10-08 | Browser CSS fallbacks & compat matrix |
| 1.1.0   | 2026-10-08 | Theme settings page (UCI)      |
| 1.0.0   | 2026-10-08 | Initial Basalt release  |

2.0.0 is a major release: the old settings page,
`/etc/config/basalt` and custom login backgrounds were removed;
the theme no longer reads any UCI configuration.

## License

Apache License 2.0
