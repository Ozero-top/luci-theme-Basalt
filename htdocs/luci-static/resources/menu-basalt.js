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

/* ---------- Search ---------- */

/* Leaf pages only: a directory's href is '#' (renderMainMenu), so an index
 * entry pointing at one would 404 the navigation. The crumb is the parent
 * chain below the top mode level (modes contribute nothing). */
function collectLeaves(node, url, crumbs, out) {
	ui.menu.getChildren(node).forEach((child) => {
		if (url === '' && child.name === 'logout')
			return;

		const childUrl = url + '/' + child.name;
		const grandchildren = ui.menu.getChildren(child);

		if (grandchildren.length)
			collectLeaves(child, childUrl, url === '' ? crumbs : crumbs.concat(_(child.title)), out);
		else if (url !== '')
			out.push({ title: _(child.title), crumb: crumbs.join(' › '), href: L.url(url, child.name) });
	});
}

const SEARCH_INDEX = [];

function buildSearchIndex(tree) {
	SEARCH_INDEX.length = 0;
	collectLeaves(tree, '', [], SEARCH_INDEX);
}

function wireSearch() {
	const root = document.querySelector('#fs-search');
	if (!root)
		return;

	const field = root.querySelector('.fs-search-field'),
	      panel = root.querySelector('.fs-search-panel'),
	      input = root.querySelector('.fs-search-input'),
	      list = root.querySelector('.fs-search-list'),
	      empty = root.querySelector('.fs-search-empty');
	if (!field || !panel || !input || !list || !empty)
		return;

	/* the kbd hint is authored for PC keyboards */
	if (/Mac|iP(hone|ad|od)/.test(navigator.platform || ''))
		field.querySelector('kbd').textContent = '⌘ K';

	function setOpenState(on) {
		root.classList.toggle('open', on);
		field.setAttribute('aria-expanded', on ? 'true' : 'false');
	}

	function render(q) {
		const query = String(q || '').trim().toLowerCase();
		const hits = query
			? SEARCH_INDEX.filter((e) => (e.title + ' ' + e.crumb).toLowerCase().indexOf(query) !== -1)
			: SEARCH_INDEX;

		list.innerHTML = '';
		hits.forEach((e) => {
			const a = E('a', { 'class': 'fs-search-item', 'href': e.href }, [
				E('span', { 'class': 't' }, [ e.title ]),
				E('span', { 'class': 'p' }, [ e.crumb ])
			]);
			list.appendChild(E('li', {}, [ a ]));
		});
		empty.hidden = hits.length > 0;
		list.style.display = hits.length ? '' : 'none';
	}

	function open() {
		closeFlyouts();
		setOpenState(true);
		input.value = '';
		render('');
		/* focus once the panel is actually displayed */
		window.requestAnimationFrame(() => input.focus());
	}

	function close() {
		if (!root.classList.contains('open'))
			return;
		setOpenState(false);
		field.focus();
	}

	field.addEventListener('click', () => {
		if (root.classList.contains('open'))
			close();
		else
			open();
	});

	input.addEventListener('input', () => render(input.value));

	input.addEventListener('keydown', (ev) => {
		if (ev.key === 'Enter') {
			const first = list.querySelector('a.fs-search-item');
			if (first)
				window.location.href = first.getAttribute('href');
		}
		else if (ev.key === 'Escape') {
			ev.stopPropagation();
			close();
		}
	});

	/* click-outside: the panel, not the whole widget, is the popup */
	document.addEventListener('click', (ev) => {
		if (!ev.target.closest?.('#fs-search'))
			setOpenState(false);
	});

	document.addEventListener('keydown', (ev) => {
		if (ev.key === 'Escape' && root.classList.contains('open'))
			close();
		else if ((ev.ctrlKey || ev.metaKey) && String(ev.key).toLowerCase() === 'k') {
			ev.preventDefault();
			if (root.classList.contains('open'))
				close();
			else
				open();
		}
	});
}

