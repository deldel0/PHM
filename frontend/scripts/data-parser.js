        /**
         * 3. DataParserService: Handles JSON & CSV ingestion (supports both new Matrix CSV & legacy Excel CSV)
         */
        const DataParserService = {
            loadDataset(dataset) {
                if (dataset.model) {
                    AppConfig.currentModel = dataset.model;
                    document.getElementById('ctx-model').value = dataset.model;
                }
                if (dataset.line) {
                    AppConfig.currentLine = dataset.line;
                    document.getElementById('ctx-line').value = dataset.line;
                }
                if (dataset.stationGroup) {
                    AppConfig.currentStation = dataset.stationGroup;
                    document.getElementById('ctx-station').value = dataset.stationGroup;
                }

                AppState.events = (dataset.events || []).map((ev, index) => ({
                    id: ev.id || `INC-${String(index + 1).padStart(3, '0')}`,
                    sn: String(ev.sn || '').trim(),
                    itemCode: this.extractItemCode(ev.itemCode || ev.itemName || '未知'),
                    itemName: String(ev.itemName || ev.itemCode || '未知測項').trim(),
                    failStation: String(ev.failStation || '').trim(),
                    failTime: String(ev.failTime || '').trim(),
                    crossStation: ev.crossStation ? String(ev.crossStation).trim() : null,
                    crossTime: ev.crossTime ? String(ev.crossTime).trim() : null,
                    retryCount: ev.retryCount || '1次',
                    reseatFixture: ev.reseatFixture || '未執行',
                    specialAction: ev.specialAction || '無',
                    keySolution: ev.keySolution || (ev.crossStation ? '換工位後 Pass' : '原位復測 Pass'),
                    rootCause: ev.rootCause || '誤測',
                    note: ev.note || ''
                }));

                // Use explicit slot scores if provided by backend, otherwise auto-calculate from events
                if (Array.isArray(dataset.slots) && dataset.slots.length === 4) {
                    AppState.slots = dataset.slots.map(s => ({
                        id: s.id,
                        score: Number(s.score),
                        maintenance: Boolean(s.maintenance)
                    }));
                } else {
                    AppState.slots = this.deriveSlotsFromEvents(AppConfig.currentStation, AppState.events);
                }

                this.refreshFilterDropdowns();
                this.updateLastUpdatedTime();
            },

            updateLastUpdatedTime() {
                const now = new Date();
                const dateTime = [
                    now.getFullYear(),
                    String(now.getMonth() + 1).padStart(2, '0'),
                    String(now.getDate()).padStart(2, '0')
                ].join('-') + ` ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
                document.getElementById('data-last-updated').textContent = `最後更新時間：${dateTime}`;
            },

            extractItemCode(rawText) {
                const match = String(rawText).match(/(\d+#)/);
                return match ? match[1] : String(rawText).slice(0, 8);
            },

            deriveSlotsFromEvents(stationGroup, events) {
                const prefix = stationGroup.replace('-', '_');
                const slotIds = [`${prefix}_1`, `${prefix}_2`, `${prefix}_3`, `${prefix}_4`];

                return slotIds.map(slotId => {
                    const initialFails = events.filter(e => e.failStation === slotId).length;
                    const falseCalls = events.filter(e => e.failStation === slotId && e.crossStation).length;
                    // Deduct 3% per initial fail and 4% per confirmed cross-station false call
                    const computedScore = Math.max(55, Math.min(99, 100 - initialFails * 3 - falseCalls * 4));
                    return {
                        id: slotId,
                        score: computedScore,
                        maintenance: false
                    };
                });
            },

            parseRawInput(rawText) {
                const trimmed = rawText.trim();
                if (!trimmed) {
                    throw new Error('輸入內容為空，請上傳檔案或貼上數據');
                }

                // Attempt JSON parse first
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) {
                        return { events: parsed };
                    }
                    return parsed;
                }

                // Otherwise parse CSV
                return this.parseCsvText(trimmed);
            },

            parseCsvText(csvText) {
                const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
                if (lines.length < 2) {
                    throw new Error('CSV 至少需要包含標題列與一筆數據列');
                }

                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                const events = [];

                for (let i = 1; i < lines.length; i++) {
                    const cols = this.splitCsvLine(lines[i]);
                    const row = {};
                    headers.forEach((h, idx) => {
                        row[h] = (cols[idx] || '').trim().replace(/^"|"$/g, '');
                    });

                    // Support both Legacy Excel headers and New Action Matrix headers
                    const failTime = row['測試時間'] || row['failTime'] || '';
                    const sn = row['PSU序列號'] || row['sn'] || `SN-${i}`;
                    const failStation = row['初測工位'] || row['failStation'] || '';
                    const itemName = row['Fail 項'] || row['Fail測項'] || row['itemName'] || '';
                    const historyText = row['重測歷程'] || '';
                    const noteText = row['備註'] || row['note'] || '';

                    // Auto-detect cross-station target from either explicit column or legacy text (e.g. "換ATS2_2_3重測Pass")
                    let crossStation = row['交叉工位'] || row['crossStation'] || null;
                    if (!crossStation && historyText) {
                        const crossMatch = historyText.match(/換([A-Za-z0-9_]+)重測Pass/i);
                        if (crossMatch) {
                            crossStation = crossMatch[1];
                        }
                    }

                    // Estimate crossTime (+6 mins after failTime) if crossStation exists
                    let crossTime = row['crossTime'] || null;
                    if (crossStation && !crossTime && failTime) {
                        crossTime = this.addMinutesToTimestamp(failTime, 6);
                    }

                    if (failStation) {
                        events.push({
                            id: `CSV-${String(i).padStart(3, '0')}`,
                            sn,
                            itemCode: this.extractItemCode(itemName),
                            itemName,
                            failStation,
                            failTime,
                            crossStation: crossStation && crossStation !== '無' ? crossStation : null,
                            crossTime,
                            retryCount: row['原位重測'] || (historyText.includes('2次') ? '2次' : historyText.includes('重測') ? '1次' : '無'),
                            reseatFixture: row['插拔陪測'] || (historyText.includes('陪測') ? '有執行' : '未執行'),
                            specialAction: row['特殊處置'] || (historyText.includes('靜置') ? '靜置冷卻' : '無'),
                            keySolution: row['關鍵解決動作'] || (crossStation ? '換工位後 Pass' : (noteText || '原位復測 Pass')),
                            rootCause: row['真因歸屬'] || row['Fail維度'] || '誤測',
                            note: noteText || historyText
                        });
                    }
                }

                if (events.length === 0) {
                    throw new Error('未能解析出有效的異常工位紀錄，請檢查 CSV 欄位名稱');
                }

                // Infer station group from first record's failStation (e.g. ATS2_2_4 -> ATS2-2)
                const firstStation = events[0].failStation;
                const parts = firstStation.split('_');
                const inferredGroup = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : AppConfig.currentStation;

                return {
                    stationGroup: inferredGroup,
                    events
                };
            },

            splitCsvLine(line) {
                const result = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const ch = line[i];
                    if (ch === '"') {
                        inQuotes = !inQuotes;
                    } else if (ch === ',' && !inQuotes) {
                        result.push(current);
                        current = '';
                    } else {
                        current += ch;
                    }
                }
                result.push(current);
                return result;
            },

            addMinutesToTimestamp(ts, minsToAdd) {
                const match = ts.match(/(\d{4}\/\d{1,2}\/\d{1,2}\s+)?(\d{1,2}):(\d{2})/);
                if (!match) return ts;
                const datePart = match[1] || '';
                let h = parseInt(match[2], 10);
                let m = parseInt(match[3], 10) + minsToAdd;
                if (m >= 60) {
                    h = (h + Math.floor(m / 60)) % 24;
                    m = m % 60;
                }
                return `${datePart}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            },

            refreshFilterDropdowns() {
                // Populate Date Filter
                const dateSelect = document.getElementById('date-filter');
                const dates = [...new Set(AppState.events.map(e => e.failTime.split(' ')[0]).filter(Boolean))];
                dateSelect.innerHTML = `<option value="ALL">全部日期 (${dates.length}天)</option>` +
                    dates.map(d => `<option value="${d}">${d}</option>`).join('');

                // Populate Test Item Filter
                const itemSelect = document.getElementById('item-filter');
                const items = [...new Set(AppState.events.map(e => e.itemCode).filter(Boolean))];
                itemSelect.innerHTML = `<option value="ALL">全部異常測項</option>` +
                    items.map(code => `<option value="${code}">${code}</option>`).join('');

                // Populate Log Table Slot Filter
                const logSlotSelect = document.getElementById('log-slot-filter');
                logSlotSelect.innerHTML = `<option value="ALL">全部初測工位</option>` +
                    AppState.slots.map(s => `<option value="${s.id}">${s.id}</option>`).join('');
            }
        };
