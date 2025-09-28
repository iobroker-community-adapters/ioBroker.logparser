# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

### Adapter-Specific Context: ioBroker.logparser

This adapter is specifically designed for **parsing and filtering ioBroker logs**. Key characteristics:

- **Primary Function**: Parses (filters) all logs of ioBroker adapters and provides the results as JSON in states for each filter as configured in the settings
- **Target Use Case**: Log analysis, monitoring, and visualization in VIS dashboards
- **Key Features**:
  - Configurable log filters with custom regex patterns
  - JSON output for each filter stored in adapter states
  - Log clearing functionality (emptyJson states for individual filters and emptyAllJson for all)
  - Scheduled log processing using node-schedule
  - Real-time log monitoring and filtering
- **Configuration**: Filters are configured in adapter settings with custom names, patterns, and output preferences
- **Integration**: Results can be consumed by VIS for visualization or other adapters for automated actions
- **Dependencies**: 
  - `@iobroker/adapter-core` for base adapter functionality
  - `node-schedule` for timed log processing
- **State Structure**: Creates states like `logparser.0.filters.{FilterName}.json` and corresponding `emptyJson` control states

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Start the adapter and wait for it to connect
                        await harness.startAdapter();
                        
                        // Wait for the adapter to be ready
                        await wait(2000);
                        
                        // Verify adapter is running
                        const state = await harness.states.getStateAsync('system.adapter.ADAPTER_NAME.0.alive');
                        expect(state).to.exist;
                        expect(state.val).to.be.true;
                        
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            it('should handle configuration changes', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        // Test configuration-specific logic here
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            after(function() {
                return new Promise(async (resolve) => {
                    // Clean up resources if needed
                    if (harness) {
                        await harness.stopAdapter();
                    }
                    resolve();
                });
            });
        });
    }
});
```

#### Key Integration Test Rules
- **ALWAYS** use `@iobroker/testing` framework - never write custom adapter testing logic
- Tests must be in the `test/integration.js` file (singular, not plural)
- Use `getHarness()` method to get fresh test harness instances
- **ALWAYS** properly stop adapters in `after()` hooks to prevent resource leaks
- **NEVER** use `require('../main.js')` directly in integration tests
- Use `harness.startAdapter()` and `harness.stopAdapter()` for lifecycle management
- **IMPORTANT**: Wrap all test logic in try/catch blocks and properly handle async operations

#### Configuration and State Testing
- Test adapter with different configuration scenarios
- Verify state creation and value updates
- Test state subscriptions and change handlers
- Verify proper cleanup when adapter stops

#### Mock Data Strategy  
For adapters that connect to external APIs or hardware:
- Create `/test/data/` directory with example response files
- Use these files in integration tests instead of making live API calls
- Ensure tests can run in CI/CD environments without external dependencies
- Document test data requirements in README

### Test File Organization
```
test/
├── unit.js              # Unit tests
├── integration.js       # Integration tests (singular!)
├── package.js          # Package validation tests
├── data/               # Mock data files
│   ├── api-response.json
│   └── device-config.json
└── mocha.custom.opts   # Test configuration
```

## Development Patterns

### Adapter Structure
- Main adapter logic in `main.js`
- Helper functions in `lib/` directory
- Admin configuration UI in `admin/` directory
- Static resources in `www/` directory (if needed)
- Use TypeScript definitions from `@iobroker/adapter-core` for better IDE support

### State Management
```javascript
// Creating states
await this.setObjectNotExistsAsync('info.connection', {
    type: 'state',
    common: {
        name: 'Connection status',
        type: 'boolean',
        role: 'indicator.connected',
        read: true,
        write: false,
    },
    native: {},
});

// Setting state values
await this.setStateAsync('info.connection', { val: true, ack: true });

// Subscribing to state changes
this.subscribeStates('*');
```

### Configuration Access
```javascript
// Access adapter configuration
const config = this.config;
const myParameter = config.myParameter || 'defaultValue';

// Validate configuration
if (!config.requiredParameter) {
    this.log.error('Required parameter missing in configuration');
    return;
}
```

### Logging Best Practices
```javascript
// Use appropriate log levels
this.log.error('Critical error that stops functionality');
this.log.warn('Warning about potential issues');
this.log.info('Important information for users');
this.log.debug('Detailed information for debugging');

// Include context in log messages
this.log.info(`Processing ${itemCount} items from ${source}`);
this.log.error(`Failed to connect to ${host}:${port}: ${error.message}`);
```

### Error Handling
```javascript
try {
    // Risky operation
    const result = await somethingThatMightFail();
    return result;
} catch (error) {
    this.log.error(`Operation failed: ${error.message}`);
    // Don't rethrow unless the caller needs to handle it
    return null; // or appropriate default value
}
```

### Cleanup and Resource Management
```javascript
// In unload() method
unload(callback) {
    try {
        // Clear all timers
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
        
        // Close connections
        if (this.connection) {
            this.connection.close();
        }
        
        // Stop any running processes
        // Clear intervals, close files, etc.
        
        callback();
    } catch (e) {
        callback();
    }
}
```

### Async/Await Best Practices
```javascript
// Preferred pattern
async onReady() {
    try {
        await this.initialize();
        await this.connectToService();
        await this.startProcessing();
        this.log.info('Adapter started successfully');
    } catch (error) {
        this.log.error(`Failed to start adapter: ${error.message}`);
    }
}

