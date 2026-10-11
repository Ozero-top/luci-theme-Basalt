'use strict';
'require baseclass';
'require ui';

/*
 * luci-theme-Basalt v2 — top-bar menu renderer.
 *
 * Self-contained port of luci-theme-footstrap's chrome menu (Apache-2.0),
 * minus the SPA router, fit engine, rail and preferences: the layout is
 * fixed to the top bar, so every section with children is a dropdown
 * panel (hover via CSS, tap toggles .open), never an accordion.
 *
 * DOM hooks the markup relies on (header.ut):
 *   #topmenu     -> bar section pills and their dropdown panels
 *   #modemenu    -> top mode switcher (hidden when there is one mode)
 *   #tabmenu     -> deep navigation tabs (filled by the dispatcher too)
 *   #indicators  -> poll/unsaved indicators, populated by luci-base
 *
 * Icons are keyed by the stable dispatcher node NAME, never the
 * translated title, so localized builds get the same glyphs. The bar's
 * CSS hides the top-level icons (pills are text-only); they stay in the
 * markup as the icon contract footstrap's stylesheets expect.
 */

/* Null prototype: a third-party menu.d node called `constructor` or
 * `__proto__` must not resolve out of Object.prototype to a truthy
 * non-string and skip the _default fallback into innerHTML. */
const ICONS = Object.assign(Object.create(null), {
	status:   '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
	system:   '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
	services: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.6"/>',
	network:  '<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8 16 16 8M8 18h7.5M18 8.5V16"/>',
	vpn:      '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
	docker:   '<rect x="3" y="11" width="4" height="4" rx=".7"/><rect x="8" y="11" width="4" height="4" rx=".7"/><rect x="13" y="11" width="4" height="4" rx=".7"/><rect x="8" y="6" width="4" height="4" rx=".7"/><path d="M18 13c0 4-3 6-8 6-4 0-7-2-7-4"/>',
	_default: '<circle cx="12" cy="12" r="8.5"/>'
});

/* Client half of the server-side icon.ut partial: every chrome icon is
 * the same 24x24 stroked outline differing only in path data. */
function iconSvg(name) {
	const key = String(name || '').toLowerCase();
	const body = ICONS[key]
		|| ((/vpn|wireguard|openvpn/).test(key) ? ICONS.vpn : null)
		|| ((/dock|container|lxc/).test(key) ? ICONS.docker : null)
		|| ((/net|wifi|wireless|firewall|dhcp/).test(key) ? ICONS.network : null)
		|| ((/serv|dnsmasq|cron/).test(key) ? ICONS.services : null)
		|| ((/stat|overview|dash/).test(key) ? ICONS.status : null)
		|| ICONS._default;
	return '<svg class="fs-ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" '
		+ 'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
		+ body + '</svg>';
}

const TRIGGER = ':scope > a';
const OPEN_LI = '#topmenu > li.open';
const EDGE_GAP = 8;

/* Every open/close goes through here so .open and aria-expanded agree. */
function setOpen(li, on) {
	li.classList.toggle('open', on);
	li.querySelector(TRIGGER)?.setAttribute('aria-expanded', on ? 'true' : 'false');
}

function closeFlyouts(except) {
	document.querySelectorAll(OPEN_LI).forEach((o) => {
		if (o !== except) setOpen(o, false);
	});
}

/* A panel hangs off its own item (li position:relative, ul inset-inline:0);
 * near the right viewport edge it would overflow, so nudge it back in.
 * Measured in a rAF because on the opening gesture the :hover/.open rule
 * has often not applied yet and the panel still measures 0x0. */
function clampDropdown(li) {
	const menu = li.querySelector(':scope > ul');
	if (!menu)
		return;

	if (li._fdClampRaf)
		window.cancelAnimationFrame(li._fdClampRaf);

	li._fdClampRaf = window.requestAnimationFrame(() => {
		li._fdClampRaf = 0;
		menu.style.left = '';
		const r = menu.getBoundingClientRect();
		if (!r.width)
			return;
		const overflowRight = r.right - (window.innerWidth - EDGE_GAP);
		if (overflowRight > 0)
			menu.style.left = -Math.min(overflowRight, r.left - EDGE_GAP) + 'px';
	});
}

