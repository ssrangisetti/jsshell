class Pipe {

  #closed = false;
  #resolves = [];
  #promises = [];

  #add() {
    this.#promises.push(new Promise((res, rej) => {
      this.#resolves.push([res, rej]);
    }));
  }

  read() {
    if (this.#closed) return Promise.reject("EOF: closed");
    if (this.#resolves.length === 0) this.#add();
    return new Promise((res, rej) => {
      let resolve = this.#resolves.shift();
      resolve[0]([res, rej]);
    });
  }

  async write(ele) {
    if (this.#closed) throw "EOF: closed";
    if (this.#promises.length === 0) this.#add();
    let promise = await this.#promises.shift();
    promise[0](ele);
  }

  close() {
    console.log("closing pipe");
    this.#closed = true;
    this.#resolves.forEach((res) => res[1]("EOF: closed"));
    this.#resolves = [];
    this.#promises.forEach((prm) => prm.then((res) => res[1]("EOF: closed")));
    this.#promises = [];
  }

}


class PipeReader {
  #pipe;
  constructor(pipe) {
    this.#pipe = pipe;
  }

  async read() {
    console.log("read");
    return await this.#pipe.read();
  }

}


class PipeWriter {
  #pipe;
  constructor(pipe) {
    this.#pipe = pipe;
  }

  async write(ele) {
    console.log("write");
    await this.#pipe.write(ele);
  }

}

export {Pipe, PipeReader, PipeWriter};