/* ---------- Overview page grid injector ----------
 *
 * luci-mod-status renders the status overview as a flat run of
 * <h2 name="content"> + .cbi-section siblings under #view, one pair per
 * include, appended asynchronously as each include's promise resolves.
 * The Fluent layout needs them grouped into a card grid with per-card
 * heads, and CSS cannot do that alone: every card is a bare table
 * (only shape tests separate them) and the cards do not exist until the
 * includes resolve. So a MutationObserver classifies each section as it
 * arrives, converts its stock <h2> into a card head and moves everything
 * into the .fs-ovl grid container (styles/pages/20-overview.css).
 *
 * Class meaning (first match wins):
 *   ports  switch-port card — its boxes carry /port_*.svg images
 *   net    interface card   — any other .ifacebox card
 *   sto    meter card       — progressbars (mounts / storage)
 *   lease  data table       — has a header row (DHCP leases)
 *   sys    first key/value  — the system properties card
 *   mem    later key/value  — memory and anything else table-shaped
 */

const OV_PAGE = 'admin-status-overview';

/* Card-head glyphs; net reuses the chrome network mark (ICONS above). */
const OV_ICONS = Object.assign(Object.create(null), {
	sys:   '<circle cx="12" cy="12" r="8.5"/><path d="M12 11.2V16"/><path d="M12 8.2h.01"/>',
	mem:   '<path d="M3.5 12h4L10 6l4 12 2.5-6h4"/>',
	sto:   '<rect x="3.5" y="8" width="17" height="8" rx="2"/><path d="M7 12h.01M11 12h6"/>',
	ports: '<path d="M9 7V4M15 7V4"/><rect x="6.5" y="7" width="11" height="6.5" rx="1.5"/><path d="M12 13.5V20"/>',
	doc:   '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 9h6M9 12.5h6M9 16h4"/>'
});

function ovIcon(kind) {
	const body = OV_ICONS[kind]
		|| (kind === 'net' ? ICONS.network : null)
		|| ICONS._default;
	return '<svg class="fs-ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" '
		+ 'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
		+ body + '</svg>';
}

/* null: not rendered yet (the include appends later) — retried next pass */
function classifyOvSection(sec, state) {
	if (sec.querySelector('.ifacebox img[src*="/port_"]'))
		return 'ports';
	if (sec.querySelector('.ifacebox'))
		return 'net';
	if (sec.querySelector('.cbi-progressbar'))
		return 'sto';
	const table = sec.querySelector('.table');
	if (table && (table.querySelector('.th') || table.querySelector('.td:nth-child(3)')))
		return 'lease';
	if (table)
		return state.kv++ ? 'mem' : 'sys';
	return null;
}

function ovPass(view, state) {
	ovRaf = 0;
	if (view.getAttribute('data-page') !== OV_PAGE)
		return;

	/* a fresh page render drops the old grid, so the key/value counter
	 * that picks sys over mem resets with it */
	let wrap = view.querySelector(':scope > .fs-ovl');
	if (!wrap) {
		wrap = E('div', { 'class': 'fs-ovl' });
		state.kv = 0;
	}
	if (wrap.parentElement !== view)
		view.appendChild(wrap);

	Array.from(view.children).forEach((node) => {
		if (node === wrap || !node.classList?.contains('cbi-section'))
			return;
		const kind = node.dataset.fsKind || classifyOvSection(node, state);
		if (!kind)
			return;
		if (!node.dataset.fsKind) {
			node.dataset.fsKind = kind;
			node.classList.add('fs-ovl-' + kind);
		}
		/* the stock <h2> directly before the section is the card title */
		const h2 = node.previousElementSibling;
		if (h2 && h2.matches('h2[name="content"]') && !node.querySelector(':scope > .fs-ovl-head')) {
			const title = h2.textContent.trim();
			h2.remove();
			node.prepend(E('div', { 'class': 'fs-ovl-head' }, [
				E('span', { 'class': 'fs-ovl-ico', 'aria-hidden': 'true' }, ovIcon(kind)),
				E('h3', { 'class': 'fs-ovl-title' }, [title])
			]));
		}
		if (node.parentElement !== wrap)
			wrap.appendChild(node);
	});

	/* one card per column pair: with no storage card, memory spans both rows */
	wrap.classList.toggle('fs-ovl-nosto', !wrap.querySelector('.fs-ovl-sto'));
}