// Handle multiple async operations
const results = await Promise.all([
    this.operation1(),
    this.operation2(),
    this.operation3()
]);
```

## API Integration

### HTTP Requests
```javascript
const axios = require('axios');

// Use axios for HTTP requests (already included in most adapter templates)
try {
    const response = await axios.get('https://api.example.com/data', {
        timeout: 10000,
        headers: {
            'User-Agent': 'ioBroker-adapter-name/1.0.0'
        }
    });
    return response.data;
} catch (error) {
    if (error.code === 'ECONNABORTED') {
        this.log.warn('Request timeout');
    } else {
        this.log.error(`HTTP request failed: ${error.message}`);
    }
    throw error;
}
```

### Rate Limiting
```javascript
// Implement rate limiting for API calls
class RateLimiter {
    constructor(requestsPerSecond) {
        this.interval = 1000 / requestsPerSecond;
        this.lastRequest = 0;
    }
    
    async waitIfNeeded() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequest;
        if (timeSinceLastRequest < this.interval) {
            const waitTime = this.interval - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequest = Date.now();
    }
}
```

## Configuration UI (Admin)

### Admin UI Structure
```javascript
// admin/index_m.html - Modern admin interface
// Use adapter-react or vanilla JS with JSON schema
// Follow ioBroker admin interface guidelines

// JSON Schema configuration
const configSchema = {
    type: 'panel',
    items: {
        apiKey: {
            type: 'text',
            label: 'API Key',
            help: 'Your API key from the service provider'
        },
        updateInterval: {
            type: 'number',
            label: 'Update Interval (minutes)',
            min: 1,
            max: 1440,
            default: 15
        }
    }
};
```

### Configuration Validation
```javascript
// In main.js - validate configuration on startup
validateConfig() {
    const errors = [];
    
    if (!this.config.apiKey || this.config.apiKey.trim() === '') {
        errors.push('API Key is required');
    }
    
    if (this.config.updateInterval < 1 || this.config.updateInterval > 1440) {
        errors.push('Update interval must be between 1 and 1440 minutes');
    }
    
    if (errors.length > 0) {
        this.log.error('Configuration validation failed: ' + errors.join(', '));
        return false;
    }
    
    return true;
}
```

## Common Helper Functions

### Utility Functions
```javascript
// Format timestamps
formatTimestamp(timestamp) {
    return new Date(timestamp).toISOString().replace('T', ' ').substring(0, 19);
}

