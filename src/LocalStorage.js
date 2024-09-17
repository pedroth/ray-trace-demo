const LocalStorage = (() => {
    const namespace = "ray-trace-demo";
    return {
        getItem: key => {
            const ls = localStorage.getItem(namespace) || "{}";
            return JSON.parse(ls)[key];
        },
        setItem: (key, value) => {
            const ls = JSON.parse(localStorage.getItem(namespace)) || {};
            ls[key] = value;
            localStorage.setItem(namespace, JSON.stringify(ls));
            return this;
        }
    };
})();

export default LocalStorage;