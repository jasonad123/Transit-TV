module.exports = {
  "env": {
    "browser": true,
    "node": true,
    "es6": true
  },
  "globals": {
    "angular": true,
    "moment": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": 2018
  },
  "rules": {
    "indent": [
      "error",
      2,
      { "SwitchCase": 1 }
    ],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "single"
    ],
    "semi": [
      "error",
      "always"
    ],
    "no-console": [
      "warn",
      { "allow": ["warn", "error"] }
    ],
    "no-unused-vars": [
      "warn",
      { "vars": "all", "args": "after-used", "ignoreRestSiblings": false }
    ],
    "curly": ["error", "all"],
    "eqeqeq": ["error", "always"],
    "no-multi-spaces": "error",
    "no-trailing-spaces": "error",
    "no-var": "warn",
    "prefer-const": "warn",
    "no-undef": "error",
    "no-use-before-define": ["error", { "functions": false }],
    "camelcase": ["error", { "properties": "never" }],
    "max-len": ["warn", { "code": 100, "ignoreComments": true, "ignoreUrls": true }],
    "no-multiple-empty-lines": ["error", { "max": 2, "maxEOF": 1 }],
    "no-duplicate-imports": "error",
    "no-template-curly-in-string": "error",
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-param-reassign": "warn",
    "no-return-assign": "error",
    "no-self-compare": "error",
    "no-throw-literal": "error",
    "no-useless-concat": "error",
    "prefer-promise-reject-errors": "error",
    "radix": "error",
    "no-shadow": "warn",
    "no-shadow-restricted-names": "error",
    "no-useless-return": "error",
    "no-with": "error",
    "no-useless-escape": "warn",
    "no-mixed-spaces-and-tabs": "error",
    "no-lonely-if": "warn",
    "no-unneeded-ternary": "error",
    "no-whitespace-before-property": "error",
    "object-curly-spacing": ["error", "always"],
    "space-before-blocks": "error",
    "space-before-function-paren": ["error", {
      "anonymous": "always",
      "named": "never",
      "asyncArrow": "always"
    }],
    "space-in-parens": ["error", "never"],
    "space-infix-ops": "error",
    "arrow-spacing": "error",
    "no-confusing-arrow": "error",
    "no-useless-computed-key": "error",
    "no-useless-rename": "error",
    "no-var": "warn",
    "prefer-const": "warn",
    "prefer-rest-params": "warn",
    "prefer-spread": "warn",
    "rest-spread-spacing": ["error", "never"],
    "template-curly-spacing": "error"
  }
};
