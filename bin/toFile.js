if (args.length == 0) {
    throw `USAGE: toFile.js <file>`
}

let content = "";

while (true) {
    try {
        content = await reader.read();
        // content += "\n";
        await writer.write(content);
    } catch (err) {
        break;
    }
}

await term.fs.writeFile(term.normalizePath(args[0]), content);
