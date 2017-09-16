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
    },
};