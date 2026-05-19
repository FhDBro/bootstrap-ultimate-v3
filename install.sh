#!/bin/sh
set -eu

cd "$(dirname "$0")"

if [ "$(id -u)" != "0" ]; then
	echo "Run as root on the OpenWrt router." >&2
	exit 1
fi

cp -a rootfs/. /

uci set luci.main.mediaurlbase='/luci-static/bootstrap'
uci set luci.main.theme='bootstrap'
uci set luci.themes.Bootstrap='/luci-static/bootstrap'
uci set luci.themes.BootstrapDark='/luci-static/bootstrap-dark'
uci set luci.themes.BootstrapLight='/luci-static/bootstrap-light'
uci commit luci

if [ -x /etc/init.d/uhttpd ]; then
	/etc/init.d/uhttpd restart
fi

echo "Installed custom LuCI bootstrap theme."

