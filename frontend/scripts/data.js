        /**
         * 1. AppConfig: Global application state and visual constants
         */
        const AppConfig = {
            currentModel: 'ECD18010040-B',
            currentLine: 'CD01',
            currentStation: 'ATS2-2',
            activeTab: 'timeline',
            highlightedIncidentId: null,
            dangerThreshold: 80,
            // Staggered vertical stem heights (px) so adjacent nodes on a single screen never overlap
            stemPattern: [
                { dir: 'up', height: 26 },
                { dir: 'down', height: 26 },
                { dir: 'up', height: 12 },
                { dir: 'down', height: 12 }
            ]
        };

        /**
         * 2. MockInitialData: Authentic production dataset from user's ATS2-2 records
         */
        const MockInitialData = {
            model: 'ECD18010040-B',
            line: 'CD01',
            stationGroup: 'ATS2-2',
            slots: [
                { id: 'ATS2_2_1', score: 97, maintenance: false },
                { id: 'ATS2_2_2', score: 73, maintenance: false },
                { id: 'ATS2_2_3', score: 96, maintenance: false },
                { id: 'ATS2_2_4', score: 94, maintenance: false }
            ],
            events: [
                {
                    id: 'INC-01',
                    sn: 'A2231021412609',
                    itemCode: '24#',
                    itemName: '24# DES Turn On & Sequence DSO',
                    failStation: 'ATS2_2_4',
                    failTime: '2026/11/06 08:05',
                    crossStation: 'ATS2_2_3',
                    crossTime: '2026/11/06 08:11',
                    retryCount: '無 (直接交叉)',
                    reseatFixture: '未執行',
                    specialAction: '無',
                    keySolution: '換工位後 Pass',
                    rootCause: '誤測 (工位)',
                    note: '換ATS2_2_3重測Pass'
                },
                {
                    id: 'INC-02',
                    sn: 'A2231021412647',
                    itemCode: '78#',
                    itemName: '78# DES UUT Communication',
                    failStation: 'ATS2_2_2',
                    failTime: '2026/11/06 08:16',
                    crossStation: 'ATS2_2_1',
                    crossTime: '2026/11/06 08:22',
                    retryCount: '1次',
                    reseatFixture: '未執行',
                    specialAction: '無',
                    keySolution: '換工位後 Pass',
                    rootCause: '誤測 (工位)',
                    note: '換ATS2_2_1重測Pass'
                },
                {
                    id: 'INC-03',
                    sn: 'A2231021412389',
                    itemCode: '95#',
                    itemName: '95# unlock@uut1',
                    failStation: 'ATS2_2_1',
                    failTime: '2026/11/06 08:26',
                    crossStation: 'ATS2_2_3',
                    crossTime: '2026/11/06 08:31',
                    retryCount: '無 (直接交叉)',
                    reseatFixture: '未執行',
                    specialAction: '無',
                    keySolution: '換工位後 Pass',
                    rootCause: '誤測 (工位)',
                    note: '換ATS2_2_3重測Pass'
                },
                {
                    id: 'INC-04',
                    sn: 'A2231021412424',
                    itemCode: '14#',
                    itemName: '14# DES DMM Measurement',
                    failStation: 'ATS2_2_2',
                    failTime: '2026/11/06 08:28',
                    crossStation: 'ATS2_2_4',
                    crossTime: '2026/11/06 08:35',
                    retryCount: '2次',
                    reseatFixture: '未執行',
                    specialAction: '無',
                    keySolution: '換工位後 Pass',
                    rootCause: '誤測 (工位)',
                    note: 'ATS2_2_2重測2次Fail -> 換ATS2_2_4重測Pass'
                },
                {
                    id: 'INC-05',
                    sn: 'A2231021412472',
                    itemCode: '14#',
                    itemName: '14# DES DMM Measurement',
                    failStation: 'ATS2_2_2',
                    failTime: '2026/11/06 08:57',
                    crossStation: 'ATS2_2_4',
                    crossTime: '2026/11/06 09:04',
                    retryCount: '1次',
                    reseatFixture: '有執行 (插拔陪測)',
                    specialAction: '無',
                    keySolution: '換工位後 Pass',
                    rootCause: '誤測 (工位)',
                    note: 'ATS2_2_2重測Fail -> 插拔陪測重測Fail -> 換ATS2_2_4重測Pass'
                },
                {
                    id: 'INC-06',
                    sn: 'A2231021412634',
                    itemCode: '14#',
                    itemName: '14# DES DMM Measurement',
                    failStation: 'ATS2_2_2',
                    failTime: '2026/11/06 09:44',
                    crossStation: null,
                    crossTime: null,
                    retryCount: '3次以上',
                    reseatFixture: '有執行 (換陪測)',
                    specialAction: '屏蔽工位並更換測試板',
                    keySolution: '維修/屏蔽工位後 Pass',
                    rootCause: '工位異常 (ATS2_2_2)',
                    note: '屏蔽ATS2_2_2工位至下午更換測試板(持續跟蹤)'
                },
                {
                    id: 'INC-07',
                    sn: 'A2231021412326',
                    itemCode: '64#',
                    itemName: '64# Check output@12Vsb OVP',
                    failStation: 'ATS2_2_1',
                    failTime: '2026/11/06 10:33',
                    crossStation: null,
                    crossTime: null,
                    retryCount: '1次',
                    reseatFixture: '未執行',
                    specialAction: '靜置冷卻',
                    keySolution: '靜置/清潔後 Pass',
                    rootCause: '誤測 (溫度)',
                    note: '靜置重測Pass'
                },
                {
                    id: 'INC-08',
                    sn: 'A2231021412310',
                    itemCode: '56#',
                    itemName: '56# 12Vsb OVP Test@240Vac',
                    failStation: 'ATS2_2_3',
                    failTime: '2026/11/06 10:46',
                    crossStation: 'ATS2_2_4',
                    crossTime: '2026/11/06 10:52',
                    retryCount: '無 (直接交叉)',
                    reseatFixture: '未執行',
                    specialAction: '無',
                    keySolution: '換工位後 Pass',
                    rootCause: '誤測 (工位)',
                    note: '換ATS2_2_4重測Pass'
                },
                {
                    id: 'INC-09',
                    sn: 'A2231021410573',
                    itemCode: '39#',
                    itemName: '39# DES Hold Up & Sequence',
                    failStation: 'ATS2_2_2',
                    failTime: '2026/11/10 11:06',
                    crossStation: 'ATS2_2_3',
                    crossTime: '2026/11/10 11:12',
                    retryCount: '無 (直接交叉)',
                    reseatFixture: '未執行',
                    specialAction: '無',
                    keySolution: '換工位後 Pass',
                    rootCause: '誤測 (工位)',
                    note: '換ATS2_2_3重測Pass'
                },
                {
                    id: 'INC-10',
                    sn: 'A223206847945',
                    itemCode: '24#',
                    itemName: '24# DES Turn On & Sequence',
                    failStation: 'ATS2_2_4',
                    failTime: '2026/11/12 11:42',
                    crossStation: 'ATS2_2_3',
                    crossTime: '2026/11/12 11:48',
                    retryCount: '無 (直接交叉)',
                    reseatFixture: '未執行',
                    specialAction: '無',
                    keySolution: '換工位後 Pass',
                    rootCause: '誤測 (工位)',
                    note: '換ATS2_2_3重測Pass'
                }
            ]
        };

        // Active runtime state store
        let AppState = {
            slots: [],
            events: []
        };
