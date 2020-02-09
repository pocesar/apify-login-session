# apify-login-session

Grab a session for any website for usage on your own actor, and store them in your account for stickyness

## Usage

This actor can help you (re)use logged in sessions for your website, abstracting away the need for developing your own login mechanism. It uses a named storage, so you can request a new session and it will be readily available to all your other actors, as it's tailored to work seamlessly on Apify platform and other actors.

It's more low-level than other actors, but it tries to cover the most common use cases like:

* Single Page Applications
* Server Side Rendered websites
* Ajax login calls
* Multi step logins such as username on one page, password on another

You may call directly from your actor, create a task or execute in a scheduled manner to keep seeding your session storage with new sessions. It cannot deal with 2FA or captchas (yet).

```js
// in your actor
const storageName = 'session-example';

const { session, error } = await Apify.call('pocesar/login-session', {
    username: 'username',
    password: 'password',
    website: [{ url: 'http://example.com' }], // the RequestList format
    sessionConfig: {
        storageName
    },
    steps: [{
        username: {
            selector: "input#email", // the input that receives the username
            timeout: 10000 // optional timeout in ms
        },
        password: {
            selector: "input#pass" // the input that receives the password
        },
        submit: {
            selector: "input[type=\"submit\"]", // the button that executes the login
        },
        failed: {
            selector: "[role=\"alert\"],#captcha", // usually an error that tells the login failed
            timeout: 10000 // optional timeout in ms
        },
        waitFor: 15000 // optional "sleep" in ms to consider the page as "settled"
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
 * contains the User-Agent used for the login request
 **/
sessionJustCreated.userData.headers;

/**
 * the proxyUrl used
 */
sessionJustCreated.userData.proxyUrl;

/**
 * any sessionStorage content
 */
sessionJustCreated.userData.sessionStorage;

/**
 * any localStorage content
 */
sessionJustCreated.userData.localStorage;

```

## License

Apache 2.0
