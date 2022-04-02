## Welcome to JS Shell

Follwing builtin commands are available
* echo: prints the arguments
  * examples: 'echo hello world'
* scan: reads input from user and prints it
  * examples: 'scan', 'scan input a number'
* path: replaces the current path with arguments
  * examples: 'path', 'path bin', 'path /bin'
* mount: mounts a file system to a directory
  * examples: 'mount', 'mount /docs URL http://localhost:8000/docs', 'mount /docs URL /docs'

And Following commands are available via mounted file system /bin
* add.js
* cat.js
* ls.js
* md.js
* toFile.js
* yes.js

Additionally it also supports pipes ex: 'cat.js docs/help.md|md.js', 'yes.js 22|add.js'

<sup>source code at: <https://github.com/ssrangisetti/jsshell></sup>
