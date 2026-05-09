import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        ignores: [
            '.dev-server/',
            'admin/*.min.js',
            'admin/words.js',
            'admin/admin.d.ts',
        ],
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
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/consistent-type-imports': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            curly: 'off',
            'jsdoc/check-alignment': 'off',
            'jsdoc/check-tag-names': 'off',
            'jsdoc/check-types': 'off',
            'jsdoc/no-defaults': 'off',
            'jsdoc/no-multi-asterisks': 'off',
            'jsdoc/reject-any-type': 'off',
            'jsdoc/require-param-description': 'off',
            'jsdoc/tag-lines': 'off',
            'no-else-return': 'off',
            'no-undef': 'warn',
            'no-unused-vars': 'off',
            'no-var': 'warn',
            'prefer-template': 'off',
            'prettier/prettier': 'off',
        },
    },
];
