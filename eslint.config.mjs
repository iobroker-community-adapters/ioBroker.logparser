import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        ignores: [
            '.dev-server/',
            'admin/*.min.js',
            'admin/words.js',
            '**/*.d.ts',
        ],
    },
    {
        files: [
            'accessories/alexa-history.js',
        ],
        languageOptions: {
            globals: {
                log: 'readonly',
                on: 'readonly',
            },
        },
    },
    {
        files: [
            '*.test.js',
            'test/**/*.js',
        ],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
            },
        },
    },
    {
        rules: {
            // Keep legacy adapter code style for now; avoid broad behavior-neutral rewrites in this migration PR.
            curly: 'off',
            // Existing JSDoc blocks are legacy-formatted; keep checks disabled until docs are refactored.
            'jsdoc/check-alignment': 'off',
            'jsdoc/check-tag-names': 'off',
            'jsdoc/check-types': 'off',
            'jsdoc/no-defaults': 'off',
            'jsdoc/no-multi-asterisks': 'off',
            'jsdoc/reject-any-type': 'off',
            'jsdoc/require-param-description': 'off',
            'jsdoc/tag-lines': 'off',
            'no-else-return': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            // Keep existing string-concat and formatting style; migration goal is shared base adoption.
            'prefer-template': 'off',
            'prettier/prettier': 'off',
        },
    },
];
