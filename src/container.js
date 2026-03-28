export class Container {
    constructor(){
        this._factories = new Map(); //ключ -> {kind, factory}
        this._singletons = new Map(); // кэш синглтонов
    }

    //регистрация службы как синглтон
    addSingleton(key, factory){
        this._factories.set(key,{kind:'singleton', factory});
    }

    //регистрация службы как transient
    addTransient(key, factory){
        this._factories.set(key,{kind:'transient', factory});
    }

    //получение экземпляра службы по ключу
    get(key){
        const entry = this._factories.get(key);
        if(!entry){
            throw new Error(`Service ${key} not registered`);
        }

        if(entry.kind === 'singleton'){
            if(!this._singletons.has(key)){
                this._singletons.set(key, entry.factory(this));
            }
            return this._singletons.get(key);
        }

        return entry.factory(this);
    }

    //получение нескольких экземпляров службы по префиксу
    getMany(prefix) {
        const result = [];
        for (const [key] of this._factories) {
            if (key.startsWith(prefix)) {
                result.push(this.get(key));
            }
        }
        return result;
    }
}