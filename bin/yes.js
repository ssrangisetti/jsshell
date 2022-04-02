let toPrint = "y";
if (args.length != 0) {
   toPrint = args[0];
}
while (true) {
    try {
        await writer.write(toPrint);
    } catch (err) {
        console.log(err);
        break;
    }
}