function clearClamps() {
	document.querySelectorAll('#topmenu ul').forEach((m) => { m.style.left = ''; });
}

/* An <a role="button"> gets Enter natively but not Space; a disclosure
 * control must answer both. */
function wireSpaceKey(link) {
	link.addEventListener('keydown', (ev) => {
		if (ev.key !== ' ')
			return;
		ev.preventDefault();
		link.click();
	});
}

/* Active mode's sections -> #topmenu: text pills, one dropdown panel
 * level deep. dispatchpath = [mode, section, subsection, …]; sections
 * sit at index (level+1) because the first call gets the mode node. */
function renderMainMenu(tree, url, level) {
	const ul = level ? E('ul', {}) : document.querySelector('#topmenu');
	const children = ui.menu.getChildren(tree);

	if (children.length === 0 || level > 1)
		return E([]);

	const idx = (level || 0) + 1;

	children.forEach((child) => {
		/* the bar carries its own Log out control, so the tree's
		 * top-level admin/logout node would appear twice */
		if (!level && child.name === 'logout')
			return;

		const submenu = renderMainMenu(child, url + '/' + child.name, (level || 0) + 1);
		const hasSub = !!submenu.firstElementChild;
		const isActive = (L.env.dispatchpath[idx] === child.name);

		const chevron = hasSub
			? '<svg class="fs-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
			: '';

		/* active only paints; aria-current belongs on the LEAF alone — a
		 * section header is a disclosure button, not a link to this page */
		const link = E('a', {
			'href': hasSub ? '#' : L.url(url, child.name),
			'class': (isActive && !hasSub) ? 'active' : null,
			'aria-current': (isActive && !hasSub) ? 'page' : null
		});
		link.innerHTML = (level ? '' : iconSvg(child.name)) + '<span class="fs-label"></span>' + chevron;
		link.querySelector('.fs-label').textContent = _(child.title);

		const li = E('li', {
			'class': [
				isActive ? 'active' : '',
				hasSub ? 'has-sub' : ''
			].join(' ').trim()
		}, [ link, submenu ]);
		/* stable node-name hook: titles are translated, node names are not */
		if (!level)
			li.dataset.name = child.name;

		if (hasSub) {
			/* Injective id: fold node names to code points so two
			 * third-party names differing in punctuation can't collide. */
			const subId = 'fd-sub-' +
				String(child.name).replace(/[^a-z0-9]/gi, (c) => '_' + c.charCodeAt(0).toString(16)) +
				'-' + idx;
			submenu.id = subId;
			link.setAttribute('role', 'button');
			link.setAttribute('aria-controls', subId);
			link.setAttribute('aria-expanded', 'false');

			link.addEventListener('click', (ev) => {
				ev.preventDefault();
				const open = li.classList.contains('open');
				closeFlyouts();
				setOpen(li, !open);
				if (!open)
					clampDropdown(li);
			});

			wireSpaceKey(link);

			/* hover opens purely via CSS; once a real mouse enters, drop a
			 * tap-opened panel so two never stack and place this one.
			 * Guarded on pointerType: a touch tap fires pointerenter
			 * ('touch') before the click and would break tap-to-close. */
			li.addEventListener('pointerenter', (ev) => {
				if (ev.pointerType === 'mouse')
					closeFlyouts();
				clampDropdown(li);
			});
		}

		ul.appendChild(li);
	});

	return ul;
}

