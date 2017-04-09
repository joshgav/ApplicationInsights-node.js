import assert = require("assert");
import sinon = require("sinon");

import HttpAIRequest = require("../../AutoCollection/HttpAIRequest");

describe("AutoCollection/HttpAIRequest", function () {

    describe("#constructor", function () {

        var mockIncomingMessage = {
            method: "GET",
            url: "/search?q=test",
            socket: {
                encrypted: false
            },
            headers: {
                host: "bing.com"
            }
        }

        var mockClient = {
            config: {
                appId: "ourAppId"
            }
        }

        it("should set theirAppId from incoming Request-Context header", function () {
            mockIncomingMessage.headers["Request-Context"] = "appId=testApp";
            const tester = new HttpAIRequest(null, <any>mockIncomingMessage, null);
            assert.equal(tester.theirAppId, 'testApp');
        });

        it("should set theirAppId to empty string if not specified", function () {
            // mockIncomingMessage.headers["Request-Context"] = "";
            const tester = new HttpAIRequest(null, <any>mockIncomingMessage, null);
            assert.equal(tester.theirAppId, '');
        });

        it("should set appId to our AppId if a client is provided", function () {
            const tester = new HttpAIRequest(<any>mockClient, <any>mockIncomingMessage, null);
            assert.equal(tester.appId, 'ourAppId');
        });

    });

    describe("#parseId()", () => {
        it("should extract guid out of cookie", () => {
            var cookieValue = "id|1234|1234";
            var actual = HttpAIRequest.parseId(cookieValue);
            assert.equal("id", actual, "id in cookie is parsed correctly");
        });
    });

    describe("#getRequestData()", () => {

        var mockIncomingMessage = {
            method: "GET",
            url: "/search?q=test",
            connection: {
                encrypted: false
            },
            headers: {
                host: "bing.com",
            }
        }

        it("should return an absolute http url", () => {
            var testReq = new HttpAIRequest(null, <any>mockIncomingMessage, null);
            var requestData = testReq.getRequestData();
            assert.equal(requestData.baseData.url, "http://bing.com/search?q=test");
        });

        it("should return an absolute https url", () => {
            mockIncomingMessage.connection.encrypted = true;

            var testReq = new HttpAIRequest(null, <any>mockIncomingMessage, null);
            var requestData = testReq.getRequestData();
            assert.equal(requestData.baseData.url, "https://bing.com/search?q=test");
        });

        it("should return an absolute url for complex urls", () => {
            mockIncomingMessage.url = "/a/b/c/?q=test&test2";
            var testReq = new HttpAIRequest(null, <any>mockIncomingMessage, null);
            var requestData = testReq.getRequestData();
            assert.equal(requestData.baseData.url, "http://bing.com/a/b/c/?q=test&test2");
        });

        it("should return an absolute url when url does not have search part", () => {
            mockIncomingMessage.url = "/a/";
            var testReq = new HttpAIRequest(null, <any>mockIncomingMessage, null);
            var requestData = testReq.getRequestData();
            assert.equal(requestData.baseData.url, "http://bing.com/a/");
        });

        it("should return an absolute url when url does not have path name", () => {
            mockIncomingMessage.url = "/";
            var testReq = new HttpAIRequest(null, <any>mockIncomingMessage, null);
            var requestData = testReq.getRequestData();
            assert.equal(requestData.baseData.url, "http://bing.com/");
        });
    });

    describe("#getRequestTags()", () => {

        var mockIncomingMessage = {
            method: "GET",
            url: "/search?q=test",
            connection: {
                encrypted: false
            },
            headers: {
                host: "bing.com",
                "Request-Context": "appId=testApp",
                "x-forwarded-for": "123.123.123.123",
                "cookie": "ai_user=cookieUser|time;ai_session=cookieSession|time",
                "x-ms-request-id": "parentRequestId",
                "x-ms-request-root-id": "operationId",
            }
        }

        it("should not override context tags if they are already specified", () => {
            var testReq = new HttpAIRequest(null, <any>mockIncomingMessage, null);

            var originalTags: {[key: string]:string} = {
                [(<any>HttpAIRequest).keys.locationIp]: 'originalIp',
                [(<any>HttpAIRequest).keys.userId]: 'originalUserId',
                [(<any>HttpAIRequest).keys.userAgent]: 'originalUserAgent',
                [(<any>HttpAIRequest).keys.operationName]: 'originalOperationName',
                [(<any>HttpAIRequest).keys.operationId]: 'originalOperationId',
                [(<any>HttpAIRequest).keys.operationParentId]: 'originalOperationParentId'
            };

            var newTags = testReq.getRequestTags(originalTags);

            assert.equal(newTags[(<any>HttpAIRequest).keys.locationIp], 'originalIp');
            assert.equal(newTags[(<any>HttpAIRequest).keys.userId], 'originalUserId');
            assert.equal(newTags[(<any>HttpAIRequest).keys.userAgent], 'originalUserAgent');
            assert.equal(newTags[(<any>HttpAIRequest).keys.operationName], 'originalOperationName');
            assert.equal(newTags[(<any>HttpAIRequest).keys.operationId], 'originalOperationId');
            assert.equal(newTags[(<any>HttpAIRequest).keys.operationParentId], 'originalOperationParentId');
        });

        it("should set unspecified tags from headers", () => {
            var testReq = new HttpAIRequest(null, <any>mockIncomingMessage, null);

            var originalTags: {[key: string]:string} = {};

            var newTags = testReq.getRequestTags(originalTags);

            assert.equal(newTags[(<any>HttpAIRequest).keys.locationIp], '123.123.123.123');
            assert.equal(newTags[(<any>HttpAIRequest).keys.userId], 'cookieUser');
            assert.equal(newTags[(<any>HttpAIRequest).keys.userAgent], undefined);
            assert.equal(newTags[(<any>HttpAIRequest).keys.operationName], 'GET /search');
            assert.equal(newTags[(<any>HttpAIRequest).keys.operationId], 'operationId');
            assert.equal(newTags[(<any>HttpAIRequest).keys.operationParentId], 'parentRequestId');
        });
    });
});
