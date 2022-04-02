
import { Pipe, PipeReader, PipeWriter } from "./pipe.js"
import { MountFs, UrlFs } from "./fs.js"

class TermWriter {
    async write(ele) {
        document.getElementById("root").append(ele);
    }
}

class TermReader {

    read() {
        return new Promise((res, rej) => {
            const input = document.createElement("input");
            input.autocomplete = false;
            input.spellcheck = false;
            input.onkeydown = evt => {
                if (evt.key == "Enter") {
                    evt.target.disabled = true;
                    res(evt.target.value);
                } else if (evt.ctrlKey && (evt.key == "c" || evt.key == "C")) {
                    evt.preventDefault();
                    rej("EOF")
                }
            };
	    input.classList.add("scan-input");
            document.getElementById("root").appendChild(input);
            input.scrollIntoView({ behavior: "smooth" });
            input.select();
        });
    }
}


class TerminalShell {
    #AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    #history = [];
    #historyPointer = 0;
    #pwd = "/";
    #curBuffer = "";
    fs = new MountFs();
    #paths = ["/bin"]
    #commands = {
        echo: async (args, reader, writer) => {
            await writer.write(args.join(" "));
        },

        scan: async (args, reader, writer) => {
            await this.#commands.echo(args, reader, writer);
            const ele = await reader.read();
            await writer.write(ele);
        },

        cd: async (args, reader, writer) => {
            let path;
            if (args.length == 0) {
                path = "/";
            } else {
                path = args[0];
            }
            path = this.normalizePath(path);
            let stat = await this.fs.stat(path);
            if (stat.type != "DIR") {
                throw `${path}: not a directory`;
            }
            this.#pwd = path;
        },

        path: async (args, reader, writer) => {
            if (args.length != 0) {
                let newPaths = [];
                for (let path of args) {
                    newPaths.push(this.normalizePath(path));
                }
                this.#paths = newPaths;
            } else {
                await writer.write(this.#paths);
            }
        },

        mount: async (args, reader, writer) => {
            if (args.length == 0) {
                await writer.write(JSON.stringify(this.fs.mounts, null, 4));
            } else {
                let path = this.normalizePath(args[0]);
                let type = args[1];
                switch (type) {
                    case "URL":
                        this.fs.addMount(path, new UrlFs(args[2]));
                }
            }
        }
    };

    prompt = function (pwd) {
        return `jsshell@ssrangisetti ${pwd} $`;
    }

