if (!window.marked) {
  let markedResp = await fetch("https://cdn.jsdelivr.net/npm/marked/marked.min.js")
  if (markedResp.status >= 200 && markedResp.status < 300) {
    eval(await markedResp.text());
  }
}
let content = "";
while (true) {
    try {
        content += await reader.read();
        content += "\n";
    } catch (err) {
        break;
    }
}
let div = document.createElement("div");
div.innerHTML = window.marked.parse(content, {headerIds: false});
await writer.write(div);
