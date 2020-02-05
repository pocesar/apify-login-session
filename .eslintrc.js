module.exports = {
    extends: [
        'plugin:@typescript-eslint/recommended',
        '@apify',
        "prettier",
        "prettier/@typescript-eslint",
    ],
    env: {
        node: true,
        es6: true
    },
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: "module",
        ecmaFeatures: {
            modules: true
        },
        project: "./tsconfig.json"
    },
    plugins: [
        '@typescript-eslint',
        "prettier",
    ],
    ignorePatterns: ["*.test.ts"],
    rules: {
        "prettier/prettier": 2,
        "quotes": 0,
        "import/extensions": 0,
        "@typescript-eslint/no-floating-promises": 2,
        '@typescript-eslint/no-unused-vars': [2, { args: 'none' }],
        "@typescript-eslint/semicolon": 0,
        "@typescript-eslint/no-implicit-dependencies": 0,
        "@typescript-eslint/ordered-imports": 0,
        "@typescript-eslint/object-literal-sort-keys": 0,
        "@typescript-eslint/no-submodule-imports": 0,
        "@typescript-eslint/no-unused-expression": 0,
        "@typescript-eslint/trailing-comma": 0,
        "@typescript-eslint/interface-name": 0,
        "@typescript-eslint/no-string-literal": 0,
        "@typescript-eslint/explicit-function-return-type": 0,
        "@typescript-eslint/no-explicit-any": 0,
        "@typescript-eslint/no-non-null-assertion": 0
    },
}
