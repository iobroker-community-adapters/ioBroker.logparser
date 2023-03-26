/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */

'use strict';

const utils = require('@iobroker/adapter-core');

// indicator if the adapter is running or not (for interval/schedule)
let isUnloaded = false;

class LogParser extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'logparser',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));

		this.g_forbiddenCharsA = /[\][*,;'"`<>\\?]/g; // Several chars but allows spaces
		this.g_forbiddenCharsB = /[\][*,;'"`<>\\\s?]/g; // Several chars and no spaces allowed

		this.g_globalBlacklist = []; // the global blacklist (per admin settings. either type RegExp or string)
		this.g_activeFilters = []; // the names of all filters activated per admin settings
		this.g_tableFilters = []; // for each logparser.0.visualization.tableX, we hold the selection state here. So table0 = array index 0, etc.
		this.g_jsonKeys = []; // keys for JSON as array. From adapter admin settings, like: "date,severity,from,message". ts is always added.

		this.g_allLogs = {}; // All logs which were coming in, prepared for JSON output to states
		this.g_minUpdateInterval = 2; // Minimum update interval in seconds.
		this.g_defaultUpdateInterval = 20; // Default update interval in seconds.

		this.g_timerMidnight = null; // setInterval timer for callAtMidnight()
		this.g_timerUpdateStates = null; // Update states interval timer
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		await this.main();
		await this.refreshData();
	}

	/**
	 * refresh data with interval
	 * is neccessary to refresh lastContact data, especially of devices without state changes
	 */
	async refreshData() {
		if (isUnloaded) return; // cancel run if unloaded was called.

		const nextTimeout = this.config.updateInterval * 1000;
		this.log.debug('State updates scheduled... Interval: ' + nextTimeout + ' milliseconds.');

		await this.scheduleUpdateStates();

		// Clear existing timeout
		if (this.g_timerUpdateStates) {
			this.clearTimeout(this.g_timerUpdateStates);
			this.g_timerUpdateStates = null;
		}

		this.g_timerUpdateStates = this.setTimeout(async () => {
			this.log.debug('Updating Data');
			await this.refreshData();
		}, nextTimeout);
	}

	/**
	 * Main function
	 * Called once the adapter is initialized.
	 */
	async main() {
		// Verify and get adapter settings
		await this.initializeConfigValues(async (passedInit) => {
			if (!passedInit) {
				this.log.error('Adapter not initialized due to user configuration error(s).');
				return;
			}

			const statesToProcess = await this.prepareAdapterObjects();

			// Create all objects (states), and delete the ones no longer needed.
			await this.createAdapterObjects(statesToProcess, async () => {
				// Get previous JSON Logs from states into global variable g_allLogs
				await this.getJsonStates(async () => {
					// Subscribe to new logs coming in from all adapters
					await this.subscribeToAdapterLogs();
					this.log.debug('Subscribing to new logs coming in from all adapters.');

					// Subscribe to certain adapter states
					await this.subscribeStatesAsync('filters*.emptyJson');
					await this.subscribeStatesAsync('emptyAllJson');
					await this.subscribeStatesAsync('forceUpdate');
					if (this.config.visTables > 0) {
						await this.subscribeStatesAsync('visualization.table*.selection');
						await this.subscribeStatesAsync('visualization.table*.emptyJson');
					}

					this.log.debug('Subscribing to certain adapter states.');

					// Timer for updating Today/Yesterday in Json every midnight
					await this.callAtMidnight();
					this.log.debug('Update of "Today/Yesterday" in JSON scheduled for every midnight.');

					// Update Today/Yesterday now.
					await this.updateTodayYesterday();
					// Initially get visualization selection state values
					for (let i = 0; i < this.config.visTables; i++) {
						await this.getStateAsync('visualization.table' + i + '.selection', async (err, state) => {
							if (!err && state && !(await this.isLikeEmpty(state.val))) {
								this.g_tableFilters[i] = state.val;
							} else {
								this.g_tableFilters[i] = '';
							}
						});
					}
				});
			});
		});
	}

	/**
	 * Get json Logs from states and set to g_allLogs
	 *
	 * @param {object} callback     Callback function
	 * @return {Promise<object>}             Callback function
	 */
	async getJsonStates(callback) {
		let index = this.g_activeFilters.length;
		const help = async () => {
			index--;
			if (index >= 0) {
				await this.getStateAsync('filters.' + this.g_activeFilters[index] + '.json', async (err, state) => {
					// Value = state.val, ack = state.ack, time stamp = state.ts, last changed = state.lc
					if (!err && state && !(await this.isLikeEmpty(state.val))) {
						const logArray = JSON.parse(state.val);
						// If it is sorted ascending, convert to descending
						if (logArray.length >= 2) {
							if (logArray[0].ts < logArray[logArray.length - 1].ts) logArray.reverse();
						}
						this.g_allLogs[this.g_activeFilters[index]] = logArray;
					}
					setImmediate(help); // Call function again. We use node.js setImmediate() to avoid stack overflows.
				});
			} else {
				return callback(); // All processed.
			}
		};
		await help(); // Helper function: This is a "callback loop" through a function. Inspired by https://forum.iobroker.net/post/152418
	}

	/**
	 * Calls a function every midnight.
	 * This way, we don't need to use node-schedule which would be an overkill for this simple task.
	 * https://stackoverflow.com/questions/26306090/
	 */
	async callAtMidnight() {
		try {
			if (this.g_timerMidnight) this.clearTimeout(this.g_timerMidnight);
			this.g_timerMidnight = null;
			const now = new Date();
			const night = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate() + 1, // the next day, ...
				0,
				0,
				0, // ...at 00:00:00 hours
			);
			const offset = 1000; // we add one additional second, just in case.
			const msToMidnight = night.getTime() - now.getTime() + offset;
			this.log.debug(`callAtMidnight() called, provided function: '${this.updateTodayYesterday.name}'. Timeout at 00:00:01, which is in ${msToMidnight}ms.`);
			this.g_timerMidnight = this.setTimeout(async () => {
				this.log.debug(`callAtMidnight() : timer reached timeout, so we execute function '${this.updateTodayYesterday.name}'`);
				await this.updateTodayYesterday(); // This is the function being called at midnight.
				await this.callAtMidnight(); // Set again next midnight.
			}, msToMidnight);
		} catch (error) {
			this.log.warn(`Error at [callAtMidnight]: ${error.message}`);
			return;
		}
	}

	/**
	 * Update Today/Yesterday in g_allLogs.
	 * Typically called every midnight.
	 */
	async updateTodayYesterday() {
		try {
			for (const lpFilterName of this.g_activeFilters) {
				if (lpFilterName === undefined) continue;

				// First: Update global variable g_allLogs
				const lpLogObjects = this.g_allLogs[lpFilterName];
				let counter = 0;

				for (let i = 0; i < lpLogObjects.length; i++) {
					counter++;
					const lpLogObject = lpLogObjects[i];
					this.g_allLogs[lpFilterName][i].date = await this.tsToDateString(lpLogObject.ts, this.config.dateFormat, this.config.txtToday, this.config.txtYesterday);
					if (this.config.cssDate) this.g_allLogs[lpFilterName][i].date = `<span class='logInfo logDate'>${this.g_allLogs[lpFilterName][i].date}</span>`;
				}

				// Second: Update all JSON States
				const visTableNums = await this.getConfigVisTableNums();
				await this.updateJsonStates(lpFilterName, { updateFilters: true, tableNum: visTableNums });

				this.log.debug(`updateTodayYesterday() : Filter '${lpFilterName}', updated ${counter} logs.`);
			}
		} catch (error) {
			this.log.warn(`Error at [updateTodayYesterday]: ${error.message}`);
		}
	}

	/**
	 * Scheduled Timer: Update states every x seconds
	 */
	async scheduleUpdateStates() {
		this.log.debug('Updating states per schedule...');

		for (const filterName of this.g_activeFilters) {
			if (!(await this.isLikeEmpty(this.g_allLogs[filterName]))) {
				// Update states only if there was/were actually new log(s) coming in.
				// We add a buffer as offset to make sure we catch new logs.
				const tsNewest = this.g_allLogs[filterName][0].ts;
				const updateIntMs = this.config.updateInterval * 1000;
				const buffer = 2000;
				if (tsNewest + updateIntMs + buffer < Date.now()) {
					this.log.debug('Filter ' + filterName + ': No recent log update, last log line was on: ' + (await this.dateToLocalIsoString(new Date(tsNewest))));
				} else {
					this.log.debug('Filter ' + filterName + ': JSON states updated, most recent log from: ' + (await this.dateToLocalIsoString(new Date(tsNewest))));
					const visTableNums = [];
					if (this.config.visTables > 0) {
						for (let i = 0; i < this.config.visTables; i++) {
							visTableNums.push(i);
						}
					}
					await this.updateJsonStates(filterName, { updateFilters: true, tableNum: visTableNums });
				}
			} else {
				this.log.debug('Filter ' + filterName + ': No logs so far.');
			}
		}
		await this.setStateChangedAsync('lastTimeUpdated', { val: Date.now(), ack: true });
	}

	/**
	 * Subscribe to new logs coming in from all adapters
	 * See: https://github.com/ioBroker/ioBroker.js-controller/blob/master/doc/LOGGING.md
	 * The logObject looks like this (for "test.0 2020-03-28 17:27:08.489 error (4536) adapter disabled"):
	 * {from:'test.0', message: 'test.0 (12504) adapter disabled', severity: 'error', ts:1585413238439}
	 */
	async subscribeToAdapterLogs() {
		// @ts-ignore
		this.requireLog(true);
		// @ts-ignore
		this.on('log', async (obj) => {
			const logObject = await this.prepareNewLogObject(obj);
			if (logObject.message != '') {
				for (const filterName of this.g_activeFilters) {
					await this.addNewLogToAllLogsVar(filterName, logObject, (result) => {
						if (result == true) {
							// We are done at this point.
						}
					});
				}
			}
		});
	}

	/**
	 * update JSON Log states
	 * Updates JSON states under filters and under visualization.tableXX
	 * visualization is optional. If not set, just the states under filters will be updated.
	 * If set, it expects an object: {updateFilters:false, tableNum:[0, 2]}
	 *   - updateFilters: if states under filters should also be updated.
	 *   - tableNum: which visualization tables to be updated.
	 * @param {string} filterName       Name of the filter
	 * @param {object} [visualization]  Optional: If not set, just filters are updated. But if set, it expects an object:
	 *                                  {updateFilters:false, tableNum:'logparser.0.visualization.table1'}
	 *                                  - updateFilters: if states under filters should also be updated.
	 *                                  - tableNum: table numbers to be updated, as array.
	 */
	async updateJsonStates(filterName, visualization = undefined) {
		let doFilters = true;
		const helperArray = [...this.g_allLogs[filterName]]; // We use array spreads '...' to copy array since reverse() changes the original array.
		let mostRecentLogTime = 0;
		try {
			if (!(await this.isLikeEmpty(helperArray))) {
				mostRecentLogTime = helperArray[0].ts;
				if (!this.config.sortDescending) helperArray.reverse();
			}

			if (visualization) {
				doFilters = visualization.updateFilters; // to update the filters, if true

				// Prepare the visualization states.
				// We need these in an array.
				const finalPaths = []; // all state paths, like logparser.0.visualization.table0, etc.
				if (!(await this.isLikeEmpty(visualization.tableNum))) {
					for (const lpTableNum of [visualization.tableNum]) {
						if (this.g_tableFilters[lpTableNum] == filterName) {
							// The chosen filter in logparser.0.visualization.tableX matches with filterName
							finalPaths.push('visualization.table' + lpTableNum);
						}
					}
					if (!(await this.isLikeEmpty(finalPaths))) {
						for (const lpPath of finalPaths) {
							await this.setStateChangedAsync(lpPath + '.json', { val: JSON.stringify(helperArray), ack: true });
							await this.setStateChangedAsync(lpPath + '.jsonCount', { val: helperArray.length, ack: true });
							await this.setStateChangedAsync(lpPath + '.mostRecentLogTime', { val: mostRecentLogTime, ack: true });
							// TODO: Add here setState for file download
						}
					}
				}
			}

			if (doFilters && !(await this.isLikeEmpty(helperArray))) {
				await this.setStateChangedAsync('filters.' + filterName + '.json', { val: JSON.stringify(helperArray), ack: true });
				await this.setStateChangedAsync('filters.' + filterName + '.jsonCount', { val: helperArray.length, ack: true });
				await this.setStateChangedAsync('filters.' + filterName + '.mostRecentLogTime', { val: mostRecentLogTime, ack: true });
			}
		} catch (error) {
			return this.log.warn(`Error at [updateJsonStates]: ${error.message}`);
		}
	}

	/**
	 * Add any incoming log to g_allLogs{"filterName":logObject} and g_allLogs, if all checks passed.
	 * @param {string} filterName   Name of the filter to be updated
	 * @param {object} logObject    The log line object, which looks like:
	 *                              {from:'test.0', message: 'test.0 adapter disabled',
	 *                               severity: 'error', ts:1585413238439}
	 * @param {object} callback     Callback function. Returns true, if added, and falls if not (so if checks not passed)
	 */
	async addNewLogToAllLogsVar(filterName, logObject, callback) {
		//const newLogObject = {...logObject}
		const newLogObject = Object.assign({}, logObject); // to not alter the logObject itself. https://stackoverflow.com/questions/6089058/

		// Prepare variables
		const f = await this.objArrayGetObjByVal(this.config.parserRules, 'name', filterName); // the filter object
		const whiteListAnd = await this.stringConfigListToArray(filterName, 'Whitelist AND', f.whitelistAnd);
		const whiteListOr = await this.stringConfigListToArray(filterName, 'Whitelist OR', f.whitelistOr);
		const blacklist = await this.stringConfigListToArray(filterName, 'Blacklist', f.blacklist);
		const removeList = await this.stringConfigListToArray(filterName, 'Clean', f.clean, true);
		// Check: if no match for filter name or if filter is not active.
		if (f == undefined || !f.active) return callback(false);

		// Check: if severity is matching or not
		if (!f[newLogObject.severity]) return callback(false);

		// Check: WhitelistAnd.
		// If white list is empty, we treat as *.
		if (!(await this.isLikeEmpty(whiteListAnd))) {
			if (whiteListAnd.length == 1 && whiteListAnd[0].source.replace(/[//\\]/g, '') == '*') {
				// Need to remove regex chars '/' and '\' since it will be a regex string
				// User entered *, so we continue.
			} else if (!(await this.stringMatchesList(newLogObject.message, whiteListAnd, true))) {
				return callback(false); // No hit, so we go out.
			}
		}
		// Check: WhitelistOr.
		// If white list is empty, we treat as *
		if (!(await this.isLikeEmpty(whiteListOr))) {
			if (whiteListOr.length == 1 && whiteListOr[0].source.replace(/[//\\]/g, '') == '*') {
				// Need to remove regex chars '/' and '\' since it will be a regex string
				// User entered *, so we continue.
			} else if (!(await this.stringMatchesList(newLogObject.message, whiteListOr, false))) {
				return callback(false); // No hit, so we go out.
			}
		}

		// Check: Blacklist
		if (!(await this.isLikeEmpty(blacklist))) {
			if (await this.stringMatchesList(newLogObject.message, blacklist, false)) {
				return callback(false); // We have a hit, so we go out.
			}
		}

		// Clean: remove string portions from log message
		if (!(await this.isLikeEmpty(removeList))) {
			for (const lpListItem of removeList) {
				newLogObject.message = newLogObject.message.replace(lpListItem, '');
			}
		}

		// Remove adapter instance from log message, like: 'test.0 adapter disabled' -> 'adapter disabled'
		if (newLogObject.message.startsWith(newLogObject.from)) {
			newLogObject.message = newLogObject.message.substring(newLogObject.from.length + 1);
		}

		// Add new key "date" to newLogObject
		newLogObject.date = await this.tsToDateString(newLogObject.ts, this.config.dateFormat, this.config.txtToday, this.config.txtYesterday);

		/**
		 * Support individual items in column provided through log
		 * Syntax: 'This is a log message ##{"message":"Individual msg", "from":"other source"}##'
		 */
		const regexArr = newLogObject.message.match(/##(\{\s?".*"\s?\})##/);
		if (regexArr != null && regexArr[1] != undefined) {
			const replacer = JSON.parse(regexArr[1]);
			if (replacer['date'] != undefined) newLogObject.date = replacer['date'];
			if (replacer['severity'] != undefined) newLogObject.severity = replacer['severity'];
			if (replacer['from'] != undefined) newLogObject.from = replacer['from'];
			if (replacer['message'] != undefined) newLogObject.message = replacer['message'];
		}

		/**
		 * Apply Max Length
		 */
		if (!(await this.isLikeEmpty(f.maxLength))) {
			if (parseInt(f.maxLength) > 3) {
				newLogObject.message = newLogObject.message.substr(0, parseInt(f.maxLength));
			}
		}

		// Merge
		if (f.merge) {
			// Returns the position where the first former element was found, or -1 if not found -- https://javascript.info/array-methods#filter
			const foundPosition = this.g_allLogs[filterName].findIndex((item) => item.message.indexOf(newLogObject.message) >= 0);
			if (foundPosition >= 0) {
				const foundMsg = this.g_allLogs[filterName][foundPosition].message;
				let mergeNum = await this.getMergeNumber(foundMsg); //number of '[xxx Entries]'
				if (mergeNum != -1) {
					// We found '[xxx Entries]', so we increase by 1
					mergeNum++;
				} else {
					// No '[xxx Entries]' found, so we start with 2 ( 1='the new log line coming in' + 1='the old one')
					mergeNum = 2;
				}
				// Add merge number to log message
				// @ts-ignore
				const mergeText = this.config.txtMerge.replace('#', mergeNum);
				newLogObject.message = mergeText + newLogObject.message;
				// remove old log objects
				this.g_allLogs[filterName].splice(foundPosition, 1);
			}
		}

		// Rebuilding per keys and sort order of g_jsonKeys per adapter admin settings, like ['date', 'from', 'severity', 'message']
		const logObjJson = {};
		for (const lpKey of this.g_jsonKeys) {
			logObjJson[lpKey] = newLogObject[lpKey];
		}
		logObjJson.ts = newLogObject.ts; // Always add timestamp as last key (which will also end up in the last column of JSON table)

		// Add CSS, like <span class='logWarn logSeverity'>warn</span>
		const severityUcase = newLogObject.severity.charAt(0).toUpperCase() + newLogObject.severity.slice(1);
		if (this.config.cssDate) logObjJson.date = `<span class='log${severityUcase} logDate'>${newLogObject.date}</span>`;
		if (this.config.cssSeverity) logObjJson.severity = `<span class='log${severityUcase} logSeverity'>${newLogObject.severity}</span>`;
		if (this.config.cssMessage) logObjJson.message = `<span class='log${severityUcase} logMessage'>${newLogObject.message}</span>`;
		if (this.config.cssFrom) logObjJson.from = `<span class='log${severityUcase} logFrom'>${newLogObject.from}</span>`;

		// Finally: add newLogObject to g_allLogs
		this.g_allLogs[filterName].unshift(logObjJson); // add element at beginning
		this.g_allLogs[filterName] = this.g_allLogs[filterName].slice(0, this.config.maxLogs); // limit number of items

		return callback(true);
	}

	/**
	 * @param  {string}   strInput    A log message which may have leading '[123 entries]'
	 * @return {Promise<number>}   returns the number 123 from '[123 entries]' if any match, or -1 if not found
	 */
	async getMergeNumber(strInput) {
		const splitUp = this.config.txtMerge.split('#');
		const mergeRegExp = new RegExp((await this.escapeRegExp(splitUp[0])) + '(\\d+)' + (await this.escapeRegExp(splitUp[1])) + '.*');
		const matches = mergeRegExp.exec(strInput);
		if (matches === null) {
			return -1;
		} else {
			return parseInt(matches[1]);
		}
	}

	/**
	 * Prepares a new logObject
	 * @param {object} logObject  The new log line as object with keys: from, message, severity, ts
	 * @return {Promise<object>}   The same object with a cleaned message. Empty message, if not passing verification.
	 **/
	async prepareNewLogObject(logObject) {
		// Prepare message
		let msg = (await this.isLikeEmpty(logObject.message)) ? '' : logObject.message; // set empty string if no message
		msg = msg.replace(/\s+/g, ' '); // Remove multiple white-spaces, tabs and new line from log message

		// Never handle logs of this LogParser adapter to make sure not having endless loops.
		if (logObject.from == this.namespace) msg = '';

		if (msg !== '') {
			// Check if globally blacklisted
			if (await this.stringMatchesList(msg, this.g_globalBlacklist, false)) msg = ''; // If message is blacklisted, we set an empty string.

			// Verify log level (severity)
			if (await this.isLikeEmpty(logObject.severity)) {
				msg = '';
			} else if (!['debug', 'info', 'warn', 'error'].includes(logObject.severity)) {
				msg = ''; // We expect one of the above log levels
			}

			// Remove PID
			if (this.config.removePid) msg = await this.removePid(msg);

			// Remove (COMPACT)
			if (this.config.removeCompact) msg = msg.replace(/(\(COMPACT)\) /, '');

			// Remove 'script.js.Script_Name: '
			if (msg.includes('script.js', 0) && this.config.removeScriptJs) msg = msg.replace(/script\.js\.[^:]*: /, '');

			// Remove 'script.js.Script_Name: '
			if (msg.includes('script.js', 0) && this.config.removeOnlyScriptJs) msg = msg.slice(msg.lastIndexOf('.') + 1);

			// Verify source
			if (await this.isLikeEmpty(logObject.from)) msg = '';

			// Verify timestamp
			//if ((await this.isLikeEmpty(logObject.ts)) && typeof logObject.ts != 'number') msg = '';
		}

		logObject.message = msg;

		return logObject;
	}

	/**
	 * Checks and validates the configuration values of adapter settings
	 * Provides result in "config" variable and returns true if all successfully validated, and false if not.
	 * TODO: Write separate function for validation of user inputs for all data types like number, string, etc.
	 * TODO:    This could be generic for all adapters. Also, look into possible npm scripts available.
	 *
	 *  @param {object} [callback]     Optional: a callback function
	 *  @return {Promise<object>}               Callback with parameter success (true/false)
	 */
	async initializeConfigValues(callback) {
		const errorMsg = [];

		// Verify "txtToday"
		if (!(await this.isLikeEmpty(this.config.txtToday))) {
			this.config.txtToday = this.config.txtToday.replace(this.g_forbiddenCharsA, '').trim();
			if (this.config.txtToday == '') {
				this.config.txtToday = 'Today';
				this.log.debug('Corrected txtToday option and set to "Today"');
			}
		} else {
			this.config.txtToday = 'Today';
			this.log.debug('Corrected txtToday option and set to "Today"');
		}

		// Verify "txtYesterday"
		if (!(await this.isLikeEmpty(this.config.txtYesterday))) {
			this.config.txtYesterday = this.config.txtYesterday.replace(this.g_forbiddenCharsA, '').trim();
			if (this.config.txtYesterday == '') {
				this.config.txtYesterday = 'Yesterday';
				this.log.debug('Corrected txtYesterday option and set to "Yesterday"');
			}
		} else {
			this.config.txtYesterday = 'Yesterday';
			this.log.debug('Corrected txtYesterday option and set to "Yesterday"');
		}

		// Verify filter table "parserRules"
		if (!(await this.isLikeEmpty(this.config.parserRules))) {
			let anyRuleActive = false;
			for (let i = 0; i < this.config.parserRules.length; i++) {
				// Just some basics. We do further verification when going thru the filters
				if (!(await this.isLikeEmpty(this.config.parserRules[i].active)) && this.config.parserRules[i].active == true) {
					anyRuleActive = true;
					const name = this.config.parserRules[i].name.replace(this.g_forbiddenCharsB, '');
					if (name.length > 0) {
						// We need at least one char.
						this.config.parserRules[i].name = name;
						this.g_activeFilters.push(name); // All active filters go here
						this.g_allLogs[name] = []; // Prepare g_allLogs variable;
					} else {
						errorMsg.push('Removed forbidden chars of filter name, and name now results in length = 0.');
					}
				}
			}
			if (!anyRuleActive) {
				errorMsg.push('No active filters (parser rules) defined in the adapter configuration.');
			}
		} else {
			errorMsg.push('No filters (parser rules) defined in the adapter configuration.');
		}

		// Verify "jsonColumns"
		if (!(await this.isLikeEmpty(this.config.jsonColumns))) {
			this.g_jsonKeys = this.config.jsonColumns.split(',');
		} else {
			this.g_jsonKeys = ['date', 'severity', 'from', 'message'];
			this.config.jsonColumns = 'date,severity,from,message';
			this.log.warn('No column order in adapter configuration chosen, so we set to "date, severity, from, message"');
		}

		// Verify "visTables"
		if (!(await this.isLikeEmpty(this.config.visTables))) {
			const numvisTables = this.config.visTables;
			if (numvisTables > 50) {
				this.config.visTables = 50;
				this.log.warn('Configuration corrected: More than 50 VIS views is not allowed, so set to 50.');
			} else if (numvisTables < 0) {
				this.config.visTables = 0;
				this.log.warn('Configuration corrected: More than 50 VIS views is not allowed, so set to 50.');
			} else {
				this.config.visTables = numvisTables;
			}
		} else {
			this.config.visTables = 0;
			this.log.warn('No VIS view number provided in settings, so set to 0.');
		}

		// Verify "updateInterval"
		if (!(await this.isLikeEmpty(this.config.updateInterval))) {
			const uInterval = this.config.updateInterval;
			if (uInterval < this.g_minUpdateInterval) {
				this.config.updateInterval = this.g_minUpdateInterval;
				this.log.warn('Configuration corrected: Update interval < ' + this.g_minUpdateInterval + ' seconds is not allowed, so set to ' + this.g_minUpdateInterval + ' seconds.');
			} else {
				this.config.updateInterval = uInterval;
			}
		} else {
			this.config.updateInterval = this.g_defaultUpdateInterval;
			this.log.warn('No update interval was provided in settings, so set to 20 seconds.');
		}

		// Verify "maxLogs"
		if (!(await this.isLikeEmpty(this.config.maxLogs))) {
			const maxLogs = this.config.maxLogs;
			if (maxLogs < 1) {
				this.config.maxLogs = 1;
				this.log.warn('Configuration corrected: maxLogs < 1 is not allowed, so set to 1.');
			} else if (maxLogs > 500) {
				this.config.maxLogs = 500;
				this.log.warn('Configuration corrected: maxLogs > 500 is not allowed, so set to 500');
			} else {
				this.config.maxLogs = maxLogs;
			}
		} else {
			this.config.maxLogs = 100;
			this.log.warn('No maxLogs number was provided in settings, so set to 100.');
		}

		// Verify and convert "g_globalBlacklist"
		if (!(await this.isLikeEmpty(this.config.globalBlacklist))) {
			for (const lpConfBlacklist of this.config.globalBlacklist) {
				if (!lpConfBlacklist.active) continue;
				if (!(await this.isLikeEmpty(lpConfBlacklist.item))) {
					// See description of function convertRegexpString().
					this.g_globalBlacklist.push(await this.convertRegexpString(lpConfBlacklist.item));
				}
			}
		}

		// Finalize
		let success;
		if (errorMsg.length == 0) {
			success = true;
		} else {
			success = false;
			this.log.warn(errorMsg.length + ' configuration error(s): ' + errorMsg.join('; '));
		}
		if (typeof callback === 'function') {
			// execute if a function was provided to parameter callback
			return callback(success);
		} else {
			return success;
		}
	}

	/**
	 * Build arrays of objects which we need to create.
	 * Also, we delete states no longer needed.
	 * @return {Promise<object>} Array if arrays containing: [string:Statepath, boolean:forceCreation, object:common]
	 */
	async prepareAdapterObjects() {
		const finalStates = [];

		/*********************************
		 * A: Build all states needed
		 *********************************/
		// Regular states for each filter
		for (const lpFilterName of this.g_activeFilters) {
			finalStates.push(['filters.' + lpFilterName + '.name', false, { name: 'Name', type: 'string', read: true, write: false, role: 'text', def: lpFilterName }]);
			finalStates.push(['filters.' + lpFilterName + '.json', false, { name: 'JSON', type: 'string', read: true, write: false, role: 'json', def: '[]' }]);
			finalStates.push(['filters.' + lpFilterName + '.jsonCount', false, { name: 'Number of log lines in json', type: 'number', read: true, write: false, role: 'value', def: 0 }]);
			finalStates.push(['filters.' + lpFilterName + '.emptyJson', false, { name: 'Empty the json state', type: 'boolean', read: false, write: true, role: 'button', def: false }]);
			//finalStates.push(['filters.' + lpFilterName + '.downloadTXT', false, { name: 'Download log as txt file', type: 'file', read: false, write: true, role: 'state' }]);

			finalStates.push([
				'filters.' + lpFilterName + '.mostRecentLogTime',
				false,
				{ name: 'Date/time of most recent log (timestamp)', type: 'number', read: true, write: false, role: 'value.time', def: 0 },
			]);
		}

		// General states
		finalStates.push(['emptyAllJson', false, { name: 'Empty all json states', type: 'boolean', read: false, write: true, role: 'button', def: false }]);
		finalStates.push(['forceUpdate', false, { name: 'Force updating all states immediately', type: 'boolean', read: false, write: true, role: 'button', def: false }]);
		finalStates.push(['lastTimeUpdated', false, { name: 'Date/time of last update (timestamp)', type: 'number', read: true, write: false, role: 'value.time', def: 0 }]);

		// States for VIS tables
		if (this.config.visTables > 0) {
			const dropdown = {};
			for (const lpFilterName of this.g_activeFilters) {
				dropdown[lpFilterName] = lpFilterName;
			}
			for (let i = 0; i < this.config.visTables; i++) {
				const lpVisTable = 'visualization.table' + i;
				finalStates.push([
					lpVisTable + '.selection',
					true,
					{ name: 'Selected log filter', type: 'string', read: false, write: true, role: 'value', states: dropdown, def: this.g_activeFilters[0] },
				]);
				finalStates.push([lpVisTable + '.json', false, { name: 'JSON of selection', type: 'string', read: true, write: false, role: 'json', def: '[]' }]);
				finalStates.push([lpVisTable + '.jsonCount', false, { name: 'Number of log lines in json of selection', type: 'number', read: true, write: false, role: 'value', def: 0 }]);
				finalStates.push([
					lpVisTable + '.mostRecentLogTime',
					false,
					{ name: 'Date/time of most recent log of selection', type: 'number', read: true, write: false, role: 'value.time', def: 0 },
				]);
				finalStates.push([lpVisTable + '.emptyJson', false, { name: 'Empty the json state of selection', type: 'boolean', read: false, write: true, role: 'button', def: false }]);
			}
		}

		/*********************************
		 * B: Delete all objects which are no longer used.
		 *********************************/

		// Let's get all states and devices, which we still need, into an array
		const statesUsed = [];
		for (const lpStateObj of finalStates) {
			const lpState = lpStateObj[0].toString(); // like: "_visualization.table1.selection"
			statesUsed.push(this.namespace + '.' + lpState);
		}

		// Next, delete all states no longer needed.
		this.getStatesOf((err, result) => {
			if (result != undefined) {
				for (const lpState of result) {
					const statePath = lpState._id;
					if (statesUsed.indexOf(statePath) == -1) {
						// State is no longer used.
						this.log.info('Delete state [' + statePath + '], since it is no longer used.');
						this.delObject(statePath); // Delete state.
					}
				}
			}
		});
		return finalStates;
	}

	/**
	 * Get Adapter config visTables as array.
	 */
	async getConfigVisTableNums() {
		const visTableNums = [];
		try {
			if (this.config.visTables && this.config.visTables > 0) {
				for (let i = 0; i < this.config.visTables; i++) {
					visTableNums.push(i);
				}
			}
			return visTableNums;
		} catch (error) {
			this.log.warn(`Error at [getConfigVisTableNums]: ${error.message}`);
		}
	}

	/**
	 * Remove PID from log message
	 * The js-controller version 2.0+ adds the PID number inside brackets to the beginning of
	 * the message, like 'javascript.0 (123) Logtext 123 Logtext 123 Logtext 123 Logtext 123'
	 * @param {string} msg   The log message, like: 'javascript.0 (123) Logtext 123 Logtext 123 Logtext 123 Logtext 123'
	 */
	async removePid(msg) {
		const matchesArray = msg.match(/^(\S+)\s(.*)/);
		if (matchesArray != null) {
			const partOne = matchesArray[1]; // like 'javascript.0'
			let partTwo = matchesArray[2]; // like '(123) Logtext 123 Logtext 123 Logtext 123 Logtext 123'
			partTwo = partTwo.replace(/^\([0-9]{1,9}\)\s/, ''); // Remove the PID
			msg = partOne + ' ' + partTwo; // re-build the full message without the PID
		}
		return msg;
	}

	/**
	 * Create Adapter Objects
	 * TODO: consider https://github.com/ioBroker/ioBroker.repositories/pull/741#issuecomment-642248790
	 * TODO:          --> "In which situations are objects created with "force" flag? ... maybe extendObject is better?"
	 *
	 * @param {array}  objects      Array of states array to create. Like [[string:State path, boolean:forceCreation, object:common]]
	 * @param {object} callback     Callback function, so once all objects are created.
	 * @return {Promise<object>}             Callback function

	 */
	async createAdapterObjects(objects, callback) {
		let numStates = objects.length;
		/**
		 * Helper function: This is a "callback loop" through a function. Inspired by https://forum.iobroker.net/post/152418
		 */
		const helper = async () => {
			numStates--;
			if (numStates >= 0) {
				if (objects[numStates][1]) {
					// Force Creation is true
					await this.setObjectAsync(objects[numStates][0], { type: 'state', common: objects[numStates][2], native: {} }, (err, obj) => {
						if (!err && obj) this.log.debug('Object created (force:true): ' + objects[numStates][0]);
						setImmediate(helper); // we call function again. We use node.js setImmediate() to avoid stack overflows.
					});
				} else {
					// Force Creation is false
					await this.setObjectNotExistsAsync(objects[numStates][0], { type: 'state', common: objects[numStates][2], native: {} }, (err, obj) => {
						if (!err && obj) this.log.debug('Object created  (force:false): ' + objects[numStates][0]);
						setImmediate(helper); // we call function again. We use node.js setImmediate() to avoid stack overflows.
					});
				}
			} else {
				// All objects processed
				return callback();
			}
		};
		helper();
	}

	/**
	 * Convert timestamp to a string and format accordingly.
	 * @param {string}  ts          Timestamp
	 * @param {string}  format      Like 'yyyy-mm-dd HH:MM:SS'. Both upper case and lower case letters are allowed.
	 *                              If date is within hash (#), so like '#yyyy-mm-dd# HH:MM:SS', it will be replaced
	 *                              with "Today"/"Yesterday" if date is today/yesterday.
	 * @param {string}  [today]     String for "Today"
	 * @param {string}  [yesterday] String for "Yesterday"
	 * @return {Promise<string>}  Returns the resulting date string

	 */
	async tsToDateString(ts, format, today = 'Today', yesterday = 'Yesterday') {
		const dateObj = new Date(ts);
		const isoDateStrHelper = await this.dateToLocalIsoString(dateObj); // like: '2020-02-20T19:52:13.634'

		const todayStr = !(await this.isLikeEmpty(today)) ? today : 'Today';
		const yesterdayStr = !(await this.isLikeEmpty(yesterday)) ? yesterday : 'Yesterday';

		let strResult = format;

		// 1. Replace today's date and yesterday's date with adapter.config.txtToday / adapter.config.txtYesterday
		const hashMatch = strResult.match(/#(.*)#/);
		if (hashMatch != null) {
			const todayYesterdayTxt = todayYesterday(dateObj);
			if (todayYesterdayTxt != '') {
				// We have either today or yesterday, so set according txt
				strResult = strResult.replace('#' + hashMatch[1] + '#', todayYesterdayTxt);
			} else {
				// Neither today nor yesterday, so remove all ##
				strResult = strResult.replace(/#/g, '');
			}
		}

		// 2. Replace all the rest.
		strResult = strResult.replace('YYYY', isoDateStrHelper.substr(0, 4));
		strResult = strResult.replace('YY', isoDateStrHelper.substr(2, 2));
		strResult = strResult.replace('MM', isoDateStrHelper.substr(5, 2));
		strResult = strResult.replace('DD', isoDateStrHelper.substr(8, 2));
		strResult = strResult.replace('hh', isoDateStrHelper.substr(11, 2));
		strResult = strResult.replace('mm', isoDateStrHelper.substr(14, 2));
		strResult = strResult.replace('ss', isoDateStrHelper.substr(17, 2));
		strResult = strResult.replace('ms', isoDateStrHelper.substr(20, 3));

		return strResult;

		/**
		 * todayYesterday
		 * @param {object} dateGiven   Date object, created with new Date()
		 * @return {string}            'Heute', if today, 'Gestern' if yesterday, empty string if neither today nor yesterday
		 */
		function todayYesterday(dateGiven) {
			const today = new Date();
			const yesterday = new Date();
			yesterday.setDate(today.getDate() - 1);
			if (dateGiven.toLocaleDateString() == today.toLocaleDateString()) {
				return todayStr;
			} else if (dateGiven.toLocaleDateString() == yesterday.toLocaleDateString()) {
				return yesterdayStr;
			} else {
				return '';
			}
		}
	}

	/**
	 * Convert date/time to a local ISO string
	 * This function is needed since toISOString() uses UTC +0 (Zulu) as time zone.
	 * https://stackoverflow.com/questions/10830357/
	 * Mic-M, 04/Apr/2020
	 * @param {object}  date    Date object
	 * @return {Promise<string>}  string like "2015-01-26T06:40:36.181", without trailing Z (which would represent Zulu time zone)

	 */
	async dateToLocalIsoString(date) {
		const timezoneOffset = date.getTimezoneOffset() * 60000; //offset in milliseconds
		return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, -1);
	}

	/**
	 * Escapes a string for use in RegEx as (part of) pattern
	 * Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Escaping
	 * @param {string}   inputStr  The input string to be escaped
	 * @return {Promise<string>}  The escaped string
	 */
	async escapeRegExp(inputStr) {
		return inputStr.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
	}

	/**
	 * Convert a comma-separated string into array of regex objects.
	 * The string can both contain strings and regex. Ex: "/script.js.[^:]*: /, ABC, +++"
	 * If addGlobal = true, then an additional  global flag 'g' will be added to the string.
	 * This will not affect any regex, but just limited to provided strings.
	 *
	 * @param {string}  filterName  Name of filter, for logging purposes only
	 * @param {string}  optionTitle Title of option "Whitelist AND", "Whitelist OR", etc, for logging purposes only
	 * @param {string}  input       String
	 * @param {boolean} [addGlobal=false]   If true and if it is a string, we will add the global flag 'g'
	 * @return {Promise<array>}              Array of list items as regex
	 */
	async stringConfigListToArray(filterName, optionTitle, input, addGlobal = false) {
		const result = [];
		if (await this.isLikeEmpty(input)) return [];

		input = input.replace(/,\s/g, ','); // replace all ", " with ","

		// split to array. We do not use >input.split(',')< since it would also split regexp if commas used inside regex
		// fixes issue #15 - https://github.com/Mic-M/ioBroker.logparser/issues/15
		const inputArray = input.match(/([^{,]*((\{[^}]*\})*))+/g); // https://stackoverflow.com/a/11444046
		if (!inputArray) return [];
		for (const lpItem of inputArray) {
			if (lpItem.length < 1) continue;
			const converted = await this.convertRegexpString(lpItem, addGlobal);
			if (typeof converted == 'string' && converted.startsWith('Regex Error: ')) {
				// converted will be like: Regex Error: SyntaxError: Invalid regular expression: /script\.js\.[^:]*: [XXX YYY]/: Range out of order in character class
				this.log.warn('Filter "' + filterName + '", option "' + optionTitle + '":' + converted);
				this.log.warn('Therefore, regex in filter "' + filterName + '", option "' + optionTitle + '" will be ignored.');
			} else {
				result.push(converted);
			}
		}
		return result;
	}

	/**
	 * The adapter config allows both strings (like 'Hello world!') and regex as string, so like '/.*Hello$/i').
	 * With this function, we convert a string recognized as regex into a RegExp type variable, and
	 * if no regex recognized and it is a string, we convert the string to a regexp.
	 * The return value is being used in replace function.
	 * Inspired by https://stackoverflow.com/questions/874709/
	 * Mic-M – 09/Apr/2020
	 *
	 * @param {string}  input               The input string
	* @param {boolean} [addGlobal=false]   If true and if it is a string, we will add the global flag 'g'
	 * @return {Promise<RegExp|string>}              regexp or string. If Regex error: String starting with 'Regex Error: '

	 */
	async convertRegexpString(input, addGlobal = false) {
		const regParts = input.match(/^\/(.*?)\/([gim]*)$/);
		if (regParts) {
			// The parsed pattern had delimiters and modifiers, so it is a regex.
			let returnVal;
			try {
				returnVal = new RegExp(regParts[1], regParts[2]);
			} catch (err) {
				return 'Regex Error: ' + err;
			}
			return returnVal;
		} else {
			// No delimiters and modifiers, so it is a plain string
			// We convert to regex and do optionally apply a global to match all occurrences
			const gbl = addGlobal ? 'g' : '';
			return new RegExp(await this.escapeRegExp(input), gbl);
		}
	}

	/**
	 * Checks a string against an array of strings or regexp.
	 * March 2020 | Mic-M
	 * @param {string}	stringToCheck  String to check against array
	 * @param {array}	listArray      Array of blacklist. Both strings and regexp are allowed.
	 * @param {boolean}	all            If true, then ALL items of listArray must match to return true.
	 *                                 If false, one match or more will return true
	 */
	async stringMatchesList(stringToCheck, listArray, all) {
		if (await this.isLikeEmpty(listArray)) return false;
		let count = 0;
		let hit = 0;

		for (const lpListItem of listArray) {
			if (lpListItem !== undefined) {
				count = count + 1;
				if (lpListItem instanceof RegExp) {
					// https://stackoverflow.com/questions/4339288/typeof-for-regexp
					// We have a regex
					if (stringToCheck.match(lpListItem) != null) {
						hit = hit + 1;
					}
				} else if (typeof lpListItem == 'string') {
					// No regex, we have a string
					if (stringToCheck.includes(lpListItem)) {
						hit = hit + 1;
					}
				}
			}
		}
		if (count == 0) return true;
		if (all) {
			return count == hit ? true : false;
		} else {
			return hit > 0 ? true : false;
		}
	}

	/**
	 * Checks an array of objects for property matching value, and returns first hit.
	 * Inspired: https://stackoverflow.com/questions/13964155/
	 * 31 Mar 2020 | Mic-M
	 *
	 * @param {array}   objects  Array of objects
	 * @param {string}  key      Key name
	 * @param {*}       value    Value of the key we are looking for.
	 *                           We return first match, assuming provided value is unique.
	 *                           If not found, we return undefined.
	 */
	async objArrayGetObjByVal(objects, key, value) {
		try {
			const result = objects.filter((obj) => {
				return obj[key] === value;
			});
			if (result.length == 0) {
				return undefined;
			} else {
				return result[0]; // we return first match, assuming provided value is unique.
			}
		} catch (error) {
			this.log.warn(`Error at [objArrayGetObjByVal]: ${error.message}`);
		}
	}

	/**
	 * Checks if Array or String is not undefined, null or empty.
	 * Array or String containing just white spaces or >'< or >"< or >[< or >]< is considered empty
	 * 08-Sep-2019: added check for [ and ] to also catch arrays with empty strings.
	 * @param  {any}  inputVar   Input Array or String, Number, etc.
	 */
	async isLikeEmpty(inputVar) {
		if (typeof inputVar !== 'undefined' && inputVar !== null) {
			let strTemp = JSON.stringify(inputVar);
			strTemp = strTemp.replace(/\s+/g, ''); // remove all white spaces
			strTemp = strTemp.replace(/"+/g, ''); // remove all >"<
			strTemp = strTemp.replace(/'+/g, ''); // remove all >'<
			strTemp = strTemp.replace(/\[+/g, ''); // remove all >[<
			strTemp = strTemp.replace(/\]+/g, ''); // remove all >]<
			if (strTemp !== '') {
				return false;
			} else {
				return true;
			}
		} else {
			return true;
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id   	State Path
	 * @param {any}    state	State object
	 */
	async onStateChange(id, state) {
		if (state) {
			// A subscribed state has changed
			const emptyJson = async (filterName) => {
				// in variable
				this.g_allLogs[filterName] = [];

				// in filters states
				await this.setStateChangedAsync('filters.' + filterName + '.json', { val: '[]', ack: true });
				await this.setStateChangedAsync('filters.' + filterName + '.jsonCount', { val: 0, ack: true });
				await this.setStateChangedAsync('filters.' + filterName + '.mostRecentLogTime', { val: 0, ack: true });

				// in visualization states
				if (this.config.visTables > 0) {
					for (let i = 0; i < this.config.visTables; i++) {
						if (this.g_tableFilters[i] && this.g_tableFilters[i] == filterName) {
							await this.setStateChangedAsync('visualization.table' + i + '.json', { val: '[]', ack: true });
							await this.setStateChangedAsync('visualization.table' + i + '.jsonCount', { val: 0, ack: true });
							await this.setStateChangedAsync('visualization.table' + i + '.mostRecentLogTime', { val: 0, ack: true });
						}
					}
				}
				await this.setStateChangedAsync(id, { val: false, ack: true }); // Acknowledge the positive response
			};

			// Get state parts from like logparser.0.filters.WarnAndError.emptyJson
			const fromEnd1 = id.split('.')[id.split('.').length - 1]; // [emptyJson]
			const fromEnd2 = id.split('.')[id.split('.').length - 2]; // [WarnAndError]
			const fromEnd3 = id.split('.')[id.split('.').length - 3]; // [filters]
			const allExceptLast = id.substr(0, id.length - fromEnd1.length - 1); // [logparser.0.filters.WarnAndError]

			// Empty all JSON
			if (fromEnd1 == 'emptyAllJson' && state.val && !state.ack) {
				for (const filterName of this.g_activeFilters) {
					await emptyJson(filterName);
				}

				// Empty a JSON of a filter
			} else if (fromEnd3 == 'filters' && fromEnd1 == 'emptyJson' && state.val && !state.ack) {
				await emptyJson(fromEnd2);

				// Force Update
			} else if (fromEnd1 == 'forceUpdate' && state.val && !state.ack) {
				for (const filterName of this.g_activeFilters) {
					const visTableNums = await this.getConfigVisTableNums();
					await this.updateJsonStates(filterName, { updateFilters: true, tableNum: visTableNums });
					await this.setStateChangedAsync(id, { val: false, ack: true }); // Acknowledge the positive response
				}
				await this.setStateChangedAsync('lastTimeUpdated', { val: Date.now(), ack: true });

				// Visualization: Changed selection
			} else if (fromEnd3 == 'visualization' && fromEnd1 == 'selection' && state.val && !state.ack) {
				if (this.g_activeFilters.indexOf(state.val) != -1) {
					// get number from 'visualization.table0', 'visualization.table1', etc.
					const matches = allExceptLast.match(/\d+$/); // https://stackoverflow.com/questions/6340180/
					if (matches) {
						// We have got a number.
						const number = parseInt(matches[0]);
						if (this.g_tableFilters != state.val) {
							// continue only if new selection is different to old
							this.g_tableFilters[number] = state.val; // global variable
							await this.updateJsonStates(state.val, { updateFilters: false, tableNum: [number] });
						}
					}
				}

				// Visualization: emptyJson
			} else if (fromEnd3 == 'visualization' && fromEnd1 == 'emptyJson' && state.val && !state.ack) {
				await this.getStateAsync(allExceptLast + '.selection', async (err, state) => {
					// Value = state.val, ack = state.ack, time stamp = state.ts, last changed = state.lc
					if (!err && state && !(await this.isLikeEmpty(state.val))) {
						if (this.g_activeFilters.indexOf(state.val) != -1) {
							await emptyJson(state.val);
							await this.setStateChangedAsync(id, { val: false, ack: true }); // Acknowledge the positive response
						}
					}
				});
			}
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		isUnloaded = true;

		try {
			if (this.g_timerUpdateStates) {
				this.clearTimeout(this.g_timerUpdateStates);
				this.g_timerUpdateStates = null;
			}
			if (this.g_timerMidnight) {
				this.clearTimeout(this.g_timerMidnight);
				this.g_timerMidnight = null;
			}
			this.log.info('cleaned everything up...');
			callback();
		} catch (e) {
			callback();
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new LogParser(options);
} else {
	// otherwise start the instance directly
	new LogParser();
}