let ovRaf = 0;

function watchOverview() {
	const view = document.getElementById('view');
	if (!view)
		return;
	const state = { kv: 0 };
	const schedule = () => {
		if (ovRaf)
			return;
		ovRaf = window.requestAnimationFrame(() => ovPass(view, state));
	};
	/* childList only: poll updates replace a card's innards, never its
	 * position, so attribute/subtree churn needs no re-classification */
	new MutationObserver(schedule).observe(view, { childList: true });
	schedule();
}

/* ---------- Fluent page head (styles/pages/15-pagehead.css) ---------- */

/* Feeds pgBreadcrumbs(); assigned once per render() */
let fsMenuTree = null;
const pgState = { page: null };

/* The last two named nodes of the dispatch path ("Network › Interfaces"),
 * decorative only — the sr-only .fs-title stays the real heading */
function pgBreadcrumbs() {
	const names = L.env.dispatchpath || [];
	let node = fsMenuTree;
	const trail = [];

	for (let i = 0; node && i < names.length; i++) {
		node = node.children && node.children[names[i]];
		if (node?.title)
			trail.push(_(node.title));
	}

	return trail.slice(-2);
}

function pgheadPass() {
	const content = document.querySelector('.fs-content');
	if (!content)
		return;

	/* data-page is server-rendered on .fs-content; #view may repeat it */
	const view = document.getElementById('view');
	const page = content.getAttribute('data-page')
		|| (view ? view.getAttribute('data-page') : '') || '';

	const old = content.querySelector(':scope > .fs-pghead');

	/* only an action bar OUTSIDE the head triggers a rebuild: once
	 * migrated it lives inside .fs-pghead, and re-using the node instead
	 * of rebuilding keeps its LuCI event listeners alive */
	const stray = Array.from(content.querySelectorAll('.cbi-page-actions'))
		.find((a) => !a.closest('.fs-pghead'));

	if (old && pgState.page === page && !stray)
		return;
	pgState.page = page;

	const actions = E('div', { 'class': 'fs-pg-actions' });
	/* a page change rebuilds the head — carry the already-migrated bar
	 * over instead of dropping it (no-op on the stock no-SPA flow) */
	const carried = old?.querySelector('.cbi-page-actions');
	if (stray) {
		/* the bar may end up outside its <form>; re-bind the controls so
		 * submit/save keep working (nested forms are left alone) */
		const form = stray.closest('form');
		if (form && !form.id)
			form.id = 'fs-form-' + (page || 'page');
		if (form)
			stray.querySelectorAll('button, input, select, textarea, label').forEach((ctl) => {
				if (ctl.closest('form') === form)
					ctl.setAttribute('form', form.id);
			});
		actions.appendChild(stray);
	} else if (carried) {
		actions.appendChild(carried);
	}

	const crumbs = pgBreadcrumbs();
	const title = document.querySelector('.fs-title-main')?.textContent.trim() || '';
	/* E() takes a single data argument: children go in as one array */
	const head = E('div', { 'class': 'fs-pghead' }, [
		E('div', { 'class': 'fs-pghead-main' }, [
			...(crumbs.length > 1 ? [E('nav', { 'class': 'fs-crumbs', 'aria-hidden': 'true' },
				crumbs.map((c) => E('span', {}, [c])))] : []),
			E('div', { 'class': 'fs-pg-title', 'aria-hidden': 'true' }, [title])
		]),
		actions
	]);

	/* stock CBI repeats the page title as the map heading; with the head
	 * carrying it the duplicate is noise (netPass falls back to the page
	 * title for its card head) */
	if (title)
		content.querySelectorAll('.cbi-map > h2[name="content"]').forEach((h2) => {
			if (h2.textContent.trim() === title)
				h2.remove();
		});

	old?.remove();

	/* before #tabmenu, not #view: the DOM must read head → tabs → alerts
	 * → content (the uci-changes banner is server-rendered after
	 * #tabmenu in header.ut) */
	const tabmenu = content.querySelector(':scope > #tabmenu');
	content.insertBefore(head, tabmenu || view || null);
}

