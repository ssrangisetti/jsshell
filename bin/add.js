await term.runCommand("echo enter first number:", reader, writer);
let x = await reader.read();
await term.runCommand("echo enter second number:", reader, writer);
let y = await reader.read();

await writer.write(parseInt(x)+ +y);