// Deep merge objects
deepMerge(target, source) {
    const output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
        Object.keys(source).forEach(key => {
            if (this.isObject(source[key])) {
                if (!(key in target))
                    Object.assign(output, { [key]: source[key] });
                else
                    output[key] = this.deepMerge(target[key], source[key]);
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}
```

### State Helper Functions
```javascript
// Create state with consistent naming
async createStateAsync(id, name, type, role, unit = '', writable = false) {
    await this.setObjectNotExistsAsync(id, {
        type: 'state',
        common: {
            name: name,
            type: type,
            role: role,
            unit: unit,
            read: true,
            write: writable,
        },
        native: {},
    });
}

// Update state only if value changed
async updateStateIfChanged(id, value, ack = true) {
    const currentState = await this.getStateAsync(id);
    if (!currentState || currentState.val !== value) {
        await this.setStateAsync(id, { val: value, ack: ack });
        return true;
    }
    return false;
}
```

## Debugging and Troubleshooting

### Debug Logging
```javascript
// Use debug log level for detailed information
if (this.log.level === 'debug') {
    this.log.debug(`Processing data: ${JSON.stringify(data, null, 2)}`);
}

// Create debug helper
debugLog(message, data = null) {
    if (this.log.level === 'debug') {
        if (data) {
            this.log.debug(`${message}: ${JSON.stringify(data, null, 2)}`);
        } else {
            this.log.debug(message);
        }
    }
}
```

### Error Context
```javascript
// Provide meaningful error context
catch (error) {
    this.log.error(`Failed to process ${itemType} ${itemId}: ${error.message}`);
    this.debugLog('Error details', {
        error: error.stack,
        itemType: itemType,
        itemId: itemId,
        timestamp: new Date().toISOString()
    });
}
```

## Performance Optimization

### Memory Management
```javascript
// Limit array sizes to prevent memory issues
const MAX_HISTORY_ENTRIES = 1000;

addHistoryEntry(entry) {
    this.history.push(entry);
    if (this.history.length > MAX_HISTORY_ENTRIES) {
        this.history = this.history.slice(-MAX_HISTORY_ENTRIES);
    }
}
```

### Efficient State Updates
```javascript
// Batch state updates
const stateUpdates = {};
stateUpdates[`device.${deviceId}.temperature`] = { val: temperature, ack: true };
stateUpdates[`device.${deviceId}.humidity`] = { val: humidity, ack: true };

// Apply all updates
for (const [stateId, stateValue] of Object.entries(stateUpdates)) {
    await this.setStateAsync(stateId, stateValue);
}
```

## Documentation

### JSDoc Comments
```javascript
/**
 * Processes incoming data from the external service
 * @param {Object} rawData - Raw data from the API
 * @param {string} deviceId - Device identifier  
 * @param {number} timestamp - Data timestamp
 * @returns {Promise<boolean>} True if processing succeeded
 */
async processData(rawData, deviceId, timestamp) {
    // Implementation
}
```

### README Structure
- Clear description of adapter purpose
- Installation instructions
- Configuration examples
- State structure documentation
- Changelog with semantic versioning
- License information

### Configuration Documentation
- Document all configuration options
- Provide examples for complex configurations
- Include screenshots of admin interface
- Explain state structure and usage

## Code Style and Quality

### ESLint Configuration
- Use official ioBroker ESLint configuration
- Follow JavaScript Standard Style
- Enable TypeScript checking if using TypeScript
- Configure Prettier for consistent formatting

### Code Organization
- Separate concerns into different files/modules
- Use consistent naming conventions
- Keep functions focused and small
- Comment complex logic
- Use meaningful variable and function names

### Version Control
- Use semantic versioning (major.minor.patch)
- Update CHANGELOG.md with each release
- Tag releases in Git
- Use meaningful commit messages

## Security Best Practices

### Input Validation
```javascript
// Validate all external input
validateInput(input, expectedType, allowedValues = null) {
    if (typeof input !== expectedType) {
        throw new Error(`Expected ${expectedType}, got ${typeof input}`);
    }
    
    if (allowedValues && !allowedValues.includes(input)) {
        throw new Error(`Value ${input} not in allowed values: ${allowedValues.join(', ')}`);
    }
    
    return true;
}
```

### Credential Handling
```javascript
// Never log credentials
// Use native.password fields in io-package.json for sensitive data
// Validate credentials before use

if (!this.config.apiKey || typeof this.config.apiKey !== 'string') {
    this.log.error('Invalid or missing API key in configuration');
    return;
}
```

### Safe JSON Parsing
```javascript
// Always use try-catch for JSON parsing
parseJsonSafely(jsonString, defaultValue = null) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        this.log.warn(`Failed to parse JSON: ${error.message}`);
        return defaultValue;
    }
}
```

## Specific Patterns for logparser Adapter

### Log Processing Patterns
```javascript
// Process log lines with regex filters
processLogLine(logLine, filters) {
    const results = [];
    filters.forEach(filter => {
        if (filter.enabled && filter.regex) {
            try {
                const regex = new RegExp(filter.regex, filter.flags || 'i');
                if (regex.test(logLine)) {
                    results.push({
                        filter: filter.name,
                        line: logLine,
                        timestamp: new Date().toISOString(),
                        matched: true
                    });
                }
            } catch (error) {
                this.log.warn(`Invalid regex in filter ${filter.name}: ${error.message}`);
            }
        }
    });
    return results;
}
```

### JSON State Management
```javascript
// Update JSON states for filtered results
async updateFilterState(filterName, matchedLines) {
    const stateId = `filters.${filterName}.json`;
    const jsonData = {
        count: matchedLines.length,
        lastUpdate: new Date().toISOString(),
        entries: matchedLines.slice(-100) // Keep last 100 entries
    };
    
    await this.setStateAsync(stateId, {
        val: JSON.stringify(jsonData, null, 2),
        ack: true
    });
}

// Handle empty/clear commands
async handleEmptyCommand(filterName) {
    if (filterName === 'all') {
        // Clear all filter states
        const filters = this.config.filters || [];
        for (const filter of filters) {
            await this.setStateAsync(`filters.${filter.name}.json`, {
                val: JSON.stringify({ count: 0, entries: [] }),
                ack: true
            });
        }
    } else {
        // Clear specific filter
        await this.setStateAsync(`filters.${filterName}.json`, {
            val: JSON.stringify({ count: 0, entries: [] }),
            ack: true
        });
    }
}
```

### Scheduled Processing
```javascript
// Use node-schedule for timed log processing
const schedule = require('node-schedule');

setupScheduledTasks() {
    // Process logs every minute
    this.logProcessingJob = schedule.scheduleJob('*/1 * * * *', () => {
        this.processLogs();
    });
    
    // Cleanup old logs daily at 2 AM
    this.cleanupJob = schedule.scheduleJob('0 2 * * *', () => {
        this.cleanupOldLogs();
    });
}

// Cleanup in unload
unload(callback) {
    try {
        if (this.logProcessingJob) {
            this.logProcessingJob.cancel();
        }
        if (this.cleanupJob) {
            this.cleanupJob.cancel();
        }
        callback();
    } catch (e) {
        callback();
    }
}
```