# Older Changelogs
## 2.1.3 (2023-05-19)

-   (ciddi89) Updated: Dependencies

## 2.1.2 (2023-04-07)

-   (ciddi89) Fixed: Visualization tables was not working correctly
-   (ciddi89) Fixed: Issue if no dateformat was selected correctly

## 2.1.1 (2023-04-05)

-   (ciddi89) Fixed: [#25](https://github.com/iobroker-community-adapters/ioBroker.logparser/issues/25) Missing CSS class in date if it's older than today
-   (ciddi89) Changed: Moved Dateformat option from table to other settings
-   (ciddi89) Updated: Dependencies

## 2.1.0 (2023-03-05)

-   (ciddi89) Added: [#24](https://github.com/iobroker-community-adapters/ioBroker.logparser/issues/24) Option to remove 'COMPACT' in log entries
-   (ciddi89) Added: [#21](https://github.com/iobroker-community-adapters/ioBroker.logparser/issues/21) Option to remove only 'script.js' in log entries
-   (ciddi89) Fixed: [#46](https://github.com/iobroker-community-adapters/ioBroker.logparser/issues/46) Midnight function to change today/yesterday
-   (ciddi89) Fixed: [#23](https://github.com/iobroker-community-adapters/ioBroker.logparser/issues/23) When nothing selected in blacklist, adapter didn't work anymore
-   (ciddi89) Other: Small code and translation improvements

## 2.0.0 (2023-03-02)

-   (ciddi89) Dropped: Admin 5 support
-   (ciddi89) Changed: Admin html to jsonConfig [#36](https://github.com/iobroker-community-adapters/ioBroker.logparser/issues/36)
-   (ciddi89) Fixed: Issue with Midnight function
-   (ciddi89) Added: Translations of admin ui [#28](https://github.com/iobroker-community-adapters/ioBroker.logparser/issues/28)
-   (ciddi89) Updated: Readme

## 1.2.3 (2023-02-25)

-   (ciddi89) Fixed: Alexa-History script
-   (ciddi89) Fixed: adjusted links in admin/docs to new repo
-   (ciddi89) Rebuilded main.js

## 1.2.2 (2023-02-23)

-   (McM1957) sentry integration has been fixed

## 1.2.1 (2023-02-23)

-   (McM1957) Adapter has been moved to iobroker-community-adapters

## 1.1.0

-   (Mic-M) Fixed issue [#15](https://github.com/Mic-M/ioBroker.logparser/issues/15) regarding regex for tab "Parser Rules", column "Blacklist"
-   (Mic-M) Enhancement [#16](https://github.com/Mic-M/ioBroker.logparser/issues/16) - add specific CSS classes to any element of the JSON log per adapter option.
-   (Mic-M) Major improvement: Implemented entire documentation into adapter itself to significantly improve usability.
-   (Mic-M) A few improvements under the hood.

## 1.0.4

-   (Mic-M) Fixed 'Today/Yesterday' updating issue - https://forum.iobroker.net/post/469757. Thanks to (Kuddel) for reporting and (Glasfaser) for further debugging.

## 1.0.3

-   (Mic-M) Added [Sentry](https://github.com/ioBroker/plugin-sentry)

## 1.0.2

-   (Mic-M) Added debug logging for callAtMidnight() and updateTodayYesterday()

## 1.0.1

-   (Mic-M) Updated lodash dependency from 4.17.15 to 4.17.19

## 1.0.0

-   (Mic-M) No changes - just prepare versioning to add adapter to stable repository per [Adapter dev docu](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterdev.md#versioning)