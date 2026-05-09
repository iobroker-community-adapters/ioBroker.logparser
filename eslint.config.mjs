// ioBroker eslint template configuration file for js and ts files
// Please note that esm or react based modules need additional modules loaded.
import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        // specify files to exclude from linting here
        ignores: [
            '.dev-server/',
            '.vscode/',
            '*.test.js',
            'test/**/*.js',
            '*.config.mjs',
            'build',
            'dist',
            'admin/build', 
            'admin/words.js',
            'admin/admin.d.ts',
            'admin/blockly.js',
            '**/adapter-config.d.ts',
            'accessories/alexa-history.js',
        ],
    },
    {
        // you may disable some 'jsdoc' warnings - but using jsdoc is highly recommended
        // as this improves maintainability. jsdoc warnings will not block buiuld process.
        rules: {
            'jsdoc/check-alignment': 'off',
            'jsdoc/check-tag-names': 'off',
            'jsdoc/check-types': 'off',
            'jsdoc/no-defaults': 'off',
            'jsdoc/no-multi-asterisks': 'off',
            'jsdoc/reject-any-type': 'off',
            'jsdoc/require-param-description': 'off',
            'jsdoc/tag-lines': 'off',
        },
    },
];