/* Modes -> #modemenu; drives the section menu for the active mode. */
function renderModeMenu(root) {
	const ul = document.querySelector('#modemenu');
	const children = ui.menu.getChildren(root);

	/* Highlight follows the REQUESTED mode, but the section pills are
	 * built for the DISPATCHED one: some firmware ship an extra top-level
	 * landing mode (often titled "Overview") whose action aliases into
	 * admin/status/overview. ui.menu.getChildren() swaps an alias node's
	 * children for the target node's — frequently empty — so rendering the
	 * active alias copy would leave the bar with zero pills. Walk the
	 * original tree using dispatchpath instead. */
	const reqSeg = L.env.requestpath[0];
	const dispSeg = L.env.dispatchpath[0];

	children.forEach((child, index) => {
		const isActive = (reqSeg != null)
			? child.name === reqSeg
			: (dispSeg != null ? child.name === dispSeg : index === 0);

		ul.appendChild(E('li', { 'class': isActive ? 'active' : '' }, [
			E('a', { 'href': L.url(child.name) }, [ _(child.title) ])
		]));
	});

	const sectionName = dispSeg || reqSeg || children[0]?.name;
	const sectionNode = root.children ? root.children[sectionName] : null;
	if (sectionNode)
		renderMainMenu(sectionNode, sectionName);

	/* render() presets .single + inline hide; correct it now that the
	 * real mode count is known (a 2-mode firmware shows the switcher) */
	ul.classList.toggle('single', children.length <= 1);
	if (children.length > 1)
		ul.style.display = '';
}

/* Section tabs -> #tabmenu (horizontal), recursive down the dispatch path. */
function renderTabMenu(node, url, level) {
	const container = document.querySelector('#tabmenu');
	const ul = E('ul', { 'class': 'tabs' });
	const children = ui.menu.getChildren(node);
	let activeNode = null;

	children.forEach((child) => {
		const isActive = (L.env.dispatchpath[3 + (level || 0)] === child.name);
		ul.appendChild(E('li', {
			'class': 'tabmenu-item-%s %s'.format(child.name, isActive ? 'active' : '')
		}, [
			E('a', {
				'href': L.url(url, child.name),
				'aria-current': isActive ? 'page' : null
			}, [ _(child.title) ])
		]));
		if (isActive)
			activeNode = child;
	});

	if (ul.children.length === 0)
		return;

	container.appendChild(ul);
	container.style.display = '';

	if (activeNode)
		renderTabMenu(activeNode, url + '/' + activeNode.name, (level || 0) + 1);
}

return baseclass.extend({
	__init__: function() {
		ui.menu.load().then(L.bind(this.render, this));

		/* click-outside closes an open panel; Escape closes it and hands
		 * focus back to its trigger (WCAG 2.2 SC 1.4.13). */
		document.addEventListener('click', (ev) => {
			if (!ev.target.closest?.('#topmenu > li.has-sub'))
				closeFlyouts();
		});
		document.addEventListener('keydown', (ev) => {
			if (ev.key !== 'Escape')
				return;
			const open = document.querySelector(OPEN_LI);
			if (!open)
				return;
			const trigger = open.querySelector(TRIGGER);
			closeFlyouts();
			trigger?.focus();
		});

		/* a clamp computed at the old width is wrong at the new one;
		 * coalesced because resize fires dozens of times per drag.
		 * Width only: mobile URL-bar show/hide fires resize continuously. */
		let lastWidth = window.innerWidth;
		let reclampRaf = 0;
		window.addEventListener('resize', () => {
			if (window.innerWidth === lastWidth)
				return;
			lastWidth = window.innerWidth;
			if (reclampRaf)
				return;
			reclampRaf = window.requestAnimationFrame(() => {
				reclampRaf = 0;
				clearClamps();
			});
		});
	},

	render: function(tree) {
		const modemenu = document.querySelector('#modemenu'),
		      topmenu = document.querySelector('#topmenu'),
		      tabmenu = document.querySelector('#tabmenu');

		/* inline, not a class: .fs-sidebar #modemenu's id specificity outranks
		 * the .fs-modemenu { display:none } base rule, so the single-mode strip
		 * must be hidden the same way fs-chrome hides it */
		modemenu.innerHTML = '';
		modemenu.style.display = 'none';
		modemenu.classList.add('single');
		topmenu.innerHTML = '';
		tabmenu.innerHTML = '';
		tabmenu.style.display = 'none';

		renderModeMenu(tree);

		if (L.env.dispatchpath.length >= 3) {
			let node = tree, url = '';
			for (let i = 0; i < 3 && node; i++) {
				node = node.children && node.children[L.env.dispatchpath[i]];
				url = url + (url ? '/' : '') + L.env.dispatchpath[i];
			}
			if (node)
				renderTabMenu(node, url);
		}
	}
});
