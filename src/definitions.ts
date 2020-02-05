export interface Schema {
    username: string;
    password: string;
    website: Array<{
        url: string;
        method?: string;
    }>;
    sessionStorage: {
        storageName: string;
        maxAgeSecs: number;
        maxUsageCount: number;
        maxPoolSize: number;
    };
    /** CSS selectors. Work with */
    steps: Array<{
        /** Selector for the username input */
        username?: string;
        /** Selector for the password input */
        password?: string;
        /** Selector for the submit button on the login form */
        submit?: string;
        /** Element that should be on the page upon success */
        success?: string;
        /** Element that is usually on the page when it fails */
        failed?: string;
    }>;
    proxyConfiguration?: {
        proxyUrls?: string[];
        useApifyProxy?: boolean;
        apifyProxyGroups?: string[];
    };
}

export interface SessionUserData {
    proxyUrl: string;
    sessionStorage: { [index: string]: string };
    localStorage: { [index: string]: string };
    headers: { [index: string]: string };
}
