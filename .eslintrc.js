module.exports = {
    "extends": "airbnb-base",
    "env": {
        "browser": true,
        "node": true
    },
    "rules": {
        "prefer-destructuring": 0,
        "arrow-parens": [2, "as-needed"],
        "no-param-reassign": [2, { props: false }],
        "class-methods-use-this": 0,
        "no-restricted-syntax": 0,
        "guard-for-in": 0,
        "no-await-in-loop": 0,
        "no-console": 0,
    },
};