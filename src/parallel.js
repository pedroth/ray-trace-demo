class MyWorker {
    constructor(path) {
        this.path = path;
        try {
            this.worker = new Worker(path, { type: 'module' });
        } catch (e) {
            console.log("Caught error while importing worker", e);
        }
    }

    onMessage(lambda) {
        if (this.__lambda) {
            this.worker.removeEventListener('message', this.__lambda);
        }
        this.__lambda = message => lambda(message.data);
        this.worker.addEventListener("message", this.__lambda);
        this.worker.addEventListener("error", e => console.log("Caught error on worker", e));
    }

    postMessage(message) {
        return this.worker.postMessage(message);
    }
}

export default MyWorker;