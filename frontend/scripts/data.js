        /**
         * 1. AppConfig: Global application state and visual constants
         */
        const AppConfig = {
            currentModel: 'ECD18010040-B',
            currentLine: 'CD02',
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

        // Add one entry per line/model pairing; list only the station groups that model uses on that line.
        const ProductRelations = [
            { line: 'CD02', model: 'ECD18010040-B', stationGroups: ['I2C1-1', 'ATS2-1', 'ATS2-2'] },
            { line: 'CD02', model: 'ECD18010046', stationGroups: ['I2C1-1', 'ATS2-1', 'ATS2-2'] },
            { line: 'CD02', model: 'ECD18010054-B', stationGroups: ['I2C1-1', 'ATS2-1', 'ATS2-2'] },
            { line: 'CD02', model: 'ECD18010054-EU', stationGroups: ['I2C1-1', 'ATS2-1', 'ATS2-2'] }
        ];

        /**
         * 2. MockInitialData: Empty initial dataset
         */
        const MockInitialData = {
            model: 'ECD18010040-B',
            line: 'CD02',
            stationGroup: 'ATS2-2',
            slots: [],
            events: []
        };
        // Active runtime state store
        let AppState = {
            slots: [],
            events: []
        };
