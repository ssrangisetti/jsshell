if (args.length == 0) {
    throw `USAGE: cat.js <file1> <file2> ...`
}
for (let file of args) {
    let content = await term.fs.readFile(term.normalizePath(file));
    await writer.write(content);
}
