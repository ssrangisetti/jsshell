import { UrlFs, StorageFs } from "./fs.js";
import { TerminalShell } from './term.js';

window.onload = async (_evt) => {
    window.term = new TerminalShell();
    term.fs.addMount("/", new StorageFs(window.localStorage));
    await createDir(term.fs, "/bin");
    await createDir(term.fs, "/tmp");
    await createDir(term.fs, "/docs");
    term.fs.addMount("/tmp", new StorageFs(window.sessionStorage));
    term.addPrompt();
    term.fs.addMount("/bin", new UrlFs("bin"));
    term.fs.addMount("/docs", new UrlFs("docs"));
    const parsedHash = new URLSearchParams(window.location.hash.substring(1));
    let cmd = parsedHash.get("cmd");
    let intervel = parsedHash.get("intervel");
    if (cmd != null) {
        let cmds = cmd.split(";");
        if (intervel == null) {
            intervel = 0;
        }
        for (let cmd of cmds) {
            await term.typeAndExecute(decodeURIComponent(cmd).trim(), intervel);
        }
    }
}

async function createDir(fs, dir) {
    let stat;
    try {
        stat = await fs.stat(dir);
    } catch (err) {
        await fs.createDir(dir);
        return;
    }
    if (stat["type"] != "DIR") {
        alert(`${dir} already exists but not a dir`);
    }
}
