let path = args[0];
if (!path) {
    path = term.pwd;
} 

let stat = await term.fs.stat(term.normalizePath(path));
if (stat.type == "DIR") {
    let table = document.createElement("table");
    for (let item in stat.children) {
        let row = document.createElement("tr");
        let col = document.createElement("td");
        col.innerHTML = item;
        row.appendChild(col);
        col = document.createElement("td");
        col.innerHTML = stat.children[item].type;
        row.appendChild(col);
    
        table.appendChild(row);
    }
    await writer.write(table);
} else {
    let table = document.createElement("table");
    let row = document.createElement("tr");
    let col = document.createElement("td");
    col.innerHTML = path;
    row.appendChild(col);
    col = document.createElement("td");
    col.innerHTML = stat.type;
    row.appendChild(col);
    table.appendChild(row)
    await writer.write(table);
}
