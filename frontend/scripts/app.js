        const ProductContextController = {
            getLines() {
                return [...new Set(ProductRelations.map(relation => relation.line))];
            },

            getModelsForLine(line) {
                return [...new Set(ProductRelations
                    .filter(relation => relation.line === line)
                    .map(relation => relation.model))];
            },

            getStationsForProduct(line, model) {
                return [...new Set(ProductRelations
                    .filter(relation => relation.line === line && relation.model === model)
                    .flatMap(relation => relation.stationGroups))];
            },

            populateSelect(select, values, selectedValue) {
                select.innerHTML = '';
                values.forEach(value => {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = value;
                    select.appendChild(option);
                });
                select.value = selectedValue;
            },

            sync(changedSelector) {
                if (!ProductRelations.length || ProductRelations.some(relation =>
                    !relation.line || !relation.model ||
                    !Array.isArray(relation.stationGroups) || !relation.stationGroups.length
                )) {
                    throw new Error('請在 data.js 的 ProductRelations 設定有效的線別、機種與站別關係');
                }

                const lineSelect = document.getElementById('ctx-line');
                const modelSelect = document.getElementById('ctx-model');
                const stationSelect = document.getElementById('ctx-station');
                const lines = this.getLines();

                let line = changedSelector === 'ctx-line' ? lineSelect.value : AppConfig.currentLine;
                let model = changedSelector === 'ctx-model' ? modelSelect.value : AppConfig.currentModel;
                let station = changedSelector === 'ctx-station' ? stationSelect.value : AppConfig.currentStation;

                if (!lines.includes(line)) line = lines[0];

                let models = this.getModelsForLine(line);
                if (!models.includes(model)) model = models[0];

                const stations = this.getStationsForProduct(line, model);
                if (!stations.includes(station)) station = stations[0];

                AppConfig.currentLine = line;
                AppConfig.currentModel = model;
                AppConfig.currentStation = station;

                this.populateSelect(lineSelect, lines, line);
                this.populateSelect(modelSelect, models, model);
                this.populateSelect(stationSelect, stations, station);
            }
        };

        /**
         * 6. EventListeners: Bind all UI interactions cleanly
         */
        function initEventListeners() {
            // Left Sidebar Tab Switching
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.addEventListener('click', () => UIController.switchTab(btn.getAttribute('data-tab')));
            });

            // Top Context Selectors (Model, Line, Station)
            ['ctx-model', 'ctx-line', 'ctx-station'].forEach(id => {
                document.getElementById(id).addEventListener('change', () => {
                    ProductContextController.sync(id);
                    AppState.slots = DataParserService.deriveSlotsFromEvents(AppConfig.currentStation, AppState.events);
                    TimelineRenderer.renderAll();
                    UIController.showToast(`已切換監控視角：${AppConfig.currentLine} / ${AppConfig.currentStation} (${AppConfig.currentModel})`);
                });
            });

            // Timeline Filter Controls
            document.getElementById('date-filter').addEventListener('change', () => TimelineRenderer.renderTimelineRows());
            document.getElementById('item-filter').addEventListener('change', () => TimelineRenderer.renderTimelineRows());
            document.getElementById('toggle-links').addEventListener('change', () => TimelineRenderer.drawCrossLinks());
            document.getElementById('log-slot-filter').addEventListener('change', () => TimelineRenderer.renderLogTable());

            // Delegated Hover & Click Events on Timeline Nodes & Maintenance Buttons
            const rowsWrapper = document.getElementById('workstation-rows');
            rowsWrapper.addEventListener('mouseover', (e) => {
                const group = e.target.closest('.stem-group');
                if (group) {
                    const incId = group.getAttribute('data-incident-id');
                    AppConfig.highlightedIncidentId = incId;
                    document.querySelectorAll(`.stem-group[data-incident-id="${incId}"]`).forEach(el => el.classList.add('linked-active'));
                    TimelineRenderer.drawCrossLinks();
                }
            });

            rowsWrapper.addEventListener('mouseout', (e) => {
                const group = e.target.closest('.stem-group');
                if (group) {
                    AppConfig.highlightedIncidentId = null;
                    document.querySelectorAll('.stem-group.linked-active').forEach(el => el.classList.remove('linked-active'));
                    TimelineRenderer.drawCrossLinks();
                }
            });

            rowsWrapper.addEventListener('click', (e) => {
                const group = e.target.closest('.stem-group');
                if (group) {
                    UIController.openDetailModal(group.getAttribute('data-incident-id'));
                    return;
                }
                const maintBtn = e.target.closest('.btn-toggle-maint');
                if (maintBtn) {
                    const slotId = maintBtn.getAttribute('data-toggle-slot');
                    const slot = AppState.slots.find(s => s.id === slotId);
                    if (slot) {
                        slot.maintenance = !slot.maintenance;
                        TimelineRenderer.renderAll();
                        UIController.showToast(slot.maintenance ? `已鎖定 ${slotId} 進入維護模式` : `${slotId} 已恢復測試`);
                    }
                }
            });

            // Log Table Inspect Detail Button
            document.getElementById('log-table-body').addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-inspect-detail');
                if (btn) {
                    UIController.openDetailModal(btn.getAttribute('data-inspect-id'));
                }
            });

            // Backend Data Upload Modal Triggers
            const uploadModal = document.getElementById('upload-modal');
            const fileInput = document.getElementById('file-input');
            const dropzone = document.getElementById('file-dropzone');
            const pasteInput = document.getElementById('paste-data-input');

            document.getElementById('btn-open-upload').addEventListener('click', () => uploadModal.classList.remove('hidden'));
            document.getElementById('btn-close-upload').addEventListener('click', () => uploadModal.classList.add('hidden'));
            document.getElementById('btn-cancel-upload').addEventListener('click', () => uploadModal.classList.add('hidden'));

            dropzone.addEventListener('click', () => fileInput.click());
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('border-teal-500', 'bg-teal-50/40');
            });
            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('border-teal-500', 'bg-teal-50/40');
            });
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('border-teal-500', 'bg-teal-50/40');
                if (e.dataTransfer.files.length) {
                    readUploadedFile(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length) {
                    readUploadedFile(e.target.files[0]);
                }
            });

            function readUploadedFile(file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    pasteInput.value = ev.target.result;
                    UIController.showToast(`已讀取檔案：${file.name}，請點擊「解析並更新儀表板」`);
                };
                reader.readAsText(file);
            }

            document.getElementById('btn-load-sample-paste').addEventListener('click', () => {
                pasteInput.value = JSON.stringify(MockInitialData, null, 2);
            });

            document.getElementById('btn-apply-upload').addEventListener('click', () => {
                try {
                    const parsedDataset = DataParserService.parseRawInput(pasteInput.value);
                    DataParserService.loadDataset(parsedDataset);
                    TimelineRenderer.renderAll();
                    uploadModal.classList.add('hidden');
                    UIController.showToast(`成功解析並更新 ${AppState.events.length} 筆異常紀錄！`);
                } catch (err) {
                    UIController.showToast(`解析失敗：${err.message}`);
                }
            });

            document.getElementById('btn-reset-default').addEventListener('click', () => {
                DataParserService.loadDataset(MockInitialData);
                TimelineRenderer.renderAll();
                pasteInput.value = '';
                uploadModal.classList.add('hidden');
                UIController.showToast('已恢復空白初始資料');
            });

            // Template & CSV Export Buttons
            document.getElementById('btn-export-csv').addEventListener('click', () => UIController.downloadTemplate('csv'));
            document.getElementById('btn-dl-json-tpl').addEventListener('click', () => UIController.downloadTemplate('json'));
            document.getElementById('btn-dl-csv-tpl').addEventListener('click', () => UIController.downloadTemplate('csv'));
            document.getElementById('modal-dl-json').addEventListener('click', () => UIController.downloadTemplate('json'));
            document.getElementById('modal-dl-csv').addEventListener('click', () => UIController.downloadTemplate('csv'));

            // Detail Inspection Modal Close Triggers
            const detailModal = document.getElementById('detail-modal');
            document.getElementById('btn-close-detail').addEventListener('click', () => detailModal.classList.add('hidden'));
            document.getElementById('btn-confirm-detail').addEventListener('click', () => detailModal.classList.add('hidden'));
            detailModal.addEventListener('click', (e) => {
                if (e.target === detailModal) detailModal.classList.add('hidden');
            });

            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    uploadModal.classList.add('hidden');
                    detailModal.classList.add('hidden');
                }
            });

            window.addEventListener('resize', () => {
                requestAnimationFrame(() => TimelineRenderer.drawCrossLinks());
            });
        }

        // Real-time Header Clock
        function startLiveClock() {
            const clockEl = document.getElementById('live-clock');
            const tick = () => {
                const now = new Date();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                const hh = String(now.getHours()).padStart(2, '0');
                const min = String(now.getMinutes()).padStart(2, '0');
                const ss = String(now.getSeconds()).padStart(2, '0');
                clockEl.innerText = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
            };
            tick();
            setInterval(tick, 1000);
        }

        function initializeBrandLogo() {
            const logo = document.getElementById('brand-logo');
            const fallback = document.getElementById('brand-logo-fallback');
            const showLogo = () => {
                logo.classList.remove('hidden');
                fallback.classList.add('hidden');
            };

            logo.addEventListener('load', showLogo, { once: true });
            if (logo.complete && logo.naturalWidth > 0) {
                showLogo();
            }
        }

        // Application Bootstrap
        function showDashboardError(message, error) {
            const loadError = document.getElementById('load-error');
            loadError.hidden = false;
            loadError.textContent = `${message}：${error.message}`;
        }

        window.DashboardComponentsReady.then(() => {
            try {
                initializeBrandLogo();
                startLiveClock();
                initEventListeners();
                DataParserService.loadDataset(MockInitialData);
                TimelineRenderer.renderAll();
            } catch (error) {
                console.error('Failed to initialize the dashboard.', error);
                showDashboardError('儀表板初始化失敗', error);
            }
        }, error => {
            console.error('Failed to load dashboard components.', error);
            showDashboardError(
                '儀表板元件載入失敗，請確認使用 HTTP 靜態伺服器，且 components 資料夾可正常存取',
                error
            );
        });
