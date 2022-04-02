class UrlFs {
    #url;

    constructor(url) {
        this.#url = url;
    }

    async createDir(dir) {
        throw "not supported for this fs";
    }

    async stat(path) {
        let resp = await fetch(this.#url + path + "/.data.json", {method: "GET"})
        if (resp.status >= 200 && resp.status < 300) {
            let json = JSON.parse(await resp.text());
            return {"type": "DIR", "children": json};
        } else {
            resp = await fetch(this.#url + path, {method: "HEAD"});
            if (resp.status >= 200 && resp.status < 300)
                return {"type": "FILE", "children": {}};
            else
                throw `${path}: no such file or directory`;
        }
    }

    async readFile(path) {
        let resp = await fetch(this.#url + path, {method: "GET"})
        if (resp.status >= 200 && resp.status < 300)
            return await resp.text()
        else
            throw `${path}: no such file`;
    }

    async writeFile(file, content) {
        throw "not supported for this fs";
    }

    async removeFile(path) {
        throw "not supported for this fs";
    }

    async removeDir(path) {
        throw "not supported for this fs";
    }

}

class StorageFs {
    #storage;

    constructor(storage) {
        this.#storage = storage;
        if (this.#storage.getItem("stat:/") == null) {
            this.#storage.setItem("stat:/", JSON.stringify({"type": "DIR", "children": {}}))
        }
    }

    #getParent(path) {
        let dirs = path.split("/");
        if (dirs.length > 0) {
            dirs.pop();
        }
        term.normalize(dirs);
        return "/" + dirs.join("/")
    }

    #getName(path) {
        let dirs = path.split("/");
        if (dirs.length > 0) {
            return dirs[dirs.length - 1];
        } else {
            return "/";
        }
    }

    async createDir(dir) {
        if (this.#statInner(dir) != null) {
            throw `${dir}: already exists`;
        }
        let par = this.#getParent(dir);
        let statPar = this.#statInner(par);
        if (statPar == null) {
            throw `${par}: does not exists`;
        }
        if (statPar.type != "DIR") {
            throw `${par}: not a directory`;
        }
        this.#storage.setItem(`stat:${dir}`, JSON.stringify({"type": "DIR", "children": {}}));
        statPar.children[this.#getName(dir)] = {"type": "DIR"};
        this.#storage.setItem(`stat:${par}`, JSON.stringify(statPar));
    }

    #statInner(path) {
        return JSON.parse(this.#storage.getItem(`stat:${path}`))
    }

    async stat(path) {
        let stat = this.#statInner(path);
        if (stat == null) {
            throw `${path}: no such file or directory`;
        }
        return stat;
    }

    async readFile(path) {
        let content = this.#storage.getItem(path);
        if (content == null) {
            throw `${path}: no such file`;
        }
        return content;
    }

    #createFile(file) {
        if (this.#statInner(file) != null) {
            return;
        }
        let par = this.#getParent(file);
        let statPar = this.#statInner(par);
        if (statPar == null) {
            throw `${par}: does not exists`;
        }
        if (statPar.type != "DIR") {
            throw `${par}: not a directory`;
        }
        this.#storage.setItem(`stat:${file}`, JSON.stringify({"type": "FILE"}));
        statPar.children[this.#getName(file)] = {"type": "FILE"};
        this.#storage.setItem(`stat:${par}`, JSON.stringify(statPar));
    }

    async writeFile(file, content) {
        if (this.#statInner(file) == null) {
            this.#createFile(file);
        }
        this.#storage.setItem(file, content);
    }

    async removeFile(path) {
        let stat = this.#statInner(path);
        if (stat == null) {
            throw `${path}: file does not exists`;
        }
        if (stat.type == "DIR") {
            throw `${path}: not a file`;
        }
        this.#storage.removeItem(`stat:${path}`);
        this.#storage.removeItem(path);
        let par = this.#getParent(path);
        let statPar = this.#statInner(par);
        delete statPar.children[this.#getName(path)];
        this.#storage.setItem(`stat:${par}`, JSON.stringify(statPar));
    }

    async removeDir(path) {
        if (path == "/") {
            throw `Cannot remove /`;
        }
        let stat = this.#statInner(path);
        if (stat == null) {
            throw `${path}: directort does not exists`;
        }
        if (stat.type != "DIR") {
            throw `${path}: not a directory`;
        }
        if (Object.keys(stat.children).length != 0) {
            throw `${path}: not empty`;
        }
        this.#storage.removeItem(`stat:${path}`);
        let par = this.#getParent(path);
        let statPar = this.#statInner(par);
        delete statPar.children[this.#getName(path)];
        this.#storage.setItem(`stat:${par}`, JSON.stringify(statPar));
    }
}

class MountFs {
    #mounts = {};

    addMount(path, fs) {
        this.#mounts[path] = fs;
    }

    get mounts() {
        return this.#mounts;
    }

    #getMountpoint(path) {
        let max = "/"; 
        let maxLength = 1;
        for (let mount in this.#mounts) {
            if (path.startsWith(mount) && mount.length > maxLength) {
                max = mount;
                maxLength = mount.length;
            }
        }
        return max;
    }

    #getRelativePath(mp, path) {
        if (mp == "/") {
            return path
        }
        if (mp.length == path.length) {
            return "/";
        }
        return path.substr(mp.length);
    }

    async createDir(dir) {
        let mp = this.#getMountpoint(dir);
        await this.#mounts[mp].createDir(this.#getRelativePath(mp, dir));
    }

    async stat(path) {
        let mp = this.#getMountpoint(path);
        return await this.#mounts[mp].stat(this.#getRelativePath(mp, path));
    }

    async readFile(file) {
        let mp = this.#getMountpoint(file);
        return await this.#mounts[mp].readFile(this.#getRelativePath(mp, file));
    }

    async writeFile(file, content) {
        let mp = this.#getMountpoint(file);
        await this.#mounts[mp].writeFile(this.#getRelativePath(mp, file), content);
    }

    async removeFile(path) {
        let mp = this.#getMountpoint(path);
        await this.#mounts[mp].removeFile(this.#getRelativePath(mp, path));
    }

    async removeDir(path) {
        let mp = this.#getMountpoint(path);
        await this.#mounts[mp].removeDir(this.#getRelativePath(mp, path));
    }

}

export {MountFs, UrlFs, StorageFs};