    #processKey(evt) {
        if (evt.key == "Enter") {
            this.#processCommand(evt.target);
        } else if (evt.key == "Tab") {
            evt.preventDefault();
            this.#autocomplete(evt.target)
                .catch(err => console.log(err));
            this.#curBuffer = evt.target.value;
            this.#historyPointer = this.#history.length;
        } else if (evt.key == "ArrowUp") {
            evt.preventDefault();
            evt.target.value = this.#historyComplete(-1, evt.target.value);
        } else if (evt.key == "ArrowDown") {
            evt.preventDefault();
            evt.target.value = this.#historyComplete(1, evt.target.value);
        }
    }

    #processKeyUp(evt) {
        if (evt.key != "Enter" && evt.key != "Tab" && evt.key != "ArrowUp" && evt.key != "ArrowDown") {
            this.#curBuffer = evt.target.value;
            this.#historyPointer = this.#history.length;
        }
    }

    async typeAndExecute(cmd, intervel) {
        let input = document.getElementById("cur-prompt");
        if (input == null) {
            return;
        }
        await this.#type(input, cmd, intervel);
        await this.#processCommand(input);
    }

    async #type(input, cmd, intervel) {
        for (let char of cmd) {
            await new Promise(r => setTimeout(r, intervel));
            input.value = input.value + char;
        }
    }

    async #processCommand(input) {
        input.disabled = true;
        input.removeAttribute("id");
        this.#history.push(input.value);
        this.#historyPointer = this.#history.length;
        this.#curBuffer = "";
        this.#removeAutoComplete();

        let reader = new TermReader();
        let writer = new TermWriter();
        let val;
        try {
            val = await this.runCommand(input.value, reader, writer);
        } catch (err) {
            val = await writer.write(err);
        }
        return this.addPrompt();
    }

    runCommand(input, reader, writer) {
        const cmds = input.split('|');

        const promises = [];
        let curPipe = new Pipe()
        let curWriter = new PipeWriter(curPipe);
        let pipesToClose = [curPipe];
        for (let i = 0; i < cmds.length - 1; i++) {
            promises.push(this.#executeInternal(cmds[i], reader, curWriter).finally(() => pipesToClose.forEach(pipe => pipe.close())));
            pipesToClose = [curPipe];
            reader = new PipeReader(curPipe);
            curPipe = new Pipe();
            pipesToClose.push(curPipe);
            curWriter = new PipeWriter(curPipe);
        }
        curWriter = writer;
        promises.push(this.#executeInternal(cmds[cmds.length - 1], reader, curWriter).finally(() => pipesToClose.forEach(pipe => pipe.close())));
        return Promise.all(promises);
    }

    async #executeInternal(cmd, reader, writer) {
        if (!cmd) {
            return;
        }
        let args = cmd.trim().split(' ');
        let name = args.shift();
        if (name in this.#commands) {
            try {
                await this.#commands[name](args, reader, writer);
            } catch (err) {
                throw `error executing ${name}: ${err}`;
            }
        } else {
            let exec = await this.#getExecutable(name);
            if (exec != null) {
                let func = new this.#AsyncFunction("args", "reader", "writer", exec);
                await func(args, reader, writer);
            } else {
                throw `command ${name} not found`;
            }

        }
    }

    async #getExecutable(name) {
        if (name.includes("/")) {
            return await this.fs.readFile(this.normalizePath(name));
        } else {
            for (let path of this.#paths) {
                try {
                    return await this.fs.readFile(path + "/" + name);
                } catch (err) {
                    continue;
                }
            }
            return null;
        }
    }

    get pwd() {
        return this.#pwd;
    }

    addPrompt() {
        const div = document.createElement("div");
        div.className = "prompt";

        const p = document.createElement("p");
        p.className = "text";
        p.textContent = this.prompt(this.#pwd);
        div.appendChild(p);

        const input = document.createElement("input");
        input.autocomplete = false;
        input.spellcheck = false;
        input.onkeydown = this.#processKey.bind(this);
        input.onkeyup = this.#processKeyUp.bind(this);
        input.className = "prompt-input";
        input.id = "cur-prompt";
        div.appendChild(input);

        document.getElementById("root").appendChild(div);

        input.scrollIntoView({ behavior: "smooth" });

        input.select()
    }

    normalize(arr) {
        let normArr = [];
        for (let elem of arr) {
            if (elem === "." || elem === "") continue;
            if (elem === "..") normArr.pop();
            else normArr.push(elem);
        }
        return normArr;
    }

    normalizePath(path) {
        if (!path) path = "/";

        let dirs;
        if (!path.startsWith("/")) {
            let pwdCopy = this.#pwd.split("/");
            pwdCopy.push(...path.split("/"))
            dirs = this.normalize(pwdCopy)
        } else {
            dirs = this.normalize(path.split("/"));
        }
        return "/" + dirs.join("/");
    }

    async #autocomplete(inp) {
        this.#removeAutoComplete();
        let args = inp.value.split(" ");
        let l = args.length;
        let autocompleteWords = [];
        if (args[l - 1].includes("/")) {
            let comp = await this.#autocompPath(args[l - 1])
            autocompleteWords.push(...comp);
        } else if (l == 1 || args[l - 2].endsWith("|")) {
            autocompleteWords.push(...Object.keys(this.#commands));
            for (let path of this.#paths) {
                try {
                    let comp = await this.#getFiles(path)
                    autocompleteWords.push(...comp);
                } catch (error) {
                    console.warn(error);
                }
            }
        } else {
            let comp = await this.#getFiles(this.#pwd)
            autocompleteWords.push(...comp);
        }
        let words = this.#possibleWords(args[l - 1], autocompleteWords);
        if (words.length != 0) {
            args[l - 1] = this.#shortestCommonPrefix(words);
        }
        inp.value = args.join(" ");
        if (words.length > 1) {
            let div = document.createElement("div");
            div.id = "autocomplete";
            let wordChildren = [];
            for (let word of words) {
                let split = word.split("/");
                wordChildren.push(split[split.length - 1]);
            }
            div.textContent = wordChildren.join("\t");
            let root = document.getElementById("root");
            root.appendChild(div);
            div.scrollIntoView({ behavior: "smooth" });
        }
    }

    async #autocompPath(path) {
        let normPath = this.normalizePath(path);
        let par = normPath.split("/")
        if (!path.endsWith("/"))
            par.pop();
        par = this.normalize(par);
        par = "/" + par.join("/");
        let files = await this.#getFiles(par);
        let dir = path.split("/");
        let comp = [];
        for (let file of files) {
            dir[dir.length - 1] = file;
            comp.push(dir.join("/"));
        }
        return comp;
    }

    async #getFiles(path) {
        let stat = await this.fs.stat(path);
        let files = [];
        for (let child in stat.children) {
            files.push(child);
        }
        return files;
    }

    #removeAutoComplete() {
        let autocomplete = document.getElementById("autocomplete")
        if (autocomplete != null) {
            autocomplete.remove();
        }
    }

    #possibleWords(word, list) {
        let l = [];
        for (let item of list) {
            if (item.startsWith(word)) {
                l.push(item);
            }
        }
        return l;
    }

    #shortestCommonPrefix(words) {
        let i = 0;
        let pre = "";
        while (true) {
            if (words[0].length <= i) {
                return pre;
            }
            let char = words[0][i];
            for (let word of words) {
                if (word[i] != char) {
                    return pre;
                }
            }
            i++;
            pre += char;
        }
    }

    #historyComplete(shift, value) {
        if (this.#historyPointer + shift < 0 || this.#historyPointer + shift > this.#history.length) {
            return value;
        }
        this.#historyPointer += shift;
        if (this.#historyPointer == this.#history.length) {
            return this.#curBuffer;
        }
        return this.#history[this.#historyPointer];
    }


}

export { TerminalShell };
