        /**
         * 4. TimelineRenderer: Renders the 4-slot single-screen stem timeline & SVG cross-links
         */
        const TimelineRenderer = {
            parseTimestampMs(ts) {
                if (!ts) return 0;
                const normalized = ts.replace(/\//g, '-');
                const parsed = Date.parse(normalized);
                if (!isNaN(parsed)) return parsed;
                // Fallback for HH:MM only
                const [h, m] = ts.split(':').map(Number);
                return (h || 0) * 3600000 + (m || 0) * 60000;
            },

            formatShortTime(ts) {
                if (!ts) return '';
                const parts = ts.split(' ');
                if (parts.length === 2) {
                    const md = parts[0].split('/').slice(1).join('/');
                    return `${md} ${parts[1]}`;
                }
                return ts;
            },

            renderAll() {
                this.renderSidebarSummary();
                this.renderTimelineRows();
                this.renderLogTable();
                this.renderAnalytics();
            },

            renderSidebarSummary() {
                document.getElementById('sidebar-ctx-summary').innerText = `${AppConfig.currentLine} / ${AppConfig.currentStation}`;
                document.getElementById('sidebar-model-summary').innerText = AppConfig.currentModel;
                document.getElementById('sidebar-record-count').innerText = `${AppState.events.length} 筆`;
                document.getElementById('timeline-header-title').innerText =
                    `[${AppConfig.currentLine}] ${AppConfig.currentStation} 四工位異常時間軸 — 機種: ${AppConfig.currentModel}`;

                const dangerCount = AppState.slots.filter(s => s.score < AppConfig.dangerThreshold || s.maintenance).length;
                const pill = document.getElementById('sidebar-alert-pill');
                pill.innerText = `${dangerCount} 預警`;
                pill.classList.toggle('hidden', dangerCount === 0);
            },

            renderTimelineRows() {
                const dateFilter = document.getElementById('date-filter').value;
                const itemFilter = document.getElementById('item-filter').value;
                const container = document.getElementById('workstation-rows');
                container.innerHTML = '';

                // Filter events
                const visibleEvents = AppState.events.filter(ev => {
                    if (dateFilter !== 'ALL' && !ev.failTime.startsWith(dateFilter)) return false;
                    if (itemFilter !== 'ALL' && ev.itemCode !== itemFilter) return false;
                    return true;
                });

                // Compute dynamic min/max timestamp bounds so all visible points span cleanly across the axis
                const allTimestamps = [];
                visibleEvents.forEach(ev => {
                    if (ev.failTime) allTimestamps.push(this.parseTimestampMs(ev.failTime));
                    if (ev.crossTime) allTimestamps.push(this.parseTimestampMs(ev.crossTime));
                });

                const minMs = allTimestamps.length ? Math.min(...allTimestamps) : 0;
                const maxMs = allTimestamps.length ? Math.max(...allTimestamps) : 1;
                const spanMs = Math.max(maxMs - minMs, 600000); // At least 10 mins span

                const getPercentPos = (ts) => {
                    if (allTimestamps.length <= 1) return 50;
                    const ratio = (this.parseTimestampMs(ts) - minMs) / spanMs;
                    return 6 + ratio * 88; // Keep 6% padding on left and right edges
                };

                AppState.slots.forEach(slot => {
                    const slotEvents = [];
                    visibleEvents.forEach(ev => {
                        if (ev.failStation === slot.id) {
                            slotEvents.push({
                                incident: ev,
                                type: 'FAIL',
                                ts: ev.failTime,
                                ms: this.parseTimestampMs(ev.failTime),
                                title: `${ev.itemCode} Fail`,
                                subtitle: `..${ev.sn.slice(-4)} (${this.formatShortTime(ev.failTime)})`
                            });
                        }
                        if (ev.crossStation === slot.id && ev.crossTime) {
                            const originShort = ev.failStation.split('_').slice(-2).join('_');
                            slotEvents.push({
                                incident: ev,
                                type: 'CROSS_PASS',
                                ts: ev.crossTime,
                                ms: this.parseTimestampMs(ev.crossTime),
                                title: `交叉Pass (原${originShort})`,
                                subtitle: `..${ev.sn.slice(-4)} (${this.formatShortTime(ev.crossTime)})`
                            });
                        }
                    });

                    slotEvents.sort((a, b) => a.ms - b.ms);

                    const failCount = visibleEvents.filter(e => e.failStation === slot.id).length;
                    const crossCount = visibleEvents.filter(e => e.crossStation === slot.id).length;

                    const isDanger = slot.score < AppConfig.dangerThreshold;
                    const isWarning = slot.score >= AppConfig.dangerThreshold && slot.score < 90;

                    const row = document.createElement('div');
                    // flex-1 min-h-0 ensures all 4 rows share viewport height equally without scrolling
                    row.className = `flex-1 min-h-0 grid grid-cols-12 items-center transition-colors ${slot.maintenance ? 'bg-amber-50/50' : 'hover:bg-slate-50/70'}`;

                    // Left 9 Columns: Staggered Stem Timeline
                    const leftHtml = `
                        <div class="col-span-9 px-5 py-1.5 h-full flex flex-col justify-between relative">
                            <div class="flex items-center justify-between shrink-0">
                                <div class="flex items-center gap-2">
                                    <span class="font-mono-code font-bold text-xs text-slate-900">${slot.id}</span>
                                    ${slot.maintenance
                                        ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">維護屏蔽中</span>`
                                        : isDanger
                                            ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">可信度過低</span>`
                                            : `<span class="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600">正常</span>`
                                    }
                                </div>
                                <div class="text-[11px] text-slate-400 font-mono-code">
                                    初測Fail: <strong class="text-rose-600">${failCount}</strong> | 交叉Pass: <strong class="text-teal-600">${crossCount}</strong>
                                </div>
                            </div>

                            <!-- Timeline Canvas Area (Fills remaining height of this row) -->
                            <div class="relative flex-1 w-full min-h-[78px] select-none">
                                <!-- Horizontal Baseline -->
                                <div class="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1.5px] bg-slate-400/80 z-10"></div>

                                ${slot.maintenance ? `
                                    <div class="absolute inset-x-4 top-1/2 -translate-y-1/2 h-7 bg-amber-100/95 border border-amber-300 rounded-lg z-30 flex items-center justify-center text-[11px] font-bold text-amber-800">
                                        工位已鎖定維護中 — 暫停測試
                                    </div>
                                ` : ''}

                                ${slotEvents.map((ev, idx) => {
                                    const leftPct = getPercentPos(ev.ts);
                                    const pattern = AppConfig.stemPattern[idx % AppConfig.stemPattern.length];
                                    const isUp = pattern.dir === 'up';
                                    const stemH = pattern.height;
                                    const isFail = ev.type === 'FAIL';

                                    const stemColor = isFail ? 'bg-rose-400' : 'bg-teal-500';
                                    const nodeBorder = isFail ? 'border-rose-500' : 'border-teal-600';
                                    const labelClass = isFail
                                        ? 'bg-rose-50/95 text-rose-800 border-rose-200'
                                        : 'bg-teal-50/95 text-teal-800 border-teal-200';

                                    const stemStyle = isUp ? `bottom: 50%; height: ${stemH}px;` : `top: 50%; height: ${stemH}px;`;
                                    const labelStyle = isUp
                                        ? `bottom: calc(50% + ${stemH}px); transform: translateX(-50%);`
                                        : `top: calc(50% + ${stemH}px); transform: translateX(-50%);`;

                                    return `
                                        <div class="stem-group absolute inset-y-0 z-20 cursor-pointer"
                                             style="left: ${leftPct}%;"
                                             data-incident-id="${ev.incident.id}"
                                             data-event-type="${ev.type}">
                                            <div class="absolute left-1/2 -translate-x-1/2 w-[1.5px] ${stemColor}" style="${stemStyle}"></div>
                                            <div class="stem-label absolute left-1/2 px-1.5 py-0.5 rounded border text-[10px] leading-tight whitespace-nowrap shadow-2xs ${labelClass}" style="${labelStyle}">
                                                <span class="font-bold">${ev.title}</span>
                                                <span class="opacity-80 font-mono-code ml-1">${ev.subtitle}</span>
                                            </div>
                                            <div class="stem-node absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-[2.5px] ${nodeBorder}"></div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;

                    // Right 3 Columns: Compact Circular Reliability Gauge
                    const radius = 25;
                    const circumference = 2 * Math.PI * radius;
                    const offset = circumference - (slot.score / 100) * circumference;
                    const strokeColor = isDanger ? '#e11d48' : (isWarning ? '#d97706' : '#0d9488');
                    const scoreTextColor = isDanger ? 'text-rose-600' : (isWarning ? 'text-amber-600' : 'text-teal-700');

                    const rightHtml = `
                        <div class="col-span-3 px-5 py-1.5 border-l border-slate-200 flex items-center justify-between gap-3 bg-slate-50/40 h-full">
                            <div class="flex items-center gap-3">
                                <div class="relative w-14 h-14 flex items-center justify-center shrink-0 rounded-full ${isDanger ? 'pulse-danger' : ''}">
                                    <svg class="w-14 h-14 -rotate-90" viewBox="0 0 60 60">
                                        <circle cx="30" cy="30" r="${radius}" stroke="#e2e8f0" stroke-width="5.5" fill="white" />
                                        <circle cx="30" cy="30" r="${radius}"
                                                stroke="${strokeColor}"
                                                stroke-width="5.5"
                                                stroke-dasharray="${circumference}"
                                                stroke-dashoffset="${offset}"
                                                stroke-linecap="round"
                                                fill="transparent" />
                                    </svg>
                                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                                        <span class="text-xs font-extrabold font-mono-code ${scoreTextColor}">${slot.score}%</span>
                                    </div>
                                </div>

                                <div class="space-y-0.5">
                                    <div class="text-xs font-bold text-slate-800">${slot.id}</div>
                                    <div class="text-[10px] text-slate-500">
                                        ${isDanger ? '<span class="text-rose-600 font-semibold">誤殺偏高，建議檢修</span>' : '測試可信度良好'}
                                    </div>
                                    <button data-toggle-slot="${slot.id}" class="btn-toggle-maint mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer transition-colors ${slot.maintenance ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}">
                                        ${slot.maintenance ? '解除維護' : '維護鎖定'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;

                    row.innerHTML = leftHtml + rightHtml;
                    container.appendChild(row);
                });

                requestAnimationFrame(() => this.drawCrossLinks());
            },

            drawCrossLinks() {
                const svg = document.getElementById('cross-links-svg');
                if (!svg || AppConfig.activeTab !== 'timeline') return;
                svg.innerHTML = '';

                if (!document.getElementById('toggle-links').checked) return;

                const wrapperRect = document.getElementById('dashboard-rows-wrapper').getBoundingClientRect();
                const groups = document.querySelectorAll('.stem-group');

                const byIncident = {};
                groups.forEach(el => {
                    const incId = el.getAttribute('data-incident-id');
                    const evType = el.getAttribute('data-event-type');
                    const nodeEl = el.querySelector('.stem-node');
                    if (!byIncident[incId]) byIncident[incId] = {};
                    byIncident[incId][evType] = nodeEl;
                });

                Object.entries(byIncident).forEach(([incId, pair]) => {
                    if (pair.FAIL && pair.CROSS_PASS) {
                        const r1 = pair.FAIL.getBoundingClientRect();
                        const r2 = pair.CROSS_PASS.getBoundingClientRect();

                        const x1 = r1.left + r1.width / 2 - wrapperRect.left;
                        const y1 = r1.top + r1.height / 2 - wrapperRect.top;
                        const x2 = r2.left + r2.width / 2 - wrapperRect.left;
                        const y2 = r2.top + r2.height / 2 - wrapperRect.top;

                        const isHighlighted = AppConfig.highlightedIncidentId === incId;
                        const strokeColor = isHighlighted ? '#d97706' : 'rgba(148, 163, 184, 0.5)';
                        const strokeWidth = isHighlighted ? '2.5' : '1.4';

                        const midX = (x1 + x2) / 2;
                        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        path.setAttribute('d', `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
                        path.setAttribute('fill', 'none');
                        path.setAttribute('stroke', strokeColor);
                        path.setAttribute('stroke-width', strokeWidth);
                        path.setAttribute('stroke-dasharray', '4,3');
                        svg.appendChild(path);
                    }
                });
            },

            renderLogTable() {
                const slotFilter = document.getElementById('log-slot-filter').value;
                const tbody = document.getElementById('log-table-body');
                const list = slotFilter === 'ALL'
                    ? AppState.events
                    : AppState.events.filter(e => e.failStation === slotFilter);

                tbody.innerHTML = list.map(ev => `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="py-2.5 px-3.5 font-mono-code text-slate-600 whitespace-nowrap">${ev.failTime}</td>
                        <td class="py-2.5 px-3.5 font-mono-code font-bold text-slate-900 whitespace-nowrap">${ev.sn}</td>
                        <td class="py-2.5 px-3.5 font-mono-code font-semibold text-rose-600 whitespace-nowrap">${ev.failStation}</td>
                        <td class="py-2.5 px-3.5 font-medium text-slate-800 max-w-[180px] truncate" title="${ev.itemName}">${ev.itemName}</td>
                        <td class="py-2.5 px-3.5 bg-blue-50/20 text-slate-700 whitespace-nowrap">${ev.retryCount}</td>
                        <td class="py-2.5 px-3.5 bg-blue-50/20 text-slate-700 whitespace-nowrap">${ev.reseatFixture}</td>
                        <td class="py-2.5 px-3.5 bg-blue-50/20 text-slate-700 whitespace-nowrap">${ev.specialAction}</td>
                        <td class="py-2.5 px-3.5 bg-teal-50/30 font-mono-code font-bold text-teal-700 whitespace-nowrap">${ev.crossStation || '無'}</td>
                        <td class="py-2.5 px-3.5 bg-amber-50/30 font-bold text-amber-900 whitespace-nowrap">${ev.keySolution}</td>
                        <td class="py-2.5 px-3.5 whitespace-nowrap">
                            <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${ev.rootCause.includes('工位異常') ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}">
                                ${ev.rootCause}
                            </span>
                        </td>
                        <td class="py-2.5 px-3.5 text-right whitespace-nowrap">
                            <button data-inspect-id="${ev.id}" class="btn-inspect-detail text-teal-700 hover:text-teal-900 font-bold underline cursor-pointer">詳情</button>
                        </td>
                    </tr>
                `).join('');
            },

            renderAnalytics() {
                const paretoEl = document.getElementById('pareto-bars');
                const counts = {};
                AppState.events.forEach(ev => {
                    counts[ev.itemName] = (counts[ev.itemName] || 0) + 1;
                });

                const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                const maxCount = sorted.length ? sorted[0][1] : 1;

                paretoEl.innerHTML = sorted.map(([name, cnt]) => {
                    const pct = Math.round((cnt / Math.max(1, AppState.events.length)) * 100);
                    const widthPct = Math.round((cnt / maxCount) * 100);
                    return `
                        <div class="space-y-1">
                            <div class="flex justify-between text-xs">
                                <span class="font-bold text-slate-800">${name}</span>
                                <span class="font-mono-code text-slate-500"><strong class="text-rose-600">${cnt}</strong> 次 (${pct}%)</span>
                            </div>
                            <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <div class="h-full bg-rose-500 rounded-full" style="width: ${widthPct}%"></div>
                            </div>
                        </div>
                    `;
                }).join('');

                const compEl = document.getElementById('slot-comparison-cards');
                compEl.innerHTML = AppState.slots.map(slot => {
                    const fails = AppState.events.filter(e => e.failStation === slot.id).length;
                    const falseCalls = AppState.events.filter(e => e.failStation === slot.id && e.crossStation).length;
                    const isLow = slot.score < AppConfig.dangerThreshold;
                    return `
                        <div class="p-3.5 rounded-xl border ${isLow ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-slate-50/50'} space-y-1.5">
                            <div class="flex justify-between items-center">
                                <span class="font-mono-code font-bold text-xs text-slate-900">${slot.id}</span>
                                <span class="font-mono-code font-extrabold text-sm ${isLow ? 'text-rose-600' : 'text-teal-700'}">${slot.score}%</span>
                            </div>
                            <div class="text-xs text-slate-600 flex justify-between">
                                <span>初測 Fail 次數:</span>
                                <strong class="font-mono-code">${fails}</strong>
                            </div>
                            <div class="text-xs text-slate-600 flex justify-between">
                                <span>換工位後 Pass (誤殺):</span>
                                <strong class="font-mono-code text-amber-700">${falseCalls}</strong>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        };
