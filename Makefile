#
# Copyright (C) 2026 Basalt Theme Contributors
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Basalt Theme - dark top navigation theme for LuCI
LUCI_DEPENDS:=+luci-base
PKG_VERSION:=2.0.5
PKG_RELEASE:=1

# Keep modern CSS (backdrop-filter, custom properties, :has()) untouched.
CONFIG_LUCI_CSSTIDY:=

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
