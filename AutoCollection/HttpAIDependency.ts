import http = require('http');
import https = require('https');
import url = require('url');
import assert = require('assert');

import ContractsModule = require('../Library/Contracts');
import Client = require('../Library/Client');
import Logging = require('../Library/Logging');
import Util = require('../Library/Util');
import HttpHeaders = require('./HttpHeaders');
import HttpRequestContextHelpers = require('./HttpRequestContextHelpers');
import AIDependency = require('./AIDependency');

class HttpAIDependency extends AIDependency {

    private _method: string;
    private _url: string;
    private _statusCode: number;

    get statusCode () : number {
        return this._statusCode;
    }

    set statusCode (value: number) {
        this._statusCode = value;
    }

    public get url () : string {
        return this._url;
    }

    constructor (client: Client,
                 requestOptions: string | http.RequestOptions | https.RequestOptions,
                 request: http.ClientRequest ) {

        super(client);

        if (request && (<any>request).method) {
            // The ClientRequest.method property isn't documented, but is always there.
            this._method = (<any>request).method;
        }
        this._url = HttpAIDependency._getUrlFromRequestOptions(requestOptions, request);
    }


    get isSuccess () : boolean {
        return (0 < this.statusCode) && (this.statusCode < 400);
    }

    /**
     * Called if/when the outgoing request object emits an error event.
     */
    public onError(error: Error, properties?: { [key: string]: string }) {
        if (properties) { this._properties = properties; }
        this._duration = +new Date() - this._startTime;
        if (typeof error === "string") {
            this.properties["error"] = error;
        } else if (error instanceof Error) {
            this.properties["error"] = error.message;
        } else if (typeof error === "object") {
            for (var key in <any>error) {
                this.properties[key] = error[key] && error[key].toString && error[key].toString();
            }
        }
    }

    /**
     * Called when the outgoing request object emits a response event.
     */
    public onResponse(response: http.IncomingMessage, properties?: { [key: string]: string }) {
        if (properties) { this._properties = properties; }
        this._statusCode = response.statusCode;
        this._duration = +new Date() - this._startTime;
        this._theirAppId = HttpRequestContextHelpers.getRequestContext(response)[HttpHeaders.RequestContext.AppIdKey] || '';
    }
    

    /**
     * Gets a RemoteDependencyData contract object for a completed outgoing request.
     */
    protected _getDependencyData(): ContractsModule.Contracts.Data<ContractsModule.Contracts.RemoteDependencyData> {
        let urlObject = url.parse(this._url);
        urlObject.search = undefined;
        urlObject.hash = undefined;
        let dependencyName = this._method.toUpperCase() + " " + urlObject.pathname;

        let remoteDependency = new ContractsModule.Contracts.RemoteDependencyData();
        remoteDependency.type = ContractsModule.Contracts.RemoteDependencyDataConstants.TYPE_HTTP;

        // TODO: verify same usage in dotnet
        if (this._theirAppId) {
            remoteDependency.type = "Http (tracked component)";
            remoteDependency.target = urlObject.hostname + " | " + this._theirAppId;
        } else {
            remoteDependency.target = urlObject.hostname;
        }

        remoteDependency.name = dependencyName;
        remoteDependency.data = this._url;
        remoteDependency.duration = Util.msToTimeSpan(this._duration);
        remoteDependency.success = this.isSuccess;
        remoteDependency.resultCode = this._statusCode ? this._statusCode.toString() : null;
        remoteDependency.properties = this._properties || {};

        let data = new ContractsModule.Contracts.Data<ContractsModule.Contracts.RemoteDependencyData>();
        data.baseType = "Microsoft.ApplicationInsights.RemoteDependencyData";
        data.baseData = remoteDependency;

        return data;
    }

    /**
     * Builds a URL from request options, using the same logic as http.request(). This is
     * necessary because a IncomingMessage object does not expose a url property.
     */
    static _getUrlFromRequestOptions(requestOptions: string | http.RequestOptions | https.RequestOptions, request: http.ClientRequest) {
        var options = null;
        if (typeof requestOptions === 'string') {
            options = url.parse(requestOptions);
        } else {
            options = {};
            Object.keys(requestOptions).forEach(key => {
                options[key] = requestOptions[key];
            });
        }
        assert(options !== null);

        // Oddly, url.format ignores path and only uses pathname and search,
        // so create them from the path, if path was specified
        if (options.path) {
            const parsedQuery = url.parse(options.path);
            options.pathname = parsedQuery.pathname;
            options.search = parsedQuery.search;
        }

        // Simiarly, url.format ignores hostname and port if host is specified,
        // even if host doesn't have the port, but http.request does not work
        // this way. It will use the port if one is not specified in host,
        // effectively treating host as hostname, but will use the port specified
        // in host if it exists.
        if (options.host && options.port) {
            // Force a protocol so it will parse the host as the host, not path.
            // It is discarded and not used, so it doesn't matter if it doesn't match
            const parsedHost = url.parse(`http://${options.host}`);
            if (!parsedHost.port && options.port) {
                options.hostname = options.host;
                delete options.host;
            }
        }

        // Mix in default values used by http.request and others
        options.protocol = options.protocol || (<any>request).agent && (<any>request).agent.protocol;
        options.hostname = options.hostname || 'localhost';

        return url.format(options);
    }
}

export = HttpAIDependency;
