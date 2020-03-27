# apify-login-session

Get localStorage, sessionStorage and cookies from logins for usage in other actors.

## Usage

This actor can help you (re)use logged in sessions for your website and serivces, abstracting away the need for developing your own login mechanism. It uses a named session storage, so you when you request a new session, it will be readily available. It's tailored to work seamlessly on Apify platform and other actors.

It's more low-level than other actors, but it tries to cover the most common use cases like:

* Single Page Applications
* Server Side Rendered websites
* Ajax login calls
* Multi step logins such as username on one page, password on another

You may call directly from your actor, or use the `INPUT.json` to create a task or scheduled to keep seeding your session storage with new sessions. It cannot deal with 2FA or captchas (yet).

```js
// in your actor
const storageName = 'session-example';

const { session, error } = await Apify.call('pocesar/login-session', {
    username: 'username',
    password: 'password',
    website: [{ url: 'http://example.com' }], // the RequestList format
    cookieDomains: [
        "http://example.com"
    ],
    sessionConfig: {
        storageName,
        maxAgeSecs: 3600,
        maxUsageCount: 10,
        maxPoolSize: 120
    },
    steps: [{
        username: {
            selector: "input#email", // the input that receives the username
            timeoutMillis: 10000 // optional timeout in ms
        },
        password: {
            selector: "input#pass" // the input that receives the password
        },
        submit: {
            selector: "input[type=\"submit\"]", // the button that executes the login
        },
        failed: {
            selector: "[role=\"alert\"],#captcha", // usually an error that tells the login failed
            timeoutMillis: 10000 // optional timeout in ms
        },
        waitForMillis: 15000 // optional "sleep" in ms to consider the page as "settled"
    }]
});

// load the session pool from the storage, so it has our new
// session. this might change in the future
const sessionPool = await Apify.openSessionPool({
    persistStateKeyValueStoreId: storageName
});

const sessionJustCreated = sessionPool.sessions.find(s => s.id === session.id);

/**
 * the complete Cookie string for usage on the header
 */
sessionJustCreated.getCookieString('http://example.com');

/**
 * contains the User-Agent used for the login request.
 * the same userAgent must be set between uses so there's no
 * conflict and blocks. Set this as your User-Agent header
 **/
sessionJustCreated.userData.userAgent;

/**
 * the proxyUrl used, can be empty.
 * Set this as your proxyUrl parameter in crawlers
 */
sessionJustCreated.userData.proxyUrl;

/**
 * object containing any sessionStorage content, useful for JWT tokens.
 * Useful for using in PuppeteerCrawler
 */
sessionJustCreated.userData.sessionStorage;

/**
 * object containing any localStorage content, useful for JWT
 * tokens. Useful for using in PuppeteerCrawler
 */
sessionJustCreated.userData.localStorage;

```

## Input Recipes

Here are some real-life examples of INPUT.json that you may use:

### Gmail

```json
{
    "username": "username",
    "password": "password",
    "website": [{ "url": "https://accounts.google.com/signin/v2/identifier?service=mail&passive=true&flowName=GlifWebSignIn&flowEntry=ServiceLogin" }],
    "cookieDomains": [
        "https://mail.google.com",
        "https://accounts.google.com",
        "https://google.com"
    ],
    "steps": [{
        "username": {
            "selector": "#identifierId"
        },
        "submit": {
            "selector": "#identifierNext"
        },
        "success": {
            "selector": "input[type=\"password\"]",
            "timeoutMillis": 10000
        },
        "failed": {
            "selector": "#identifierId[aria-invalid=\"true\"],iframe[src*=\"CheckConnection\"]"
        },
        "waitForMillis": 30000
    }, {
        "password": {
            "selector": "input[type=\"password\"]"
        },
        "submit": {
            "selector": "#passwordNext",
            "timeoutMillis": 15000
        },
        "failed": {
            "selector": "input[type=\"password\"][aria-invalid=\"true\"],iframe[src*=\"CheckConnection\"]",
            "timeoutMillis": 5000
        },
        "success": {
            "selector": "link[href*=\"mail.google.com\"]",
            "timeoutMillis": 10000
        },
        "waitForMillis": 30000
    }]
}
```

### Facebook

```json
{
    "username": "username",
    "password": "password",
    "website": [{ "url": "https://www.facebook.com/" }],
    "cookieDomains": [
        "https://facebook.com"
    ],
    "steps": [{
        "username": {
            "selector": "#login_form [type=\"email\"]"
        },
        "password": {
            "selector": "#login_form [type=\"password\"]"
        },
        "submit": {
            "selector": "#login_form [type=\"submit\"]"
        },
        "success": {
            "selector": "body.home",
            "timeoutMillis": 10000
        },
        "failed": {
            "selector": "body.login_page,body.UIPage_LoggedOut",
            "timeoutMillis": 10000
        },
        "waitForMillis": 30000
    }]
}
```

### Twitter

```json
{
    "username": "username",
    "password": "password",
    "website": [{ "url": "https://twitter.com/login" }],
    "cookieDomains": [
        "https://twitter.com"
    ],
    "steps": [{
        "username": {
            "selector": "h1 ~ form [name=\"session[username_or_email]\"]",
            "timeoutMillis": 2000
        },
        "password": {
            "selector": "h1 ~ form [name=\"session[password]\"]",
            "timeoutMillis": 2000
        },
        "submit": {
            "selector": "h1 ~ form [role=\"button\"][data-focusable]"
        },
        "success": {
            "selector": "h2[role=\"heading\"]",
            "timeoutMillis": 10000
        },
        "failed": {
            "selector": "h1 ~ form [role=\"button\"][disabled]",
            "timeoutMillis": 10000
        },
        "waitForMillis": 30000
    }]
}
```

## Related Content

* [Log in to website by transferring cookies from web browser (legacy)](https://help.apify.com/en/articles/1444249-log-in-to-website-by-transferring-cookies-from-web-browser-legacy)
* [How to log in to a website using Puppeteer](https://help.apify.com/en/articles/1640711-how-to-log-in-to-a-website-using-puppeteer)
* [Session Management](https://sdk.apify.com/docs/guides/session-management)

## Caveats

* Apify proxy sessions can last at most 24h, so never set your `maxAgeSecs` greater than this number
* If the proxy fails, the login fails. If the proxy is banned, the login fails.

## License

Apache 2.0
