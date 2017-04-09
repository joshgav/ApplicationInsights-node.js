import ContractsModule = require('../Library/Contracts');
import Client = require('../Library/Client');

import AIItem = require('./AIItem');

abstract class AIDependency extends AIItem {
    protected _startTime: number;
    protected _duration: number;
    protected _theirAppId: string = '';

    get theirAppId () : string {
        return this._theirAppId;
    }

    constructor(client: Client) {
        super(client);
        this._startTime = +new Date();
    }

    public getDependencyData() : ContractsModule.Contracts.Data<ContractsModule.Contracts.RemoteDependencyData> {
        return this._getDependencyData();
    }

    get dependencyData () : ContractsModule.Contracts.Data<ContractsModule.Contracts.RemoteDependencyData> {
        return this._getDependencyData();
    }

    protected abstract _getDependencyData () : ContractsModule.Contracts.Data<ContractsModule.Contracts.RemoteDependencyData>;
}

export = AIDependency;
