module.exports = {
    root: true,
    env: {
        browser: true,
        es2020: true
    },
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'react-refresh'],
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    ignorePatterns: ['dist', 'node_modules'],
    rules: {
        'react-refresh/only-export-components': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': [
            'error',
            { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
        ]
    }
};
