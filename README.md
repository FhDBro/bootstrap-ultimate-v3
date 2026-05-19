# Bootstrap Ultimate v3

This is an export of the active customized LuCI `bootstrap` theme from an OpenWrt router.

Exported from:

- OpenWrt `25.12.4`
- LuCI theme package: `luci-theme-bootstrap`
- Active media URL: `/luci-static/bootstrap`
- Active theme: `bootstrap`

## Contents

- `rootfs/` - installable mirror of the router filesystem paths
- `bootstrap-static/` - theme static files from `/www/luci-static/bootstrap`
- `bootstrap-templates/` - LuCI templates from `/usr/share/ucode/luci/template/themes/bootstrap`
- `resources/` - related LuCI bootstrap resource scripts
- `metadata/` - package file list, LuCI config, and exported path inventory
- `luci-theme-bootstrap-custom.tar.gz` - original archive copied from the router

The dark and light variants are symlinks to the same customized bootstrap theme, matching the router.

## Install On OpenWrt

Copy this repository to the router, then run:

```sh
sh install.sh
```

Or copy the `rootfs/` contents manually over `/`:

```sh
cp -a rootfs/. /
uci set luci.main.mediaurlbase='/luci-static/bootstrap'
uci set luci.main.theme='bootstrap'
uci commit luci
/etc/init.d/uhttpd restart
```

## Files Added By Customization

The customized router had these extra files that are not part of the stock `luci-theme-bootstrap` package file list:

- `/www/luci-static/bootstrap/fwrt-global-fixes.css`
- `/www/luci-static/bootstrap/fwrt-global-fixes.js`
