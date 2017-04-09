import http = require('http');
import url  = require('url');

import ContractsModule = require('../Library/Contracts');
import Client = require('../Library/Client');
import Logging = require('../Library/Logging');
import Util = require('../Library/Util');
import HttpHeaders = require('./HttpHeaders');
import HttpRequestContextHelpers = require('./HttpRequestContextHelpers');
import AIRequest = require('./AIRequest');

class HttpAIRequest extends AIRequest {
    private static Keys = new ContractsModule.Contracts.ContextTagKeys();

    private _method: string;
    private _url: string;
    private _headers: object;
    private _socketRemoteAddress: string;
    private _userAgent: string;
    private _statusCode: number;

    public get url () : string {
        return this._url;
    }

    constructor(client: Client, request: http.IncomingMessage, requestId?: string) {
        super(client, requestId);
        if (request) {
            this._method = request.method;
            this._url = this._getAbsoluteUrl(request);
            this._headers = request.headers;
            this._socketRemoteAddress = request.socket.remoteAddress;
            this._userAgent = request.headers["user-agent"];

            // from AIRequest
            this._theirAppId = HttpRequestContextHelpers.getRequestContext(request)[HttpHeaders.RequestContext.AppIdKey] || '';
            this._parentId = request.headers[HttpHeaders.Request.parentId];
            this._operationId = request.headers[HttpHeaders.Request.rootId];
        }
    }

    public onError(error: Error | string, properties?: {[key: string]: string}) {
        this._setStatus(undefined, error, properties);
    }

    public onResponse(response: http.ServerResponse, properties?: {[key: string]: string}) {
        this._setStatus(response, undefined, properties);
        HttpRequestContextHelpers.setRequestContext(response, {
            [HttpHeaders.RequestContext.AppIdKey]: this.appId
        });
    }

    protected _getRequestData(): ContractsModule.Contracts.Data<ContractsModule.Contracts.RequestData> {
        var requestData = new ContractsModule.Contracts.RequestData();
        requestData.id = this._requestId;
        requestData.name = this._method + " " + url.parse(this._url).pathname;
        requestData.url = this._url;
        requestData.source = this._theirAppId;
        requestData.duration = Util.msToTimeSpan(this._duration);
        requestData.responseCode = this._statusCode ? this._statusCode.toString() : null;
        requestData.success = this.isSuccess;
        requestData.properties = this._properties;

        var data = new ContractsModule.Contracts.Data<ContractsModule.Contracts.RequestData>();
        data.baseType = "Microsoft.ApplicationInsights.RequestData";
        data.baseData = requestData;

        return data;
    }

    public getRequestTags(tags: {[key: string]:string}): {[key: string]:string} {
        // create a copy of the context for requests since client info will be used here
        var newTags = <{[key: string]:string}>{};
        for (var key in tags) {
            newTags[key] = tags[key];
        }

        // don't override tags if they are already set
        let Keys = HttpAIRequest.Keys;
        newTags[Keys.locationIp]        = tags[Keys.locationIp] || this._getIp();
        newTags[Keys.sessionId]         = tags[Keys.sessionId] || this._getId("ai_session");
        newTags[Keys.userId]            = tags[Keys.userId] || this._getId("ai_user");
        newTags[Keys.userAgent]         = tags[Keys.userAgent] || this._userAgent;
        newTags[Keys.operationName]     = tags[Keys.operationName] || this._method + " " + url.parse(this._url).pathname;
        newTags[Keys.operationParentId] = tags[Keys.operationParentId] || this._parentId || tags[Keys.operationId] || this._operationId;
        newTags[Keys.operationId]       = tags[Keys.operationId] || this._operationId;

        return newTags;
    }


	public getOperationId(tags:{[key: string]:string}) {
        return tags[HttpAIRequest.Keys.operationId] || this._operationId;
    }

    public getOperationParentId(tags:{[key: string]:string}) {
        return tags[HttpAIRequest.Keys.operationParentId] || this._parentId || this.getOperationId(tags);
    }

    public getOperationName(tags:{[key: string]:string}) {
        return tags[HttpAIRequest.Keys.operationName] || this._method + " " + url.parse(this._url).pathname;
    }

    private _getAbsoluteUrl(request: http.IncomingMessage): string {
        if (!request.headers) {
            return request.url;
        }

        var encrypted = <any>request.socket['encrypted'] || false;
        var requestUrl = url.parse(request.url);

        var pathName = requestUrl.pathname;
        var search = requestUrl.search;

        var absoluteUrl = url.format({
            protocol: encrypted ? "https" : "http",
            host: request.headers.host,
            pathname: pathName,
            search: search
        });

        return absoluteUrl;
    }

    private _getIp() {

        // regex to match ipv4 without port
        // Note: including the port would cause the payload to be rejected by the data collector
        var ipMatch = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;

        function check (input: string): string {
            var results = ipMatch.exec(input);
            if (results) {
                return results[0];
            }
        };

        var ip = check(this._headers["x-forwarded-for"])
              || check(this._headers["x-client-ip"])
              || check(this._headers["x-real-ip"])
              || check(this._socketRemoteAddress)

        // node v12 returns this if the address is "localhost"
        if (!ip
          && (<any>this)._connectionRemoteAddress
          && (<any>this)._connectionRemoteAddress.substr
          && (<any>this)._connectionRemoteAddress.substr(0, 2) === "::") {
            ip = "127.0.0.1";
        }

        return ip;
    }

    private _getId(name: string) {
        var cookie = (this._headers && this._headers["cookie"] &&
            typeof this._headers["cookie"] === 'string' && this._headers["cookie"]) || "";
        var value = HttpAIRequest.parseId(Util.getCookie(name, cookie));
        return value;
    }

    public static parseId(cookieValue: string): string{
        return cookieValue.substr(0, cookieValue.indexOf('|'));
    }


    protected _setStatus(response: http.ServerResponse, error: Error | string, properties: { [key: string]: string }) {
        this._duration = +new Date() - this._startTime;
        this._statusCode = response.statusCode || 500;
        this._properties = properties || <{ [key: string]: string }>{};
        
        if (error) {
            if (typeof error === "string") {
                this.properties["error"] = error;
            } else if (error instanceof Error) {
                this.properties["error"] = error.message;
            } else if (typeof error === "object") {
                for (const key in <any>error) {
                    this.properties[key] = error[key] && error[key].toString && error[key].toString();
                }
            }
        }
    }

    protected get isSuccess () : boolean {
        return (0 < this._statusCode) && (this._statusCode < 400);
    }
}

export = HttpAIRequest;
