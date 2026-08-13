window.__ModuleLoader__.load({
	id: "dsh-web-background",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		const { jsx, jsxs, Fragment } = require("react/jsx-runtime");

		// ── constants ────────────────────────────────────────────────────────────

		/** Host settings namespace owned by this plugin (see lib/index.js). */
		const NAMESPACE = "web-background";
		/** Locale namespace owning this feature's settings-page copy. */
		const LOCALE_NS = "settings.web-background";
		/** Theme token backing the app frame / conversation surface. */
		const TOKEN_BG_BASE = "--dsw-alias-bg-base";
		/** Theme token backing the sidebar fill. */
		const TOKEN_SIDEBAR = "--dsw-specific-sidebar-fill";
		/** Override-layer identity (one layer per source; re-overrides replace it). */
		const OVERRIDE_SOURCE = "dsh-web-background";
		/** Local-import size cap: settings persist to a local config file, so keep the embedded data URL modest. */
		const MAX_IMPORT_BYTES = 1024 * 1024;
		/** Persist coalescing window: rapid changes apply instantly and are flushed together once idle. */
		const DEBOUNCE_MS = 250;
		/** Pending-edit marker meaning "unset this field" (restore the schema default). */
		const UNSET = Symbol("unset");
		/** Fields a "reset to defaults" unset restores to their schema defaults. */
		const RESET_FIELDS = [
			"enabled",
			"mode",
			"colorLight",
			"colorDark",
			"gradientAngle",
			"gradientLightStart",
			"gradientLightEnd",
			"gradientDarkStart",
			"gradientDarkEnd",
			"imageUrl",
			"imageFit",
			"imageOverlay",
			"applyToSidebar",
		];

		/** Fallbacks used while the settings scope has not delivered a value yet. */
		const DEFAULTS = {
			enabled: false,
			mode: "color",
			colorLight: "#f5f6f8",
			colorDark: "#0e1116",
			gradientAngle: 135,
			gradientLightStart: "#f5f7fa",
			gradientLightEnd: "#c3cfe2",
			gradientDarkStart: "#0f2027",
			gradientDarkEnd: "#2c5364",
			imageUrl: "",
			imageFit: "cover",
			imageOverlay: 0,
			applyToSidebar: false,
		};

		const GRADIENT_PRESETS = [
			{ id: "aurora", angle: 135, lightStart: "#f5f7fa", lightEnd: "#c3cfe2", darkStart: "#0f2027", darkEnd: "#2c5364" },
			{ id: "sunset", angle: 135, lightStart: "#ffecd2", lightEnd: "#fcb69f", darkStart: "#42275a", darkEnd: "#734b6d" },
			{ id: "ocean", angle: 180, lightStart: "#e0eafc", lightEnd: "#cfdef3", darkStart: "#141e30", darkEnd: "#243b55" },
			{ id: "forest", angle: 135, lightStart: "#dceee8", lightEnd: "#b7d8c9", darkStart: "#1a2a22", darkEnd: "#2f4f3f" },
		];

		const COLOR_PRESETS = [
			{ id: "mist", light: "#f5f6f8", dark: "#0e1116" },
			{ id: "cream", light: "#faf6ef", dark: "#1d1a14" },
			{ id: "slate", light: "#eef1f6", dark: "#0d1117" },
			{ id: "lavender", light: "#f3f0fa", dark: "#171325" },
		];

		// ── styles (injected once at materialization; claimed for HMR bookkeeping) ──

		const CSS = [
			".wb-root{display:flex;flex-direction:column;gap:16px;padding-bottom:4px}",
			".wb-card{display:flex;flex-direction:column;gap:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:16px}",
			".wb-cardtitle{font-size:13px;font-weight:500;color:var(--dsw-alias-label-secondary)}",
			".wb-row{display:flex;align-items:center;justify-content:space-between;gap:12px}",
			".wb-label{font-size:13px;color:var(--dsw-alias-label-primary)}",
			".wb-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}",
			".wb-field{display:flex;flex-direction:column;gap:6px}",
			".wb-input,.wb-select{box-sizing:border-box;width:100%;height:32px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:0 10px;font-size:13px;outline:none}",
			".wb-input:focus,.wb-select:focus{border-color:var(--dsw-alias-state-business-primary)}",
			".wb-seg{display:flex;gap:6px}",
			".wb-segbtn{flex:1;height:32px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:8px;font-size:13px;cursor:pointer}",
			".wb-segbtn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".wb-segbtn-active{background:var(--dsw-alias-bg-base);border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary)}",
			".wb-segbtn:disabled,.wb-btn:disabled,.wb-chip:disabled{opacity:.45;cursor:default}",
			".wb-colorrow{display:flex;align-items:center;gap:10px}",
			".wb-pair{display:flex;gap:12px}",
			".wb-pair>*{flex:1}",
			".wb-colorinput{width:38px;height:28px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;cursor:pointer}",
			".wb-chips{display:flex;flex-wrap:wrap;gap:6px}",
			".wb-chip{height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer}",
			".wb-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".wb-range{width:100%;accent-color:var(--dsw-alias-state-business-primary)}",
			".wb-preview{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
			".wb-previewcell{height:64px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);display:flex;align-items:flex-end;padding:8px;overflow:hidden}",
			".wb-previewlabel{font-size:11px;color:#fff;background:rgba(0,0,0,.38);border-radius:6px;padding:2px 8px}",
			".wb-btn{height:30px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer}",
			".wb-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".wb-switch{width:16px;height:16px;accent-color:var(--dsw-alias-state-business-primary)}",
			".wb-error{color:var(--dsw-alias-state-error-primary)}",
		].join("\n");
		const CSS_TAG_ID = "dsh-web-background/styles";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = CSS_TAG_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		// ── background value computation ──────────────────────────────────────────

		/** Merge a possibly-partial wire value over the defaults. */
		function effective(value) {
			if (typeof value !== "object" || value === null) return DEFAULTS;
			return Object.assign({}, DEFAULTS, value);
		}

		/** Clamp the overlay percent into [0, 80]. */
		function overlayOf(value) {
			const n = Number(value);
			if (!Number.isFinite(n)) return 0;
			return Math.max(0, Math.min(80, n));
		}

		/** Clamp the gradient angle into [0, 360] degrees. */
		function angleOf(value) {
			const n = Number(value);
			if (!Number.isFinite(n)) return 135;
			return Math.max(0, Math.min(360, n));
		}

		/**
		 * The CSS background value applied for one palette scheme. Color and
		 * gradient modes pass the value through; image mode composes an optional
		 * dimming gradient, the image layer (with fit), and the scheme's solid
		 * fallback color (visible while the image loads and for tiles).
		 */
		function schemeValue(settings, scheme) {
			const s = effective(settings);
			if (s.mode === "gradient") {
				const angle = angleOf(s.gradientAngle);
				return scheme === "light"
					? `linear-gradient(${angle}deg, ${s.gradientLightStart}, ${s.gradientLightEnd})`
					: `linear-gradient(${angle}deg, ${s.gradientDarkStart}, ${s.gradientDarkEnd})`;
			}
			if (s.mode === "image") {
				const base = scheme === "light" ? s.colorLight : s.colorDark;
				const url = String(s.imageUrl ?? "").trim();
				if (url === "") return base;
				const fit = s.imageFit === "tile" ? "repeat" : "center/" + s.imageFit + " no-repeat";
				const dim = overlayOf(s.imageOverlay);
				const overlay = dim > 0 ? `linear-gradient(rgba(0,0,0,${(dim / 100).toFixed(2)}),rgba(0,0,0,${(dim / 100).toFixed(2)})), ` : "";
				return `${overlay}url(${JSON.stringify(url)}) ${fit} ${base}`;
			}
			return scheme === "light" ? s.colorLight : s.colorDark;
		}

		/**
		 * Build the theme override layer for the current settings, or null when
		 * the master switch is off. Every token carries both palette modes as the
		 * theme runtime requires.
		 */
		function buildOverrides(value) {
			const s = effective(value);
			if (!s.enabled) return null;
			const overrides = {};
			overrides[TOKEN_BG_BASE] = { light: schemeValue(s, "light"), dark: schemeValue(s, "dark") };
			if (s.applyToSidebar) overrides[TOKEN_SIDEBAR] = { light: schemeValue(s, "light"), dark: schemeValue(s, "dark") };
			return overrides;
		}

		// ── optimistic local state ───────────────────────────────────────────────
		//
		// Every control change applies locally and synchronously (UI + theme),
		// then persists through the settings scope in debounced, coalesced
		// flushes. Persisted snapshots are adopted only while no local edit is
		// in flight, so a slow settings round-trip can never fight the UI.

		/** The bound settings scope, assigned in apply() before any render. */
		let scope = null;
		/** Optimistic merged value; null until the first persisted snapshot arrives. */
		let optimistic = null;
		/** Stable uSES snapshot wrapping {@link optimistic}. */
		let optimisticSnapshot = { value: null };
		const localListeners = new Set();
		/** Fields edited locally but not yet flushed/accepted: field → value | UNSET. */
		let pendingFields = new Map();
		/** Bumped on every local edit; a flush only adopts persisted state when it is still the newest. */
		let generation = 0;
		let flushActive = false;
		let flushTimer = null;
		let flushChain = Promise.resolve();

		function publishLocal() {
			optimisticSnapshot = { value: optimistic };
			for (const fn of localListeners) fn();
		}
		function subscribeLocal(fn) {
			localListeners.add(fn);
			return () => localListeners.delete(fn);
		}
		function getLocalSnapshot() {
			return optimisticSnapshot;
		}
		function optimisticValue() {
			return effective(optimistic);
		}

		/** Adopt the persisted value only when no local edit is outstanding. */
		function onScopeSnapshot() {
			const persisted = scope.getSnapshot().value;
			if (persisted === undefined) return;
			if (flushActive || pendingFields.size > 0) return;
			optimistic = persisted;
			publishLocal();
		}

		/** Apply one or more field edits instantly and schedule a coalesced persist. */
		function applyLocalChange(patch) {
			optimistic = Object.assign({}, optimisticValue(), patch);
			for (const key of Object.keys(patch)) pendingFields.set(key, patch[key]);
			generation += 1;
			publishLocal();
			if (flushTimer !== null) clearTimeout(flushTimer);
			flushTimer = setTimeout(flush, DEBOUNCE_MS);
		}

		/** Instantly restore every field to its schema default and persist the reset. */
		function applyLocalReset() {
			optimistic = Object.assign({}, DEFAULTS);
			for (const field of RESET_FIELDS) pendingFields.set(field, UNSET);
			generation += 1;
			publishLocal();
			if (flushTimer !== null) clearTimeout(flushTimer);
			flushTimer = setTimeout(flush, DEBOUNCE_MS);
		}

		/**
		 * Persist everything pending in one serialized pass (one write per
		 * field, coalesced by the debounce). Returns the settle chain so tests
		 * can await it.
		 */
		function flush() {
			if (flushTimer !== null) {
				clearTimeout(flushTimer);
				flushTimer = null;
			}
			const gen = generation;
			const entries = [...pendingFields.entries()];
			pendingFields.clear();
			if (entries.length === 0) return flushChain;
			flushActive = true;
			flushChain = flushChain.then(async () => {
				for (const [field, value] of entries) {
					try {
						if (value === UNSET) await scope.unset(field);
						else await scope.set(field, value);
					} catch {
						// the scope reloads itself on failed writes; the next snapshot reconciles
					}
				}
			}).then(() => {
				flushActive = false;
				if (generation === gen && pendingFields.size === 0) {
					const persisted = scope.getSnapshot().value;
					if (persisted !== undefined) {
						optimistic = persisted;
						publishLocal();
					}
				}
			}).catch(() => {
				flushActive = false;
			});
			return flushChain;
		}

		// ── theme application (coalesced to one per animation frame) ─────────────
		//
		// overrideTokens → snapshot recompose → presenter DOM writes + forced
		// layout is the expensive path; dragging a slider emits far more events
		// than frames, so applications coalesce to at most one per frame while
		// the UI readouts still update per event.

		/** The theme service, captured at apply() time. */
		let themeService = null;
		/** Disposer of the currently applied override layer (null while none). */
		let disposeLayer = null;
		let themeSyncPending = false;
		let themeSyncTimer = null;

		/** Apply the override layer for the current optimistic value. */
		function applyThemeLayer() {
			const overrides = buildOverrides(optimistic);
			if (disposeLayer !== null) {
				disposeLayer();
				disposeLayer = null;
			}
			if (overrides !== null && themeService !== null) disposeLayer = themeService.overrideTokens(OVERRIDE_SOURCE, overrides);
		}

		/** Coalesce theme applications to at most one per animation frame. */
		function scheduleThemeSync() {
			if (themeSyncPending) return;
			themeSyncPending = true;
			const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (fn) => setTimeout(fn, 0);
			themeSyncTimer = raf(() => {
				themeSyncPending = false;
				themeSyncTimer = null;
				applyThemeLayer();
			});
		}

		/** Cancel a pending coalesced application and apply now (tests; disposal). */
		function syncNow() {
			if (themeSyncTimer !== null) {
				const cancel = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : clearTimeout;
				cancel(themeSyncTimer);
				themeSyncTimer = null;
			}
			themeSyncPending = false;
			applyThemeLayer();
		}

		// ── settings page UI ──────────────────────────────────────────────────────

		function useScopeSnapshot() {
			return React.useSyncExternalStore(
				(subscribe) => scope.subscribe(subscribe),
				() => scope.getSnapshot(),
				() => scope.getSnapshot(),
			);
		}

		/** The optimistic value driving every control, preview, and the theme layer. */
		function useLocalValue() {
			const snap = React.useSyncExternalStore(subscribeLocal, getLocalSnapshot, getLocalSnapshot);
			return snap.value;
		}

		/** Normalize a stored color to something <input type=color> accepts. */
		function normalizeColor(color) {
			if (typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) return color;
			return "#888888";
		}

		/** Whether the stored image reference is an embedded data URL (locally imported file). */
		function isDataUrl(url) {
			return typeof url === "string" && url.startsWith("data:");
		}

		/** Rough decoded size of a base64 data URL, in KiB. */
		function dataUrlKib(url) {
			const payload = String(url).slice(String(url).indexOf(",") + 1);
			return Math.round((payload.length * 3) / 4 / 1024);
		}

		function TextField({ label, hint, value, onCommit, placeholder, readOnly }) {
			const [draft, setDraft] = React.useState(value);
			React.useEffect(() => {
				setDraft(value);
			}, [value]);
			return jsxs("label", {
				className: "wb-field",
				children: [
					jsx("span", { className: "wb-label", children: label }),
					jsx("input", {
						className: "wb-input",
						type: "text",
						value: draft,
						placeholder,
						disabled: readOnly,
						onChange: (e) => setDraft(e.target.value),
						onBlur: () => {
							if (draft !== value) onCommit(draft);
						},
						onKeyDown: (e) => {
							if (e.key === "Enter") e.target.blur();
						},
					}),
					hint !== undefined ? jsx("span", { className: "wb-hint", children: hint }) : null,
				],
			});
		}

		function ColorField({ label, value, onCommit, readOnly }) {
			return jsxs("label", {
				className: "wb-field",
				children: [
					jsx("span", { className: "wb-label", children: label }),
					jsxs("span", {
						className: "wb-colorrow",
						children: [
							jsx("input", {
								className: "wb-colorinput",
								type: "color",
								value: normalizeColor(value),
								disabled: readOnly,
								onChange: (e) => onCommit(e.target.value),
							}),
							jsx("span", { className: "wb-hint", children: String(value) }),
						],
					}),
				],
			});
		}

		/**
		 * Local image import: pick a file, validate type/size, read it as a data
		 * URL, and hand the result back for persistence. Oversized files are
		 * rejected with a hint to use a hosted URL instead.
		 */
		function ImageImport({ t, onImported, readOnly }) {
			const inputRef = React.useRef(null);
			const [error, setError] = React.useState(null);
			const pick = () => {
				setError(null);
				if (inputRef.current !== null) inputRef.current.click();
			};
			const onChange = (e) => {
				const file = e.target.files !== null && e.target.files.length > 0 ? e.target.files[0] : null;
				e.target.value = "";
				if (file === null) return;
				if (!file.type.startsWith("image/")) {
					setError(t("importNotImage"));
					return;
				}
				if (file.size > MAX_IMPORT_BYTES) {
					setError(t("importTooLarge"));
					return;
				}
				const reader = new FileReader();
				reader.onload = () => {
					if (typeof reader.result === "string") onImported(reader.result);
				};
				reader.onerror = () => setError(t("importFailed"));
				reader.readAsDataURL(file);
			};
			return jsxs("div", {
				className: "wb-field",
				children: [
					jsx("button", { type: "button", className: "wb-btn", disabled: readOnly, onClick: pick, children: t("importLocal") }),
					jsx("input", { ref: inputRef, type: "file", accept: "image/*", style: { display: "none" }, onChange }),
					error !== null ? jsx("span", { className: "wb-hint wb-error", children: error }) : null,
				],
			});
		}

		function Segmented({ options, active, onSelect, readOnly }) {
			return jsx("div", {
				className: "wb-seg",
				role: "tablist",
				children: options.map(([id, label]) =>
					jsx(
						"button",
						{
							type: "button",
							className: active === id ? "wb-segbtn wb-segbtn-active" : "wb-segbtn",
							"aria-pressed": active === id,
							disabled: readOnly,
							onClick: () => onSelect(id),
							children: label,
						},
						id,
					),
				),
			});
		}

		function PreviewCard({ t, value }) {
			const s = effective(value);
			return jsxs("div", {
				className: "wb-card",
				children: [
					jsx("div", { className: "wb-cardtitle", children: t("preview") }),
					jsxs("div", {
						className: "wb-preview",
						children: [
							jsxs("div", { className: "wb-previewcell", style: { background: schemeValue(s, "light") }, children: [
								jsx("span", { className: "wb-previewlabel", children: t("schemeLight") }),
							] }),
							jsxs("div", { className: "wb-previewcell", style: { background: schemeValue(s, "dark") }, children: [
								jsx("span", { className: "wb-previewlabel", children: t("schemeDark") }),
							] }),
						],
					}),
				],
			});
		}

		/**
		 * The Background settings page, registered into `settings.section`.
		 * Every control edits the optimistic local value (instant) and persists
		 * through a debounced flush — one source of truth for presentation,
		 * with the Host document as the durable sink.
		 */
		function BackgroundSection({ t }) {
			const snap = useScopeSnapshot();
			const readOnly = snap.writable === false;
			const value = useLocalValue();
			if (value === null) {
				return jsx("div", { className: "wb-root", children: jsx("p", { className: "wb-hint", children: t("unavailable") }) });
			}
			const s = effective(value);
			const modeOptions = [
				["color", t("modeColor")],
				["gradient", t("modeGradient")],
				["image", t("modeImage")],
			];
			const fitOptions = [
				["cover", t("fitCover")],
				["contain", t("fitContain")],
				["tile", t("fitTile")],
			];
			return jsxs("div", {
				className: "wb-root",
				children: [
					jsxs("div", {
						className: "wb-card",
						children: [
							jsxs("label", {
								className: "wb-row",
								children: [
									jsx("span", { className: "wb-label", children: t("enable") }),
									jsx("input", {
										className: "wb-switch",
										type: "checkbox",
										checked: s.enabled === true,
										disabled: readOnly,
										onChange: (e) => applyLocalChange({ enabled: e.target.checked }),
									}),
								],
							}),
							readOnly ? jsx("span", { className: "wb-hint", children: t("memoryMode") }) : null,
						],
					}),
					jsxs("div", {
						className: "wb-card",
						children: [
							jsx("div", { className: "wb-cardtitle", children: t("mode") }),
							jsx(Segmented, { options: modeOptions, active: s.mode, readOnly, onSelect: (mode) => applyLocalChange({ mode }) }),
							s.mode === "color"
								? jsxs(Fragment, {
										children: [
											jsx(ColorField, { label: t("schemeLight"), value: s.colorLight, readOnly, onCommit: (v) => applyLocalChange({ colorLight: v }) }),
											jsx(ColorField, { label: t("schemeDark"), value: s.colorDark, readOnly, onCommit: (v) => applyLocalChange({ colorDark: v }) }),
											jsx("div", {
												className: "wb-chips",
												children: COLOR_PRESETS.map((p) =>
													jsx("button", {
														type: "button",
														className: "wb-chip",
														disabled: readOnly,
														onClick: () => applyLocalChange({ colorLight: p.light, colorDark: p.dark }),
														children: t("preset") + " · " + p.id,
													}, p.id),
												),
											}),
										],
									})
								: null,
							s.mode === "gradient"
								? jsxs(Fragment, {
										children: [
											jsx("div", { className: "wb-cardtitle", children: t("schemeLight") }),
											jsxs("div", {
												className: "wb-pair",
												children: [
													jsx(ColorField, { label: t("gradientStart"), value: s.gradientLightStart, readOnly, onCommit: (v) => applyLocalChange({ gradientLightStart: v }) }),
													jsx(ColorField, { label: t("gradientEnd"), value: s.gradientLightEnd, readOnly, onCommit: (v) => applyLocalChange({ gradientLightEnd: v }) }),
												],
											}),
											jsx("div", { className: "wb-cardtitle", children: t("schemeDark") }),
											jsxs("div", {
												className: "wb-pair",
												children: [
													jsx(ColorField, { label: t("gradientStart"), value: s.gradientDarkStart, readOnly, onCommit: (v) => applyLocalChange({ gradientDarkStart: v }) }),
													jsx(ColorField, { label: t("gradientEnd"), value: s.gradientDarkEnd, readOnly, onCommit: (v) => applyLocalChange({ gradientDarkEnd: v }) }),
												],
											}),
											jsxs("label", {
												className: "wb-field",
												children: [
													jsxs("span", {
														className: "wb-row",
														children: [
															jsx("span", { className: "wb-label", children: t("gradientAngle") }),
															jsx("span", { className: "wb-hint", children: String(angleOf(s.gradientAngle)) + "°" }),
														],
													}),
													jsx("input", {
														className: "wb-range",
														type: "range",
														min: 0,
														max: 360,
														step: 15,
														value: angleOf(s.gradientAngle),
														disabled: readOnly,
														onChange: (e) => applyLocalChange({ gradientAngle: Number(e.target.value) }),
													}),
												],
											}),
											jsx("div", {
												className: "wb-chips",
												children: GRADIENT_PRESETS.map((p) =>
													jsx("button", {
														type: "button",
														className: "wb-chip",
														disabled: readOnly,
														onClick: () => applyLocalChange({
															gradientAngle: p.angle,
															gradientLightStart: p.lightStart,
															gradientLightEnd: p.lightEnd,
															gradientDarkStart: p.darkStart,
															gradientDarkEnd: p.darkEnd,
														}),
														children: t("preset") + " · " + p.id,
													}, p.id),
												),
											}),
										],
									})
								: null,
							s.mode === "image"
								? jsxs(Fragment, {
										children: [
											isDataUrl(s.imageUrl)
												? jsxs("div", {
														className: "wb-field",
														children: [
															jsx("span", { className: "wb-label", children: t("imageUrl") }),
															jsxs("div", {
																className: "wb-row",
																children: [
																	jsx("span", { className: "wb-hint", children: t("imported") + " · " + dataUrlKib(s.imageUrl) + " KB" }),
																	jsx("button", { type: "button", className: "wb-btn", disabled: readOnly, onClick: () => applyLocalChange({ imageUrl: "" }), children: t("clear") }),
																],
															}),
														],
													})
												: jsx(TextField, { label: t("imageUrl"), hint: t("imageUrlHint"), value: s.imageUrl, readOnly, onCommit: (v) => applyLocalChange({ imageUrl: v }), placeholder: "https://example.com/bg.jpg" }),
											jsx(ImageImport, { t, readOnly, onImported: (dataUrl) => applyLocalChange({ mode: "image", imageUrl: dataUrl }) }),
											jsx(Segmented, { options: fitOptions, active: s.imageFit, readOnly, onSelect: (fit) => applyLocalChange({ imageFit: fit }) }),
											jsxs("label", {
												className: "wb-field",
												children: [
													jsxs("span", {
														className: "wb-row",
														children: [
															jsx("span", { className: "wb-label", children: t("overlay") }),
															jsx("span", { className: "wb-hint", children: String(overlayOf(s.imageOverlay)) + "%" }),
														],
													}),
													jsx("input", {
														className: "wb-range",
														type: "range",
														min: 0,
														max: 80,
														step: 1,
														value: overlayOf(s.imageOverlay),
														disabled: readOnly,
														onChange: (e) => applyLocalChange({ imageOverlay: Number(e.target.value) }),
													}),
													jsx("span", { className: "wb-hint", children: t("overlayHint") }),
												],
											}),
											jsx(ColorField, { label: t("schemeLight"), value: s.colorLight, readOnly, onCommit: (v) => applyLocalChange({ colorLight: v }) }),
											jsx(ColorField, { label: t("schemeDark"), value: s.colorDark, readOnly, onCommit: (v) => applyLocalChange({ colorDark: v }) }),
										],
									})
								: null,
						],
					}),
					jsxs("div", {
						className: "wb-card",
						children: [
							jsxs("label", {
								className: "wb-row",
								children: [
									jsx("span", { className: "wb-label", children: t("sidebar") }),
									jsx("input", {
										className: "wb-switch",
										type: "checkbox",
										checked: s.applyToSidebar === true,
										disabled: readOnly,
										onChange: (e) => applyLocalChange({ applyToSidebar: e.target.checked }),
									}),
								],
							}),
							jsx("button", {
								type: "button",
								className: "wb-btn",
								disabled: readOnly,
								onClick: applyLocalReset,
								children: t("reset"),
							}),
						],
					}),
					jsx(PreviewCard, { t, value }),
				],
			});
		}

		// ── plugin body ───────────────────────────────────────────────────────────

		/** Required services (Cordis fiber inject — the loader passes the module exports as an object plugin). */
		const inject = ["connection", "remote", "settingsScope", "theme", "slots", "locale"];

		/**
		 * Client plugin body:
		 * 1. Bind the durable `web-background` settings scope.
		 * 2. Keep the theme override layer in sync with the optimistic value
		 *    (instant, frame-coalesced) and adopt persisted snapshots when idle.
		 * 3. Register the Background settings page and its dictionaries.
		 * @param ctx - client Cordis context.
		 */
		function apply(ctx) {
			scope = ctx.settingsScope.bind({ namespace: NAMESPACE });
			themeService = ctx.theme;
			ctx.effect(() => {
				const offScope = scope.subscribe(onScopeSnapshot);
				const offLocal = subscribeLocal(scheduleThemeSync);
				onScopeSnapshot();
				applyThemeLayer();
				return () => {
					offScope();
					offLocal();
					if (themeSyncTimer !== null) {
						const cancel = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : clearTimeout;
						cancel(themeSyncTimer);
						themeSyncTimer = null;
					}
					themeSyncPending = false;
					if (disposeLayer !== null) {
						disposeLayer();
						disposeLayer = null;
					}
				};
			}, "dsh-web-background: background application");

			ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh: zh, en: en }), "dsh-web-background: dictionaries");
			const t = ctx.locale.bind(LOCALE_NS);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "background",
				order: 30,
				label: () => t("nav"),
				locale: LOCALE_NS,
			}, BackgroundSection));
		}

		// ── dictionaries ──────────────────────────────────────────────────────────

		const zh = {
			nav: "背景",
			enable: "启用自定义背景",
			memoryMode: "当前为远程访问，设置仅在本次会话内生效，不会写入本地配置。",
			mode: "背景类型",
			modeColor: "纯色",
			modeGradient: "渐变",
			modeImage: "图片",
			schemeLight: "浅色模式",
			schemeDark: "深色模式",
			preset: "预设",
			gradientStart: "起始色",
			gradientEnd: "结束色",
			gradientAngle: "方向角度",
			imageUrl: "图片链接",
			imageUrlHint: "支持 http(s) 链接与 data URL；浏览器无法读取本地文件路径。",
			importLocal: "选择本地图片导入",
			importTooLarge: "图片超过 1 MB。设置会写入本地配置文件，请先压缩，更大的图片建议使用图片链接。",
			importNotImage: "所选文件不是图片。",
			importFailed: "读取文件失败，请重试。",
			imported: "已导入本地图片",
			clear: "清除",
			fitCover: "覆盖",
			fitContain: "包含",
			fitTile: "平铺",
			overlay: "暗化程度",
			overlayHint: "在图片上叠加半透明黑色遮罩，提升文字可读性。",
			sidebar: "侧边栏也应用",
			reset: "恢复默认",
			preview: "实时预览",
			unavailable: "背景设置暂不可用（设置传输未就绪）。",
		};

		const en = {
			nav: "Background",
			enable: "Enable custom background",
			memoryMode: "Remote browser: choices apply to this session only and are not persisted.",
			mode: "Background type",
			modeColor: "Solid color",
			modeGradient: "Gradient",
			modeImage: "Image",
			schemeLight: "Light mode",
			schemeDark: "Dark mode",
			preset: "Preset",
			gradientStart: "Start color",
			gradientEnd: "End color",
			gradientAngle: "Angle",
			imageUrl: "Image URL",
			imageUrlHint: "http(s) URLs and data URLs work; browsers cannot read local file paths.",
			importLocal: "Import local image",
			importTooLarge: "Image exceeds 1 MB. Settings are persisted to a local config file — compress it first, or use an image URL for larger files.",
			importNotImage: "The selected file is not an image.",
			importFailed: "Failed to read the file; please retry.",
			imported: "Imported local image",
			clear: "Clear",
			fitCover: "Cover",
			fitContain: "Contain",
			fitTile: "Tile",
			overlay: "Dimming",
			overlayHint: "A translucent black overlay over the image for text readability.",
			sidebar: "Apply to sidebar too",
			reset: "Reset to defaults",
			preview: "Live preview",
			unavailable: "Background settings unavailable (settings transport not ready).",
		};

		exports.apply = apply;
		exports.inject = inject;
		exports.BackgroundSection = BackgroundSection;
		exports.__test = { applyLocalChange, applyLocalReset, flush, syncNow, getLocalSnapshot, optimisticValue };
		return module.exports;
	}
});