/* ---------- Interfaces card head ---------- */

const NET_PAGE = 'admin-network-interfaces';

function netPass(content) {
	if ((content.getAttribute('data-page') || '') !== NET_PAGE)
		return;

	const sec = content.querySelector('.cbi-section');
	if (!sec || sec.querySelector(':scope > .fs-card-head'))
		return;

	/* the stock <h2> before the section (or at the top of its map) is
	 * the card title — same contract as ovPass; pgheadPass may have
	 * absorbed it as a duplicate of the page title, in which case the
	 * card head reuses the page title */
	let h2 = sec.previousElementSibling;
	if (!(h2 && h2.matches('h2[name="content"]')))
		h2 = sec.closest('.cbi-map')?.querySelector(':scope > h2[name="content"]');
	const title = h2 ? h2.textContent.trim()
		: content.querySelector('.fs-pg-title')?.textContent.trim() || '';
	if (!title)
		return;
	if (h2)
		h2.remove();

	/* an "Add interface" control, wherever the view parked it — unless
	 * it belongs to the (migrated) page actions bar */
	const more = Array.from(content.querySelectorAll('.cbi-button-add'))
		.find((b) => !b.closest('.fs-pghead') && !b.closest('.cbi-page-actions'));

	sec.prepend(E('div', { 'class': 'fs-card-head' }, [
		E('span', { 'class': 'fs-card-ico', 'aria-hidden': 'true' }, ovIcon('net')),
		E('h3', { 'class': 'fs-card-title' }, [title]),
		...(more ? [E('div', { 'class': 'fs-card-more' }, [more])] : [])
	]));
}

/* ---------- Page-level watcher ---------- */

let pgRaf = 0;
let pgObserver = null;

function watchPage() {
	const view = document.getElementById('view');
	const content = document.querySelector('.fs-content');
	if (!content || pgObserver)
		return;

	const schedule = () => {
		if (pgRaf)
			return;
		pgRaf = window.requestAnimationFrame(() => {
			pgRaf = 0;
			pgheadPass();
			netPass(document.querySelector('.fs-content') || content);
		});
	};

	/* #view is the stable node the dispatcher keeps refilling (spinner →
	 * view nodes → footer); the passes are idempotent, so the extra
	 * invocations are cheap no-ops. The head's own churn in .fs-content
	 * is a sibling of #view, never a child, so it cannot re-trigger. */
	pgObserver = new MutationObserver(schedule);
	pgObserver.observe(view || content, { childList: true });
	schedule();
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

		/* the uci-changes banner's × (header.ut): dismiss is cosmetic,
		 * the poll indicators keep tracking the real state */
		document.addEventListener('click', (ev) => {
			const btn = ev.target.closest?.('.fs-alert-close');
			if (btn)
				btn.closest('.alert-message')?.remove();
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

		wireSearch();
	},

	render: function(tree) {
		fsMenuTree = tree;

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
		buildSearchIndex(tree);

		if (L.env.dispatchpath.length >= 3) {
			let node = tree, url = '';
			for (let i = 0; i < 3 && node; i++) {
				node = node.children && node.children[L.env.dispatchpath[i]];
				url = url + (url ? '/' : '') + L.env.dispatchpath[i];
			}
			if (node)
				renderTabMenu(node, url);
		}

		/* status overview: group the stock include cards into the Fluent
		 * grid (styles/pages/20-overview.css); the observer rides along
		 * for the whole session and no-ops on every other page */
		watchOverview();
		watchPage();
	}
});
