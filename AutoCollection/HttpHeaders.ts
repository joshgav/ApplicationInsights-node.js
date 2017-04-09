export = {
    RequestContext: {
        // value of this header is a dict of form key=value,key=value
        // refs for key names are of form NameKey
        HeaderName: 'Request-Context',
        AppIdKey: 'appId'
    },
    RemoteDependency: {
        myIkey: 'x-ms-request-source-ikey',
        theirIkey: 'x-ms-request-target-ikey'
    },
    Request: {
        myIkey: 'x-ms-request-target-ikey',
        theirIkey: 'x-ms-request-source-ikey',
        parentId: 'x-ms-request-id',
        rootId: 'x-ms-request-root-id'
    }
}

