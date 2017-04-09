import http = require("http");
import assert = require("assert");
import sinon = require("sinon");

import HttpAIDependency = require("../../AutoCollection/HttpAIDependency");
import ContractsModule = require("../../Library/Contracts");
import Client = require("../../Library/Client");

describe("AutoCollection/HttpAIDependency", () => {

    describe("#constructor", function () {

        let mockClientRequest: http.ClientRequest = <any>{
            agent: { protocol: "http" },
        };

        let mockIncomingMessage: http.IncomingMessage = <any>{
            method: "GET",
            url: "/search?q=test",
            socket: {
                encrypted: false
            },
            headers: {
                host: "bing.com"
            }
        }

        let mockClient: Client = <any>{
            config: {
                appId: "ourAppId"
            }
        }

        it("should set theirAppId from incoming Request-Context header", function () {
            const tester = new HttpAIDependency(<any>mockClient, "http://bing.com/search", <any>mockClientRequest);
            mockIncomingMessage.headers["Request-Context"] = "appId=testApp";
            tester.onResponse(mockIncomingMessage);
            assert.equal(tester.theirAppId, 'testApp');
            assert.equal(tester.appId, 'ourAppId');
        });

        it("should set theirAppId to empty string if not specified", function () {
            const tester = new HttpAIDependency(<any>mockClient, "http://bing.com/search", <any>mockClientRequest);
            mockIncomingMessage.headers["Request-Context"] = "";
            tester.onResponse(mockIncomingMessage);
            assert.equal(tester.theirAppId, '');
            assert.equal(tester.appId, 'ourAppId');
        });

        it("should set appId to our AppId if a client is provided", function () {
            let tester = new HttpAIDependency(<any>mockClient, "http://bing.com/search", <any>mockClientRequest);
            assert.equal(tester.appId, 'ourAppId');
        });

    });

    describe("#getDependencyData()", () => {
        let request: http.ClientRequest = <any>{
            agent: { protocol: "http" },
        };
        let response: http.IncomingMessage = <any>{
        };

        it("should return correct data for a URL string", () => {
            request["method"] = "GET";
            let parser = new HttpAIDependency(new Client("mock"), "http://bing.com/search", request);

            response.statusCode = 200;
            parser.onResponse(response);

            let dependencyData = parser.getDependencyData().baseData;
            assert.equal(dependencyData.type, ContractsModule.Contracts.RemoteDependencyDataConstants.TYPE_HTTP);
            assert.equal(dependencyData.success, true);
            assert.equal(dependencyData.name, "GET /search");
            assert.equal(dependencyData.data, "http://bing.com/search");
            assert.equal(dependencyData.target, "bing.com");
        });

        it("should return correct data for a posted URL with query string", () => {
            request["method"] = "POST";
            let parser = new HttpAIDependency(new Client("mock"), "http://bing.com/search?q=test", request);

            response.statusCode = 200;
            parser.onResponse(response);

            let dependencyData = parser.getDependencyData().baseData;
            assert.equal(dependencyData.type, ContractsModule.Contracts.RemoteDependencyDataConstants.TYPE_HTTP);
            assert.equal(dependencyData.success, true);
            assert.equal(dependencyData.name, "POST /search");
            assert.equal(dependencyData.data, "http://bing.com/search?q=test");
            assert.equal(dependencyData.target, "bing.com");
        });

        it("should return correct data for a request options object", () => {
            let requestOptions = {
                host: "bing.com",
                port: 8000,
                path: "/search?q=test",
            };
            request["method"] = "POST";
            let parser = new HttpAIDependency(new Client("mock"), requestOptions, request);

            response.statusCode = 200;
            parser.onResponse(response);

            let dependencyData = parser.getDependencyData().baseData;
            assert.equal(dependencyData.type, ContractsModule.Contracts.RemoteDependencyDataConstants.TYPE_HTTP);
            assert.equal(dependencyData.success, true);
            assert.equal(dependencyData.name, "POST /search");
            assert.equal(dependencyData.data, "http://bing.com:8000/search?q=test");
            assert.equal(dependencyData.target, "bing.com");
        });

        it("should return correct data for a request options object", () => {
            var path = "/finance/info?client=ig&q=";

            let requestOptions = {
                host: "finance.google.com",
                path: path + "msft"
            };
            request["method"] = "GET";
            let parser = new HttpAIDependency(new Client("mock"), requestOptions, request);

            response.statusCode = 200;
            parser.onResponse(response);

            let dependencyData = parser.getDependencyData().baseData;
            assert.equal(dependencyData.type, ContractsModule.Contracts.RemoteDependencyDataConstants.TYPE_HTTP);
            assert.equal(dependencyData.success, true);
            assert.equal(dependencyData.name, "GET /finance/info");
            assert.equal(dependencyData.data, "http://finance.google.com/finance/info?client=ig&q=msft");
            assert.equal(dependencyData.target, "finance.google.com");
        });

        it("should return non-success for a request error", () => {
            request["method"] = "GET";
            let parser = new HttpAIDependency(new Client("mock"), "http://bing.com/search", request);
            parser.onError(new Error("test error message"));

            let dependencyData = parser.getDependencyData().baseData;
            assert.equal(dependencyData.type, ContractsModule.Contracts.RemoteDependencyDataConstants.TYPE_HTTP);
            assert.equal(dependencyData.success, false);
            assert.ok(dependencyData.properties);
            assert.equal(dependencyData.properties.error, "test error message");
        });

        it("should return non-success for a response error status", () => {
            request["method"] = "GET";
            let parser = new HttpAIDependency(new Client("mock"), "http://bing.com/search", request);

            response.statusCode = 400;
            parser.onResponse(response);

            let dependencyData = parser.getDependencyData().baseData;
            assert.equal(dependencyData.type, ContractsModule.Contracts.RemoteDependencyDataConstants.TYPE_HTTP);
            assert.equal(dependencyData.success, false);
        });
    });
});
