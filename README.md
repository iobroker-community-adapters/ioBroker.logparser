![Logo](admin/logparser.png)
# ioBroker.logparser

![Number of Installations](http://iobroker.live/badges/logparser-installed.svg)
![Number of Installations](http://iobroker.live/badges/logparser-stable.svg)
[![NPM version](http://img.shields.io/npm/v/iobroker.logparser.svg)](https://www.npmjs.com/package/iobroker.logparser)

![Test and Release](https://github.com/iobroker-community-adapters/iobroker.logoarser/workflows/Test%20and%20Release/badge.svg)
[![Translation status](https://weblate.iobroker.net/widgets/adapters/-/logparser/svg-badge.svg)](https://weblate.iobroker.net/engage/adapters/?utm_source=widget)
[![Downloads](https://img.shields.io/npm/dm/iobroker.logparser.svg)](https://www.npmjs.com/package/iobroker.logparser)

**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.**
For more details and for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.


## Info

This adapter parses (filters) all logs of ioBroker adapters and provides the results as JSON in states for each filter as configured in the settings.
Resulting JSON can then be used in VIS for visualization. States for emptying (clearing) old logs are provided as well (like `logparser.0.filters.Homematic.emptyJson` or `logparser.0.emptyAllJson` to empty all.)

![States](docs/en/img/states.png)


## Installation

Just install the adapter regularly through the ioBroker admin interface. The adapter is both in the latest and stable repository.

## Instructions

I have included all instructions right in the admin settings of this adapter.

Also, you can read most of these instructions here as well:
* [**Basic Adapter Instructions**](https://github.com/iobroker-community-adapters/ioBroker.logparser/blob/master/admin/doc-md/start_en.md) - for German [click here (Deutsch)](https://github.com/iobroker-community-adapters/ioBroker.logparser/blob/master/admin/doc-md/start_de.md)
* [**Parser Rules (Filters)**](https://github.com/iobroker-community-adapters/ioBroker.logparser/blob/master/admin/doc-md/table-parser-rules_en.md) - for German [click here (Deutsch)](https://github.com/iobroker-community-adapters/ioBroker.logparser/blob/master/admin/doc-md/table-parser-rules_de.md)
* [**Global Blacklist**](https://github.com/iobroker-community-adapters/ioBroker.logparser/blob/master/admin/doc-md/table-global-blacklist_en.md) - for German [click here (Deutsch)](https://github.com/iobroker-community-adapters/ioBroker.logparser/blob/master/admin/doc-md/table-global-blacklist_de.md)


## Visualization Example (animated gif)

![Vis](docs/de/img/visintro.gif)

## Screenshots of adapter options

Please note that these screenshots are a snapshot and do not reflect the latest adapter options.
This is just to provide you an overview of the adapter options. 

![Log Parser Options](admin/img/option-screenshots/tab-start.png)

![Log Parser Options](admin/img/option-screenshots/tab-parser-rules.png)

![Log Parser Options](admin/img/option-screenshots/tab-further-settings.png)

![Log Parser Options](admin/img/option-screenshots/tab-vis.png)

![Log Parser Options](admin/img/option-screenshots/tab-global-blacklist.png)

![Log Parser Options](admin/img/option-screenshots/tab-expert-settings.png)


## Links and resources
* [**Log Parser ioBroker Forum Link (Splash Page)**](https://forum.iobroker.net/topic/37793/log-parser-adapter-splash-page)


## Credits
Providing this adapter would not have been possible without the great work of @Mic-M (https://github.com/Mic-M).
 
## How to report issues and feature requests

Please use GitHub issues for this.

Best is to set the adapter to Debug log mode (Instances -> Expert mode -> Column Log level). Then please get the logfile from disk (subdirectory "log" in ioBroker installation directory and not from Admin because Admin cuts the lines). If you do not like providing it in GitHub issue you can also send it to me via email (mcm57@gmx.at). Please add a reference to the relevant GitHub issue AND also describe what I see in the log at which time.

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
* (McM1957) Adapter has been moved to iobroker-community-adapters

### 1.1.0
* (Mic-M) Fixed issue [#15](https://github.com/Mic-M/ioBroker.logparser/issues/15) regarding regex for tab "Parser Rules", column "Blacklist"
* (Mic-M) Enhancement [#16](https://github.com/Mic-M/ioBroker.logparser/issues/16) - add specific CSS classes to any element of the JSON log per adapter option.
* (Mic-M) Major improvement: Implemented entire documentation into adapter itself to significantly improve usability.
* (Mic-M) A few improvements under the hood.

### 1.0.4
* (Mic-M) Fixed 'Today/Yesterday' updating issue - https://forum.iobroker.net/post/469757. Thanks to (Kuddel) for reporting and (Glasfaser) for further debugging.

### 1.0.3
* (Mic-M) Added [Sentry](https://github.com/ioBroker/plugin-sentry)

### 1.0.2
* (Mic-M) Added debug logging for callAtMidnight() and updateTodayYesterday()

### 1.0.1
* (Mic-M) Updated lodash dependency from 4.17.15 to 4.17.19

### 1.0.0
* (Mic-M) No changes - just prepare versioning to add adapter to stable repository per [Adapter dev docu](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterdev.md#versioning)

## License
MIT License

Copyright (c) 2020 - 2023 Mic-M, McM1957 <mcm57@gmx.at>, ciddi89 <mail@christian-behrends.de>,  ioBroker Community Developers 

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
