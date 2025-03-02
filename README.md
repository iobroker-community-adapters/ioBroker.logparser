![Logo](admin/logparser.png)

# ioBroker.logparser

[![GitHub license](https://img.shields.io/github/license/iobroker-community-adapters/ioBroker.logparser)](https://github.com/iobroker-community-adapters/ioBroker.logparser/blob/main/LICENSE)
[![Downloads](https://img.shields.io/npm/dm/iobroker.logparser.svg)](https://www.npmjs.com/package/iobroker.logparser)
![GitHub repo size](https://img.shields.io/github/repo-size/iobroker-community-adapters/ioBroker.logparser)
[![Translation status](https://weblate.iobroker.net/widgets/adapters/-/logparser/svg-badge.svg)](https://weblate.iobroker.net/engage/adapters/?utm_source=widget)</br>
![GitHub commit activity](https://img.shields.io/github/commit-activity/m/iobroker-community-adapters/ioBroker.logparser)
![GitHub commits since latest release (by date)](https://img.shields.io/github/commits-since/iobroker-community-adapters/ioBroker.logparser/latest)
![GitHub last commit](https://img.shields.io/github/last-commit/iobroker-community-adapters/ioBroker.logparser)
![GitHub issues](https://img.shields.io/github/issues/iobroker-community-adapters/ioBroker.logparser)
</br>
**Version:** </br>
[![NPM version](http://img.shields.io/npm/v/iobroker.logparser.svg)](https://www.npmjs.com/package/iobroker.logparser)
![Current version in stable repository](https://iobroker.live/badges/logparser-stable.svg)
![Number of Installations](https://iobroker.live/badges/logparser-installed.svg)
</br>
**Tests:** </br>
[![Test and Release](https://github.com/iobroker-community-adapters/ioBroker.logparser/actions/workflows/test-and-release.yml/badge.svg)](https://github.com/iobroker-community-adapters/ioBroker.logparser/actions/workflows/test-and-release.yml)
[![CodeQL](https://github.com/iobroker-community-adapters/ioBroker.logparser/actions/workflows/codeql.yml/badge.svg)](https://github.com/iobroker-community-adapters/ioBroker.logparser/actions/workflows/codeql.yml)

## Sentry

**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.**
For more details and for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.

## Documentation

🇬🇧 [Documentation](/docs/en/logparser.md)</br>
🇩🇪 [Dokumentation](/docs/de/logparser.md)

## Discussion and Questions

[ioBroker Forum](https://forum.iobroker.net/topic/63322/test-adapter-log-parser-1-2-x-latest)</br>

## Info

This adapter parses (filters) all logs of ioBroker adapters and provides the results as JSON in states for each filter as configured in the settings.
Resulting JSON can then be used in VIS for visualization. States for emptying (clearing) old logs are provided as well (like `logparser.0.filters.Homematic.emptyJson` or `logparser.0.emptyAllJson` to empty all.)

![States](docs/en/img/states.png)

## Installation

Just install the adapter regularly through the ioBroker admin interface. The adapter is both in the latest and stable repository.

## Instructions

I have included all instructions right in the admin settings of this adapter.

Also, you can read most of these instructions here as well:

-   [**Basic Adapter Instructions**](https://github.com/iobroker-community-adapters/ioBroker.logparser/blob/master/admin/doc-md/start_en.md) - for German [click here (Deutsch)](https://github.com/iobroker-community-adapters/ioBroker.logparser/blob/master/admin/doc-md/start_de.md)
-   [**Parser Rules (Filters)**](https://github.com/iobroker-community-adapters/ioBroker.logparser/blob/master/admin/doc-md/table-parser-rules_en.md) - for German [click here (Deutsch)](https://github.com/iobroker-community-adapters/ioBroker.logparser/blob/master/admin/doc-md/table-parser-rules_de.md)
-   [**Global Blacklist**](https://github.com/iobroker-community-adapters/ioBroker.logparser/blob/master/admin/doc-md/table-global-blacklist_en.md) - for German [click here (Deutsch)](https://github.com/iobroker-community-adapters/ioBroker.logparser/blob/master/admin/doc-md/table-global-blacklist_de.md)

## Visualization Example (animated gif)

![Vis](docs/de/img/visintro.gif)

## Screenshots of adapter options

Please note that these screenshots are a snapshot and do not reflect the latest adapter options.
This is just to provide you an overview of the adapter options.

-   Will be add later

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
### 2.3.0 (2025-03-02)

- (mcm1957) Adapter requires node.js 20, js-controller 5 and admin 6 now.
- (mcm1957) Missing dependencies for node-schedule has been added.
- (simatec) Admin-UI has been adapted for small displays.
- (mcm1957) Dependencies have been updated.

### 2.2.2 (2024-01-20)

-   (ciddi89) Fixed: missing space in one entry of global blacklist [#145](https://github.com/iobroker-community-adapters/ioBroker.logparser/issues/145)

### 2.2.1 (2023-12-22)

-   (ciddi89) Fixed: Visualization tables was not working correctly [#97](https://github.com/iobroker-community-adapters/ioBroker.logparser/issues/97)
-   (ciddi89) Updated: Dependencies

### 2.2.0 (2023-05-28)

-   (ciddi89) Dropped: Node v14.x support and added: Node v20.x support
-   (ciddi89) Added: Option to empty log for each parser rule.

### 2.1.3 (2023-05-19)

-   (ciddi89) Updated: Dependencies

## License

MIT License

Copyright (c) 2025 iobroker-community-adapters <iobroker-community-adapters@gmx.de>  
Copyright (c) 2020 - 2024 Mic-M, McM1957 <mcm57@gmx.at>, ciddi89 <mail@christian-behrends.de>, ioBroker Community Developers

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
