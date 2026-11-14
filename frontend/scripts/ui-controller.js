        /**
         * 5. UIController: Handles Modals, Tab Navigation, Template Downloads & Notifications
         */
        const UIController = {
            switchTab(tabName) {
                AppConfig.activeTab = tabName;
                ['timeline', 'log', 'analytics', 'schema'].forEach(t => {
                    const viewEl = document.getElementById(`view-${t}`);
                    const navBtn = document.querySelector(`.nav-btn[data-tab="${t}"]`);
                    if (t === tabName) {
                        viewEl.classList.remove('hidden');
                        navBtn.className = 'nav-btn w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all bg-slate-900 text-white shadow-2xs cursor-pointer';
                    } else {
                        viewEl.classList.add('hidden');
                        navBtn.className = 'nav-btn w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer';
                    }
                });

                if (tabName === 'timeline') {
                    requestAnimationFrame(() => TimelineRenderer.drawCrossLinks());
                }
            },

            openDetailModal(incId) {
                const ev = AppState.events.find(e => e.id === incId);
                if (!ev) return;

                const badge = document.getElementById('modal-badge');
                document.getElementById('modal-sn').innerText = `PSU SN: ${ev.sn}`;

                if (ev.crossStation) {
                    badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800';
                    badge.innerText = `交叉驗證 Pass (${ev.failStation} → ${ev.crossStation})`;
                } else {
                    badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700';
                    badge.innerText = `原站處置結案 (${ev.failStation})`;
                }

                document.getElementById('modal-body').innerHTML = `
                    <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                            <div class="text-[11px] text-slate-400 font-semibold">初測異常工位與時間</div>
                            <div class="text-sm font-bold text-rose-600 mt-0.5">${ev.failStation} @ ${ev.failTime}</div>
                            <div class="text-xs text-slate-600 mt-0.5">${ev.itemName}</div>
                        </div>
                        <div class="text-slate-300 font-bold hidden sm:block">➔</div>
                        <div>
                            <div class="text-[11px] text-slate-400 font-semibold">交叉工位驗證結果</div>
                            ${ev.crossStation
                                ? `<div class="text-sm font-bold text-teal-700 mt-0.5">${ev.crossStation} @ ${ev.crossTime} (Pass)</div>
                                   <div class="text-xs text-slate-500 mt-0.5">確認產品正常，原工位存在誤測風險</div>`
                                : `<div class="text-sm font-bold text-slate-700 mt-0.5">未跨站 (原站排除/屏蔽)</div>
                                   <div class="text-xs text-slate-500 mt-0.5">${ev.keySolution}</div>`
                            }
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2.5 text-xs">
                        <div class="p-2.5 rounded-lg border border-slate-200">
                            <span class="text-slate-400 block mb-0.5">1. 原位重測次數</span>
                            <strong class="text-slate-800">${ev.retryCount}</strong>
                        </div>
                        <div class="p-2.5 rounded-lg border border-slate-200">
                            <span class="text-slate-400 block mb-0.5">2. 插拔陪測 / 治具</span>
                            <strong class="text-slate-800">${ev.reseatFixture}</strong>
                        </div>
                        <div class="p-2.5 rounded-lg border border-slate-200">
                            <span class="text-slate-400 block mb-0.5">3. 特殊處置動作</span>
                            <strong class="text-slate-800">${ev.specialAction}</strong>
                        </div>
                        <div class="p-2.5 rounded-lg border border-slate-200">
                            <span class="text-slate-400 block mb-0.5">4. 交叉測試目標工位</span>
                            <strong class="text-teal-700 font-mono-code">${ev.crossStation || '無'}</strong>
                        </div>
                        <div class="col-span-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 flex justify-between items-center">
                            <div>
                                <span class="text-amber-700/80 block text-[11px]">5. 關鍵解決動作</span>
                                <strong class="text-amber-900">${ev.keySolution}</strong>
                            </div>
                            <span class="px-2 py-0.5 rounded bg-white border border-amber-200 text-xs font-bold text-slate-800">
                                定性: ${ev.rootCause}
                            </span>
                        </div>
                    </div>

                    <div class="text-xs bg-slate-100 p-3 rounded-lg text-slate-600">
                        <strong class="text-slate-800">原始重測歷程 / 備註：</strong> ${ev.note}
                    </div>
                `;

                document.getElementById('detail-modal').classList.remove('hidden');
            },

            downloadTemplate(type) {
                if (type === 'json') {
                    const blob = new Blob([JSON.stringify(MockInitialData, null, 2)], { type: 'application/json' });
                    this.triggerDownload(blob, 'ATE_Station_Template.json');
                } else {
                    const headers = ['測試時間', 'PSU序列號', '初測工位', 'Fail測項', '原位重測', '插拔陪測', '特殊處置', '交叉工位', '關鍵解決動作', '真因歸屬', '備註'];
                    const rows = MockInitialData.events.map(e => [
                        e.failTime, e.sn, e.failStation, `"${e.itemName}"`,
                        e.retryCount, e.reseatFixture, e.specialAction,
                        e.crossStation || '無', e.keySolution, e.rootCause, `"${e.note}"`
                    ]);
                    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    this.triggerDownload(blob, 'ATE_Troubleshooting_Template.csv');
                }
                this.showToast(`已下載標準 ${type.toUpperCase()} 範本檔案`);
            },

            triggerDownload(blob, filename) {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                link.click();
            },

            showToast(msg) {
                const toast = document.getElementById('toast');
                document.getElementById('toast-text').innerText = msg;
                toast.classList.remove('translate-y-20', 'opacity-0');
                setTimeout(() => {
                    toast.classList.add('translate-y-20', 'opacity-0');
                }, 3200);
            }
        };
